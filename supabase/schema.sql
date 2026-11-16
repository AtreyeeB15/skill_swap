-- SkillSwap PostgreSQL Schema, RLS Policies, Functions & Triggers
-- Compatible with Supabase Postgres 15+

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  preferred_method TEXT NOT NULL DEFAULT 'online' CHECK (preferred_method IN ('online', 'in-person', 'chat')),
  weekly_availability JSONB NOT NULL DEFAULT '[]'::jsonb,
  credits_per_30min INTEGER NOT NULL DEFAULT 1 CHECK (credits_per_30min BETWEEN 1 AND 10),
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SKILLS CATALOG
CREATE TABLE IF NOT EXISTS public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'General',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. USER SKILLS (teach / learn)
CREATE TABLE IF NOT EXISTS public.user_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('teach', 'learn')),
  proficiency TEXT NOT NULL DEFAULT 'intermediate' CHECK (proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')),
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, skill_id, type)
);

-- 4. EXCHANGE REQUESTS
CREATE TABLE IF NOT EXISTS public.exchange_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  offered_skill_id UUID REFERENCES public.skills(id) ON DELETE SET NULL,
  requested_skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('swap', 'credit')),
  credit_cost INTEGER NOT NULL DEFAULT 0 CHECK (credit_cost >= 0),
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 15 AND 120),
  preferred_method TEXT NOT NULL DEFAULT 'online' CHECK (preferred_method IN ('online', 'in-person', 'chat')),
  proposed_date TEXT,
  message TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (sender_id <> receiver_id)
);

-- 5. EXCHANGES
CREATE TABLE IF NOT EXISTS public.exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID UNIQUE REFERENCES public.exchange_requests(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_taught_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  skill_learned_id UUID REFERENCES public.skills(id) ON DELETE SET NULL,
  mode TEXT NOT NULL CHECK (mode IN ('swap', 'credit')),
  credit_amount INTEGER NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'completed', 'cancelled')),
  teacher_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  learner_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  project_note TEXT DEFAULT '',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. CREDIT WALLETS
CREATE TABLE IF NOT EXISTS public.credit_wallets (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 5 CHECK (balance >= 0),
  total_earned INTEGER NOT NULL DEFAULT 5,
  total_spent INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. CREDIT TRANSACTIONS LEDGER (idempotent via UNIQUE(exchange_id, type))
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_user_id UUID NOT NULL REFERENCES public.credit_wallets(user_id) ON DELETE CASCADE,
  exchange_id UUID REFERENCES public.exchanges(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('initial_grant', 'earn', 'spend', 'refund')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exchange_id, type)
);

-- 8. CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_one UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_two UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (participant_one < participant_two),
  UNIQUE (participant_one, participant_two)
);

-- 9. MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. SESSIONS (1:1 scheduled sessions + micro-skill sessions)
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id UUID REFERENCES public.exchanges(id) ON DELETE SET NULL,
  circle_id UUID,
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 15 AND 60),
  method TEXT NOT NULL DEFAULT 'online' CHECK (method IN ('online', 'in-person', 'chat')),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'rescheduled', 'completed', 'cancelled')),
  is_micro BOOLEAN NOT NULL DEFAULT FALSE,
  max_participants INTEGER NOT NULL DEFAULT 2 CHECK (max_participants >= 2),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, user_id)
);

-- 11. REVIEWS (strictly after completed exchange)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id UUID NOT NULL REFERENCES public.exchanges(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exchange_id, reviewer_id),
  CHECK (reviewer_id <> reviewee_id)
);

-- 12. GROUP SKILL CIRCLES
CREATE TABLE IF NOT EXISTS public.skill_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  focus_skill TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  max_members INTEGER NOT NULL DEFAULT 12 CHECK (max_members BETWEEN 2 AND 50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sessions
  ADD CONSTRAINT fk_sessions_circle
  FOREIGN KEY (circle_id) REFERENCES public.skill_circles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.skill_circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('organizer', 'member')),
  teaching_skill TEXT DEFAULT '',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circle_id, user_id)
);

