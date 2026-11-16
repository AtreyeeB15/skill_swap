import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(path.join(dataDir, 'skillswap.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function uid(): string {
  return crypto.randomUUID();
}

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar_url TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      preferred_method TEXT NOT NULL DEFAULT 'online' CHECK (preferred_method IN ('online', 'in-person', 'chat')),
      weekly_availability TEXT NOT NULL DEFAULT '[]',
      credits_per_30min INTEGER NOT NULL DEFAULT 1 CHECK (credits_per_30min BETWEEN 1 AND 10),
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'General',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_skills (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('teach', 'learn')),
      proficiency TEXT NOT NULL DEFAULT 'intermediate' CHECK (proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')),
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, skill_id, type)
    );

    CREATE TABLE IF NOT EXISTS exchange_requests (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      receiver_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      offered_skill_id TEXT REFERENCES skills(id) ON DELETE SET NULL,
      requested_skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      mode TEXT NOT NULL CHECK (mode IN ('swap', 'credit')),
      credit_cost INTEGER NOT NULL DEFAULT 0 CHECK (credit_cost >= 0),
      duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 15 AND 120),
      preferred_method TEXT NOT NULL DEFAULT 'online' CHECK (preferred_method IN ('online', 'in-person', 'chat')),
      proposed_date TEXT DEFAULT '',
      message TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (sender_id <> receiver_id)
    );

    CREATE TABLE IF NOT EXISTS exchanges (
      id TEXT PRIMARY KEY,
      request_id TEXT UNIQUE REFERENCES exchange_requests(id) ON DELETE SET NULL,
      teacher_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      learner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      skill_taught_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      skill_learned_id TEXT REFERENCES skills(id) ON DELETE SET NULL,
      mode TEXT NOT NULL CHECK (mode IN ('swap', 'credit')),
      credit_amount INTEGER NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'completed', 'cancelled')),
      teacher_confirmed INTEGER NOT NULL DEFAULT 0,
      learner_confirmed INTEGER NOT NULL DEFAULT 0,
      project_note TEXT DEFAULT '',
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS credit_wallets (
      user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      balance INTEGER NOT NULL DEFAULT 5 CHECK (balance >= 0),
      total_earned INTEGER NOT NULL DEFAULT 5,
      total_spent INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS credit_transactions (
      id TEXT PRIMARY KEY,
      wallet_user_id TEXT NOT NULL REFERENCES credit_wallets(user_id) ON DELETE CASCADE,
      exchange_id TEXT REFERENCES exchanges(id) ON DELETE SET NULL,
      type TEXT NOT NULL CHECK (type IN ('initial_grant', 'earn', 'spend', 'refund')),
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (exchange_id, type)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      participant_one TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      participant_two TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (participant_one < participant_two),
      UNIQUE (participant_one, participant_two)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS skill_circles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      focus_skill TEXT NOT NULL,
      creator_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      max_members INTEGER NOT NULL DEFAULT 12 CHECK (max_members BETWEEN 2 AND 50),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_memberships (
      id TEXT PRIMARY KEY,
      circle_id TEXT NOT NULL REFERENCES skill_circles(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('organizer', 'member')),
      teaching_skill TEXT DEFAULT '',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (circle_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      exchange_id TEXT REFERENCES exchanges(id) ON DELETE SET NULL,
      circle_id TEXT REFERENCES skill_circles(id) ON DELETE SET NULL,
      host_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      guest_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      skill_name TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 15 AND 60),
      method TEXT NOT NULL DEFAULT 'online' CHECK (method IN ('online', 'in-person', 'chat')),
      status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'rescheduled', 'completed', 'cancelled')),
      is_micro INTEGER NOT NULL DEFAULT 0,
      max_participants INTEGER NOT NULL DEFAULT 2 CHECK (max_participants >= 2),
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS session_participants (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (session_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      exchange_id TEXT NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
      reviewer_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      reviewee_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (exchange_id, reviewer_id),
      CHECK (reviewer_id <> reviewee_id)
    );

    CREATE TABLE IF NOT EXISTS roadmaps (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      skill_name TEXT NOT NULL,
      current_level TEXT NOT NULL,
      target_level TEXT NOT NULL,
      weekly_hours INTEGER NOT NULL CHECK (weekly_hours BETWEEN 1 AND 40),
      ai_mode TEXT NOT NULL DEFAULT 'gemini' CHECK (ai_mode IN ('gemini', 'basic')),
      summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS roadmap_milestones (
      id TEXT PRIMARY KEY,
      roadmap_id TEXT NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
      stage_index INTEGER NOT NULL,
      week_label TEXT NOT NULL,
      title TEXT NOT NULL,
      topics TEXT NOT NULL DEFAULT '[]',
      suggested_session TEXT NOT NULL DEFAULT '',
      partner_hint TEXT DEFAULT '',
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      badge_key TEXT NOT NULL,
      badge_name TEXT NOT NULL,
      description TEXT NOT NULL,
      awarded_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, badge_key)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link TEXT NOT NULL DEFAULT '/dashboard',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);
    CREATE INDEX IF NOT EXISTS idx_exchange_req_participants ON exchange_requests(sender_id, receiver_id, status);
    CREATE INDEX IF NOT EXISTS idx_exchanges_participants ON exchanges(teacher_id, learner_id, status);
    CREATE INDEX IF NOT EXISTS idx_credit_tx_wallet ON credit_transactions(wallet_user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_convo ON messages(conversation_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(scheduled_date, status);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
  `);
}

export function awardBadgesForUser(userId: string): string[] {
  const taughtRow = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM exchanges
       WHERE status = 'completed' AND (teacher_id = ? OR (mode = 'swap' AND learner_id = ?))`
    )
    .get(userId, userId) as { cnt: number };

  const learnedRow = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM exchanges
       WHERE status = 'completed' AND (learner_id = ? OR (mode = 'swap' AND teacher_id = ?))`
    )
    .get(userId, userId) as { cnt: number };

  const ratingRow = db
    .prepare(`SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(*) AS cnt FROM reviews WHERE reviewee_id = ?`)
    .get(userId) as { avg_rating: number; cnt: number };

  const taught = taughtRow.cnt;
  const learned = learnedRow.cnt;
  const total = taught + learned;
  const newlyAwarded: string[] = [];

  const grant = (key: string, name: string, description: string) => {
    const res = db
      .prepare(
        `INSERT OR IGNORE INTO achievements (id, user_id, badge_key, badge_name, description)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(uid(), userId, key, name, description);
    if (res.changes > 0) {
      newlyAwarded.push(name);
    }
  };

  if (taught >= 1) grant('first_skill_shared', 'First Skill Shared', 'Completed your first skill-teaching exchange.');
  if (learned >= 1) grant('first_skill_learned', 'First Skill Learned', 'Completed your first peer learning exchange.');
  if (taught >= 3) grant('knowledge_sharer', 'Knowledge Sharer', 'Taught 3 or more completed peer skill exchanges.');
  if (learned >= 3) grant('active_learner', 'Active Learner', 'Completed 3 or more learning exchanges with peers.');
  if (total >= 5 && ratingRow.cnt > 0 && ratingRow.avg_rating >= 4.5) {
    grant('community_mentor', 'Community Mentor', '5+ completed exchanges with a 4.5+ average peer rating.');
  }

  return newlyAwarded;
}
