-- SkillSwap Seed Data (9 Demo Students, Skills, Exchanges, Sessions, Circles & Roadmaps)
-- Note: In Supabase, create the auth.users accounts first (or run via service role script),
-- matching the UUIDs below, or sign up via the UI and run the skills/circles seed.

INSERT INTO public.skills (id, name, category) VALUES
  ('11111111-1111-1111-1111-111111111101', 'React & TypeScript', 'Software Engineering'),
  ('11111111-1111-1111-1111-111111111102', 'UI/UX Design (Figma)', 'Design'),
  ('11111111-1111-1111-1111-111111111103', 'Python & Data Science', 'Data & AI'),
  ('11111111-1111-1111-1111-111111111104', 'Acoustic Guitar', 'Music'),
  ('11111111-1111-1111-1111-111111111105', 'Conversational Spanish', 'Languages'),
  ('11111111-1111-1111-1111-111111111106', 'Public Speaking', 'Communication'),
  ('11111111-1111-1111-1111-111111111107', 'SQL & Database Design', 'Software Engineering'),
  ('11111111-1111-1111-1111-111111111108', 'Digital Photography', 'Creative Arts'),
  ('11111111-1111-1111-1111-111111111109', 'Calculus & Linear Algebra', 'Mathematics'),
  ('11111111-1111-1111-1111-111111111110', 'Video Editing (Premiere)', 'Media')
ON CONFLICT (name) DO NOTHING;

-- Demo auth users (password: SkillSwap123! for all demo accounts)
-- When importing directly into Supabase Auth Admin API, create these users with the IDs below:
-- 1. maya@skillswap.edu   (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1)
-- 2. marcus@skillswap.edu (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2)
-- 3. priya@skillswap.edu  (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3)
-- 4. leo@skillswap.edu    (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4)
-- 5. elena@skillswap.edu  (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5)
-- 6. sam@skillswap.edu    (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6)
-- 7. chloe@skillswap.edu  (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7)
-- 8. devon@skillswap.edu  (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8)
-- 9. nina@skillswap.edu   (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9)

-- Sample profiles update (after auth.users trigger creates base rows)
UPDATE public.profiles SET
  bio = 'CS & HCI senior building design systems. Happy to trade React mentoring for guitar or Spanish conversation.',
  preferred_method = 'online',
  weekly_availability = '["Mon Eve", "Wed Eve", "Sat Morn"]'::jsonb,
  onboarding_completed = TRUE
WHERE email = 'maya@skillswap.edu';

UPDATE public.profiles SET
  bio = 'Audio engineering junior and campus acoustic guitarist. Looking to level up SQL & frontend basics.',
  preferred_method = 'in-person',
  weekly_availability = '["Tue Eve", "Thu Eve", "Sat Morn"]'::jsonb,
  onboarding_completed = TRUE
WHERE email = 'marcus@skillswap.edu';

UPDATE public.profiles SET
  bio = 'Applied Statistics & ML grad student. Love breaking down Python notebooks and linear algebra.',
  preferred_method = 'online',
  weekly_availability = '["Mon Eve", "Thu Eve", "Sun Aft"]'::jsonb,
  onboarding_completed = TRUE
WHERE email = 'priya@skillswap.edu';