-- 13. LEARNING ROADMAPS & MILESTONES
CREATE TABLE IF NOT EXISTS public.roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  current_level TEXT NOT NULL,
  target_level TEXT NOT NULL,
  weekly_hours INTEGER NOT NULL CHECK (weekly_hours BETWEEN 1 AND 40),
  ai_mode TEXT NOT NULL DEFAULT 'gemini' CHECK (ai_mode IN ('gemini', 'basic')),
  summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.roadmap_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  stage_index INTEGER NOT NULL,
  week_label TEXT NOT NULL,
  title TEXT NOT NULL,
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_session TEXT NOT NULL DEFAULT '',
  partner_hint TEXT DEFAULT '',
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ
);

-- 14. ACHIEVEMENTS / BADGES
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  description TEXT NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, badge_key)
);

-- 15. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '/dashboard',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_user_skills_user ON public.user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill ON public.user_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_exchange_req_participants ON public.exchange_requests(sender_id, receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_exchanges_participants ON public.exchanges(teacher_id, learner_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_tx_wallet ON public.credit_transactions(wallet_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_convo ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.sessions(scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);

-- TRIGGER: Auto-provision profile + starter wallet on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_name TEXT;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, v_name, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.credit_wallets (user_id, balance, total_earned, total_spent)
  VALUES (NEW.id, 5, 5, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_transactions (wallet_user_id, exchange_id, type, amount, balance_after, description)
  VALUES (NEW.id, NULL, 'initial_grant', 5, 5, 'Welcome starter credits');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- FUNCTION: Auto-award Skill Passport badges
CREATE OR REPLACE FUNCTION public.award_badges_for_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_taught INT;
  v_learned INT;
  v_total INT;
  v_avg_rating NUMERIC;
BEGIN
  SELECT COUNT(*) INTO v_taught
  FROM public.exchanges
  WHERE status = 'completed'
    AND (teacher_id = p_user_id OR (mode = 'swap' AND learner_id = p_user_id));

  SELECT COUNT(*) INTO v_learned
  FROM public.exchanges
  WHERE status = 'completed'
    AND (learner_id = p_user_id OR (mode = 'swap' AND teacher_id = p_user_id));

  v_total := v_taught + v_learned;

  SELECT COALESCE(AVG(rating), 0) INTO v_avg_rating
  FROM public.reviews
  WHERE reviewee_id = p_user_id;

  IF v_taught >= 1 THEN
    INSERT INTO public.achievements (user_id, badge_key, badge_name, description)
    VALUES (p_user_id, 'first_skill_shared', 'First Skill Shared', 'Completed your first skill-teaching exchange.')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
  END IF;

  IF v_learned >= 1 THEN
    INSERT INTO public.achievements (user_id, badge_key, badge_name, description)
    VALUES (p_user_id, 'first_skill_learned', 'First Skill Learned', 'Completed your first peer learning exchange.')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
  END IF;

  IF v_taught >= 3 THEN
    INSERT INTO public.achievements (user_id, badge_key, badge_name, description)
    VALUES (p_user_id, 'knowledge_sharer', 'Knowledge Sharer', 'Taught 3 or more completed peer skill exchanges.')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
  END IF;

  IF v_learned >= 3 THEN
    INSERT INTO public.achievements (user_id, badge_key, badge_name, description)
    VALUES (p_user_id, 'active_learner', 'Active Learner', 'Completed 3 or more learning exchanges with peers.')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
  END IF;

  IF v_total >= 5 AND v_avg_rating >= 4.5 THEN
    INSERT INTO public.achievements (user_id, badge_key, badge_name, description)
    VALUES (p_user_id, 'community_mentor', 'Community Mentor', '5+ completed exchanges with a 4.5+ average peer rating.')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
  END IF;
END;
$$;

-- TRIGGER: Re-evaluate badges after exchange completion or new review
CREATE OR REPLACE FUNCTION public.trg_award_badges_on_exchange()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    PERFORM public.award_badges_for_user(NEW.teacher_id);
    PERFORM public.award_badges_for_user(NEW.learner_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_exchange_completed_badges ON public.exchanges;
CREATE TRIGGER after_exchange_completed_badges
  AFTER UPDATE ON public.exchanges
  FOR EACH ROW EXECUTE FUNCTION public.trg_award_badges_on_exchange();

-- ATOMIC RPC: Two-party confirmation + idempotent credit settlement
CREATE OR REPLACE FUNCTION public.confirm_exchange_completion(p_exchange_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ex public.exchanges%ROWTYPE;
  v_learner_wallet public.credit_wallets%ROWTYPE;
  v_teacher_wallet public.credit_wallets%ROWTYPE;
  v_new_learner_bal INT;
  v_new_teacher_bal INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_ex FROM public.exchanges WHERE id = p_exchange_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exchange not found';
  END IF;

  IF v_uid <> v_ex.teacher_id AND v_uid <> v_ex.learner_id THEN
    RAISE EXCEPTION 'Not a participant of this exchange';
  END IF;

  IF v_ex.status = 'completed' THEN
    RETURN jsonb_build_object('status', 'completed', 'already_settled', true);
  END IF;

  IF v_uid = v_ex.teacher_id THEN
    UPDATE public.exchanges SET teacher_confirmed = TRUE WHERE id = p_exchange_id;
    v_ex.teacher_confirmed := TRUE;
  ELSE
    UPDATE public.exchanges SET learner_confirmed = TRUE WHERE id = p_exchange_id;
    v_ex.learner_confirmed := TRUE;
  END IF;

  IF NOT (v_ex.teacher_confirmed AND v_ex.learner_confirmed) THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      CASE WHEN v_uid = v_ex.teacher_id THEN v_ex.learner_id ELSE v_ex.teacher_id END,
      'exchange_confirmation',
      'Exchange completion awaiting your confirmation',
      'Your partner confirmed the skill exchange is complete. Please confirm to finalize.',
      '/exchanges'
    );
    RETURN jsonb_build_object(
      'status', 'awaiting_partner',
      'teacher_confirmed', v_ex.teacher_confirmed,
      'learner_confirmed', v_ex.learner_confirmed
    );
  END IF;

  -- Both parties confirmed: settle credits atomically & idempotently
  IF v_ex.mode = 'credit' AND v_ex.credit_amount > 0 THEN
    SELECT * INTO v_learner_wallet FROM public.credit_wallets WHERE user_id = v_ex.learner_id FOR UPDATE;
    SELECT * INTO v_teacher_wallet FROM public.credit_wallets WHERE user_id = v_ex.teacher_id FOR UPDATE;

    IF v_learner_wallet.balance < v_ex.credit_amount THEN
      RAISE EXCEPTION 'Insufficient learner credit balance to settle exchange';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.credit_transactions WHERE exchange_id = p_exchange_id AND type = 'spend'
    ) THEN
      v_new_learner_bal := v_learner_wallet.balance - v_ex.credit_amount;
      UPDATE public.credit_wallets
      SET balance = v_new_learner_bal,
          total_spent = total_spent + v_ex.credit_amount,
          updated_at = NOW()
      WHERE user_id = v_ex.learner_id;

      INSERT INTO public.credit_transactions (wallet_user_id, exchange_id, type, amount, balance_after, description)
      VALUES (v_ex.learner_id, p_exchange_id, 'spend', -v_ex.credit_amount, v_new_learner_bal, 'Completed credit exchange')
      ON CONFLICT (exchange_id, type) DO NOTHING;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.credit_transactions WHERE exchange_id = p_exchange_id AND type = 'earn'
    ) THEN
      v_new_teacher_bal := v_teacher_wallet.balance + v_ex.credit_amount;
      UPDATE public.credit_wallets
      SET balance = v_new_teacher_bal,
          total_earned = total_earned + v_ex.credit_amount,
          updated_at = NOW()
      WHERE user_id = v_ex.teacher_id;

      INSERT INTO public.credit_transactions (wallet_user_id, exchange_id, type, amount, balance_after, description)
      VALUES (v_ex.teacher_id, p_exchange_id, 'earn', v_ex.credit_amount, v_new_teacher_bal, 'Earned credits for teaching exchange')
      ON CONFLICT (exchange_id, type) DO NOTHING;
    END IF;
  END IF;

  UPDATE public.exchanges
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_exchange_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES
    (v_ex.teacher_id, 'exchange_completed', 'Exchange Completed', 'Both parties confirmed completion. Your Skill Passport has been updated.', '/exchanges'),
    (v_ex.learner_id, 'exchange_completed', 'Exchange Completed', 'Both parties confirmed completion. You can now leave a peer review.', '/exchanges');

  RETURN jsonb_build_object('status', 'completed', 'already_settled', false);
END;
$$;

-- ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles & Skills readable by authenticated users for peer discovery
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "skills_select_all" ON public.skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "skills_insert_auth" ON public.skills FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "user_skills_select_all" ON public.user_skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_skills_manage_own" ON public.user_skills FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Exchange Requests
CREATE POLICY "req_select_participant" ON public.exchange_requests FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "req_insert_sender" ON public.exchange_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "req_update_participant" ON public.exchange_requests FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Exchanges
CREATE POLICY "exchanges_select_participant" ON public.exchanges FOR SELECT TO authenticated
  USING (auth.uid() = teacher_id OR auth.uid() = learner_id);

-- Wallets & Ledger (read own; mutations via SECURITY DEFINER RPC)
CREATE POLICY "wallet_select_own" ON public.credit_wallets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "tx_select_own" ON public.credit_transactions FOR SELECT TO authenticated
  USING (auth.uid() = wallet_user_id);

-- Conversations & Messages
CREATE POLICY "convo_participant" ON public.conversations FOR ALL TO authenticated
  USING (auth.uid() = participant_one OR auth.uid() = participant_two)
  WITH CHECK (auth.uid() = participant_one OR auth.uid() = participant_two);

CREATE POLICY "msg_select_participant" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND (auth.uid() = c.participant_one OR auth.uid() = c.participant_two)
  ));
CREATE POLICY "msg_insert_participant" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND (auth.uid() = c.participant_one OR auth.uid() = c.participant_two)
    )
  );

-- Sessions & Participants
CREATE POLICY "sessions_select_visible" ON public.sessions FOR SELECT TO authenticated
  USING (is_micro = TRUE OR circle_id IS NOT NULL OR auth.uid() = host_id OR auth.uid() = guest_id);
CREATE POLICY "sessions_insert_host" ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);
CREATE POLICY "sessions_update_participant" ON public.sessions FOR UPDATE TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = guest_id);
CREATE POLICY "session_part_all" ON public.session_participants FOR ALL TO authenticated
  USING (true) WITH CHECK (auth.uid() = user_id);

-- Reviews (RLS strictly enforces completed exchange between reviewer and reviewee)
CREATE POLICY "reviews_select_all" ON public.reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "reviews_insert_completed_only" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.exchanges e
      WHERE e.id = exchange_id
        AND e.status = 'completed'
        AND (
          (e.teacher_id = auth.uid() AND e.learner_id = reviewee_id)
          OR (e.learner_id = auth.uid() AND e.teacher_id = reviewee_id)
        )
    )
  );

-- Circles & Memberships
CREATE POLICY "circles_select_all" ON public.skill_circles FOR SELECT TO authenticated USING (true);
CREATE POLICY "circles_insert_auth" ON public.skill_circles FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "memberships_select_all" ON public.group_memberships FOR SELECT TO authenticated USING (true);
CREATE POLICY "memberships_manage_own" ON public.group_memberships FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Roadmaps & Milestones
CREATE POLICY "roadmaps_own" ON public.roadmaps FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "milestones_own" ON public.roadmap_milestones FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.roadmaps r WHERE r.id = roadmap_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.roadmaps r WHERE r.id = roadmap_id AND r.user_id = auth.uid()));

-- Achievements & Notifications
CREATE POLICY "achievements_select_all" ON public.achievements FOR SELECT TO authenticated USING (true);
CREATE POLICY "notifications_own" ON public.notifications FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- STORAGE BUCKET FOR AVATARS
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_auth_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- REALTIME PUBLICATION
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
