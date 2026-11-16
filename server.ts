import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { db, uid, initSchema, awardBadgesForUser } from './server/db.ts';
import { seedIfEmpty } from './server/seed.ts';
import { generatePeerMatches, generateLearningRoadmap, PeerCandidate } from './server/ai.ts';

initSchema();
seedIfEmpty();

const app = express();
const PORT = 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'skillswap-dev-secret-2026';

const uploadsDir = path.resolve(process.cwd(), 'uploads/avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.json({ limit: '6mb' }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// SSE Realtime connection registry (userId -> Set<Response>)
const sseClients = new Map<string, Set<Response>>();

function pushRealtime(userId: string, event: string, payload: unknown) {
  const clients = sseClients.get(userId);
  if (!clients) return;
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try {
      res.write(data);
    } catch {
      clients.delete(res);
    }
  }
}

function createNotification(userId: string, type: string, title: string, body: string, link: string) {
  const id = uid();
  db.prepare(
    `INSERT INTO notifications (id, user_id, type, title, body, link, is_read)
     VALUES (?, ?, ?, ?, ?, ?, 0)`
  ).run(id, userId, type, title, body, link);

  const row = db.prepare(`SELECT * FROM notifications WHERE id = ?`).get(id);
  pushRealtime(userId, 'notification', row);
  return row;
}

// Token helpers
function signToken(userId: string): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 7;
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): string | null {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
    if (sig !== expected) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub: string; exp: number };
    if (decoded.exp < Date.now()) return null;
    return decoded.sub;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return out;
}

interface AuthedRequest extends Request {
  userId?: string;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const token = bearer || cookies['ss_session'] || (req.query.token as string | undefined);

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const userId = verifyToken(token);
  if (!userId) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }
  const exists = db.prepare('SELECT id FROM profiles WHERE id = ?').get(userId);
  if (!exists) {
    res.status(401).json({ error: 'Account not found' });
    return;
  }
  req.userId = userId;
  next();
}

function setSessionCookie(res: Response, token: string) {
  res.setHeader(
    'Set-Cookie',
    `ss_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
  );
}

function clearSessionCookie(res: Response) {
  res.setHeader('Set-Cookie', 'ss_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

function hydrateProfile(userId: string) {
  const profile = db
    .prepare(
      `SELECT id, name, email, avatar_url, bio, preferred_method, weekly_availability, credits_per_30min, onboarding_completed, created_at
       FROM profiles WHERE id = ?`
    )
    .get(userId) as any;
  if (!profile) return null;

  const skills = db
    .prepare(
      `SELECT us.id, us.skill_id, s.name, s.category, us.type, us.proficiency, us.description
       FROM user_skills us
       JOIN skills s ON s.id = us.skill_id
       WHERE us.user_id = ?
       ORDER BY us.type, s.name`
    )
    .all(userId) as any[];

  const wallet = db.prepare(`SELECT balance, total_earned, total_spent FROM credit_wallets WHERE user_id = ?`).get(userId) as any;

  const ratingStats = db
    .prepare(`SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(*) AS review_count FROM reviews WHERE reviewee_id = ?`)
    .get(userId) as { avg_rating: number; review_count: number };

  const completedRow = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM exchanges WHERE status = 'completed' AND (teacher_id = ? OR learner_id = ?)`
    )
    .get(userId, userId) as { cnt: number };

  const achievements = db
    .prepare(`SELECT id, badge_key, badge_name, description, awarded_at FROM achievements WHERE user_id = ? ORDER BY awarded_at ASC`)
    .all(userId);

  const reviews = db
    .prepare(
      `SELECT r.id, r.rating, r.comment, r.created_at, p.id AS reviewer_id, p.name AS reviewer_name, p.avatar_url AS reviewer_avatar
       FROM reviews r
       JOIN profiles p ON p.id = r.reviewer_id
       WHERE r.reviewee_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(userId);

  return {
    ...profile,
    weekly_availability: JSON.parse(profile.weekly_availability || '[]'),
    onboarding_completed: Boolean(profile.onboarding_completed),
    teachSkills: skills.filter((s) => s.type === 'teach'),
    learnSkills: skills.filter((s) => s.type === 'learn'),
    wallet: wallet || { balance: 0, total_earned: 0, total_spent: 0 },
    avgRating: Number(Number(ratingStats.avg_rating || 0).toFixed(1)),
    reviewCount: ratingStats.review_count,
    completedExchanges: completedRow.cnt,
    achievements,
    reviews,
  };
}

function getOrCreateSkillId(skillName: string, category = 'General'): string {
  const trimmed = skillName.trim();
  const existing = db.prepare(`SELECT id FROM skills WHERE lower(name) = lower(?)`).get(trimmed) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = uid();
  db.prepare(`INSERT INTO skills (id, name, category) VALUES (?, ?, ?)`).run(id, trimmed, category);
  return id;
}

// ---------------- AUTH ROUTES ----------------

app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Full name is required.' });
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Enter a valid email address.' });
    return;
  }
  if (!password || password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    res.status(400).json({ error: 'Password must be at least 8 characters and include a letter and a number.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare(`SELECT id FROM profiles WHERE lower(email) = ?`).get(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const userId = uid();
  const hash = bcrypt.hashSync(password, 10);

  db.transaction(() => {
    db.prepare(
      `INSERT INTO profiles (id, name, email, password_hash, onboarding_completed)
       VALUES (?, ?, ?, ?, 0)`
    ).run(userId, name.trim(), normalizedEmail, hash);

    db.prepare(
      `INSERT INTO credit_wallets (user_id, balance, total_earned, total_spent) VALUES (?, 5, 5, 0)`
    ).run(userId);

    db.prepare(
      `INSERT INTO credit_transactions (id, wallet_user_id, exchange_id, type, amount, balance_after, description)
       VALUES (?, ?, NULL, 'initial_grant', 5, 5, 'Welcome starter credits')`
    ).run(uid(), userId);

    createNotification(
      userId,
      'credit',
      'Welcome to SkillSwap (+5 Starter Credits)',
      'Complete your skill profile to unlock personalized peer matches.',
      '/onboarding'
    );
  })();

  const token = signToken(userId);
  setSessionCookie(res, token);
  res.status(201).json({ token, user: hydrateProfile(userId) });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  const row = db
    .prepare(`SELECT id, password_hash FROM profiles WHERE lower(email) = ?`)
    .get(email.trim().toLowerCase()) as { id: string; password_hash: string } | undefined;

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = signToken(row.id);
  setSessionCookie(res, token);
  res.json({ token, user: hydrateProfile(row.id) });
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
  res.json({ user: hydrateProfile(req.userId!) });
});

// ---------------- REALTIME SSE STREAM ----------------

app.get('/api/realtime/stream', requireAuth, (req: AuthedRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const userId = req.userId!;
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId)!.add(res);

  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const keepalive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepalive);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepalive);
    sseClients.get(userId)?.delete(res);
  });
});

// ---------------- SKILLS & PROFILES ----------------

app.get('/api/skills', requireAuth, (_req: AuthedRequest, res: Response) => {
  const skills = db.prepare(`SELECT id, name, category FROM skills ORDER BY name ASC`).all();
  res.json({ skills });
});

app.get('/api/profiles/me', requireAuth, (req: AuthedRequest, res: Response) => {
  res.json({ profile: hydrateProfile(req.userId!) });
});

app.put('/api/profiles/me', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const {
    name,
    bio,
    avatar_url,
    preferred_method,
    weekly_availability,
    credits_per_30min,
    onboarding_completed,
    teachSkills,
    learnSkills,
  } = req.body as {
    name?: string;
    bio?: string;
    avatar_url?: string;
    preferred_method?: 'online' | 'in-person' | 'chat';
    weekly_availability?: string[];
    credits_per_30min?: number;
    onboarding_completed?: boolean;
    teachSkills?: Array<{ name: string; proficiency: string; description?: string }>;
    learnSkills?: Array<{ name: string; proficiency: string; description?: string }>;
  };

  db.transaction(() => {
    const current = db.prepare(`SELECT * FROM profiles WHERE id = ?`).get(userId) as any;
    const nextName = name?.trim() || current.name;
    const nextBio = bio !== undefined ? bio.trim() : current.bio;
    const nextAvatar = avatar_url !== undefined ? avatar_url : current.avatar_url;
    const nextMethod = preferred_method || current.preferred_method;
    const nextAvail = weekly_availability ? JSON.stringify(weekly_availability) : current.weekly_availability;
    const nextRate =
      credits_per_30min !== undefined
        ? Math.max(1, Math.min(10, Math.round(Number(credits_per_30min))))
        : current.credits_per_30min;
    const nextOnboarding = onboarding_completed !== undefined ? (onboarding_completed ? 1 : 0) : current.onboarding_completed;

    db.prepare(
      `UPDATE profiles
       SET name = ?, bio = ?, avatar_url = ?, preferred_method = ?, weekly_availability = ?,
           credits_per_30min = ?, onboarding_completed = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(nextName, nextBio, nextAvatar, nextMethod, nextAvail, nextRate, nextOnboarding, userId);

    if (Array.isArray(teachSkills)) {
      db.prepare(`DELETE FROM user_skills WHERE user_id = ? AND type = 'teach'`).run(userId);
      const insertUS = db.prepare(
        `INSERT OR REPLACE INTO user_skills (id, user_id, skill_id, type, proficiency, description)
         VALUES (?, ?, ?, 'teach', ?, ?)`
      );
      for (const s of teachSkills) {
        if (!s.name?.trim()) continue;
        const skillId = getOrCreateSkillId(s.name);
        insertUS.run(uid(), userId, skillId, s.proficiency || 'intermediate', s.description || '');
      }
    }

    if (Array.isArray(learnSkills)) {
      db.prepare(`DELETE FROM user_skills WHERE user_id = ? AND type = 'learn'`).run(userId);
      const insertUS = db.prepare(
        `INSERT OR REPLACE INTO user_skills (id, user_id, skill_id, type, proficiency, description)
         VALUES (?, ?, ?, 'learn', ?, ?)`
      );
      for (const s of learnSkills) {
        if (!s.name?.trim()) continue;
        const skillId = getOrCreateSkillId(s.name);
        insertUS.run(uid(), userId, skillId, s.proficiency || 'beginner', s.description || '');
      }
    }
  })();

  res.json({ profile: hydrateProfile(userId) });
});

app.post('/api/storage/avatars', requireAuth, (req: AuthedRequest, res: Response) => {
  const { dataUrl, fileName } = req.body as { dataUrl?: string; fileName?: string };
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    res.status(400).json({ error: 'Valid image file is required.' });
    return;
  }

  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!match) {
    res.status(400).json({ error: 'Supported image formats: PNG, JPG, WEBP.' });
    return;
  }

  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.byteLength > 4 * 1024 * 1024) {
    res.status(400).json({ error: 'Image must be smaller than 4 MB.' });
    return;
  }

  const safeName = `${req.userId}-${Date.now()}-${(fileName || 'avatar').replace(/[^a-z0-9]/gi, '').slice(0, 12)}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, safeName), buffer);
  const avatarUrl = `/uploads/avatars/${safeName}`;

  db.prepare(`UPDATE profiles SET avatar_url = ?, updated_at = datetime('now') WHERE id = ?`).run(avatarUrl, req.userId);
  res.json({ avatarUrl });
});

app.get('/api/profiles/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const profile = hydrateProfile(String(req.params.id));
  if (!profile) {
    res.status(404).json({ error: 'Profile not found.' });
    return;
  }
  res.json({ profile });
});

app.get('/api/explore', requireAuth, (req: AuthedRequest, res: Response) => {
  const q = ((req.query.q as string) || '').trim().toLowerCase();
  const proficiency = ((req.query.proficiency as string) || '').trim().toLowerCase();
  const availability = ((req.query.availability as string) || '').trim().toLowerCase();
  const method = ((req.query.method as string) || '').trim().toLowerCase();

  const ids = db
    .prepare(`SELECT id FROM profiles WHERE id <> ? ORDER BY name ASC`)
    .all(req.userId) as Array<{ id: string }>;

  let peers = ids.map((row) => hydrateProfile(row.id)).filter(Boolean) as any[];

  if (q) {
    peers = peers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.bio.toLowerCase().includes(q) ||
        p.teachSkills.some((s: any) => s.name.toLowerCase().includes(q)) ||
        p.learnSkills.some((s: any) => s.name.toLowerCase().includes(q))
    );
  }
  if (proficiency) {
    peers = peers.filter((p) => p.teachSkills.some((s: any) => s.proficiency.toLowerCase() === proficiency));
  }
  if (availability) {
    peers = peers.filter((p) =>
      p.weekly_availability.some((slot: string) => slot.toLowerCase().includes(availability))
    );
  }
  if (method) {
    peers = peers.filter((p) => p.preferred_method.toLowerCase() === method);
  }

  res.json({ peers });
});

// ---------------- AI MATCHES ----------------

app.get('/api/matches', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const meFull = hydrateProfile(req.userId!);
    if (!meFull) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const peerIds = db.prepare(`SELECT id FROM profiles WHERE id <> ?`).all(req.userId) as Array<{ id: string }>;
    const peersFull = peerIds.map((r) => hydrateProfile(r.id)).filter(Boolean) as any[];

    const toCandidate = (p: any): PeerCandidate => ({
      id: p.id,
      name: p.name,
      preferred_method: p.preferred_method,
      weekly_availability: p.weekly_availability,
      teachSkills: p.teachSkills.map((s: any) => ({ name: s.name, proficiency: s.proficiency })),
      learnSkills: p.learnSkills.map((s: any) => ({ name: s.name, proficiency: s.proficiency })),
      avgRating: p.avgRating,
    });

    const { mode, matches } = await generatePeerMatches(toCandidate(meFull), peersFull.map(toCandidate));
    const peerMap = new Map(peersFull.map((p) => [p.id, p]));

    const enriched = matches
      .map((m) => {
        const peer = peerMap.get(m.userId);
        if (!peer) return null;
        return {
          ...peer,
          matchScore: m.matchScore,
          why: m.why,
        };
      })
      .filter(Boolean);

    res.json({ mode, matches: enriched });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Failed to compute matches' });
  }
});

// ---------------- EXCHANGES & CREDIT WALLET ----------------

app.get('/api/exchanges', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;

  const requests = db
    .prepare(
      `SELECT er.*,
              sp.name AS sender_name, sp.avatar_url AS sender_avatar,
              rp.name AS receiver_name, rp.avatar_url AS receiver_avatar,
              os.name AS offered_skill_name,
              rs.name AS requested_skill_name
       FROM exchange_requests er
       JOIN profiles sp ON sp.id = er.sender_id
       JOIN profiles rp ON rp.id = er.receiver_id
       LEFT JOIN skills os ON os.id = er.offered_skill_id
       JOIN skills rs ON rs.id = er.requested_skill_id
       WHERE er.sender_id = ? OR er.receiver_id = ?
       ORDER BY er.created_at DESC`
    )
    .all(userId, userId);

  const exchanges = db
    .prepare(
      `SELECT e.*,
              tp.name AS teacher_name, tp.avatar_url AS teacher_avatar,
              lp.name AS learner_name, lp.avatar_url AS learner_avatar,
              st.name AS skill_taught_name,
              sl.name AS skill_learned_name,
              EXISTS(SELECT 1 FROM reviews r WHERE r.exchange_id = e.id AND r.reviewer_id = ?) AS user_has_reviewed
       FROM exchanges e
       JOIN profiles tp ON tp.id = e.teacher_id
       JOIN profiles lp ON lp.id = e.learner_id
       JOIN skills st ON st.id = e.skill_taught_id
       LEFT JOIN skills sl ON sl.id = e.skill_learned_id
       WHERE e.teacher_id = ? OR e.learner_id = ?
       ORDER BY e.created_at DESC`
    )
    .all(userId, userId, userId)
    .map((ex: any) => ({
      ...ex,
      teacher_confirmed: Boolean(ex.teacher_confirmed),
      learner_confirmed: Boolean(ex.learner_confirmed),
      user_has_reviewed: Boolean(ex.user_has_reviewed),
    }));

  res.json({ requests, exchanges });
});

app.post('/api/exchanges/requests', requireAuth, (req: AuthedRequest, res: Response) => {
  const senderId = req.userId!;
  const {
    receiverId,
    offeredSkillId,
    requestedSkillId,
    mode,
    durationMinutes,
    preferredMethod,
    proposedDate,
    message,
  } = req.body as {
    receiverId: string;
    offeredSkillId?: string | null;
    requestedSkillId: string;
    mode: 'swap' | 'credit';
    durationMinutes?: number;
    preferredMethod?: string;
    proposedDate?: string;
    message?: string;
  };

  if (!receiverId || !requestedSkillId || !mode) {
    res.status(400).json({ error: 'Receiver, requested skill, and exchange mode are required.' });
    return;
  }
  if (receiverId === senderId) {
    res.status(400).json({ error: 'You cannot send an exchange request to yourself.' });
    return;
  }
  if (mode === 'swap' && !offeredSkillId) {
    res.status(400).json({ error: 'Select a skill you will offer for a two-way swap.' });
    return;
  }

  const receiver = db.prepare(`SELECT id, name, credits_per_30min FROM profiles WHERE id = ?`).get(receiverId) as any;
  if (!receiver) {
    res.status(404).json({ error: 'Recipient user not found.' });
    return;
  }

  const duration = Math.max(15, Math.min(120, Number(durationMinutes) || 30));
  const ratePer30 = receiver.credits_per_30min || 1;
  const creditCost = mode === 'credit' ? Math.max(1, Math.ceil(duration / 30) * ratePer30) : 0;

  if (mode === 'credit') {
    const wallet = db.prepare(`SELECT balance FROM credit_wallets WHERE user_id = ?`).get(senderId) as { balance: number };
    if (!wallet || wallet.balance < creditCost) {
      res.status(400).json({
        error: `Insufficient credit balance. This session requires ${creditCost} credit(s), and your balance is ${wallet?.balance ?? 0}.`,
      });
      return;
    }
  }

  const id = uid();
  db.prepare(
    `INSERT INTO exchange_requests (id, sender_id, receiver_id, offered_skill_id, requested_skill_id, mode, credit_cost, duration_minutes, preferred_method, proposed_date, message, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
  ).run(
    id,
    senderId,
    receiverId,
    mode === 'swap' ? offeredSkillId : null,
    requestedSkillId,
    mode,
    creditCost,
    duration,
    preferredMethod || 'online',
    proposedDate || '',
    message || ''
  );

  const sender = db.prepare(`SELECT name FROM profiles WHERE id = ?`).get(senderId) as { name: string };
  const reqSkill = db.prepare(`SELECT name FROM skills WHERE id = ?`).get(requestedSkillId) as { name: string };

  createNotification(
    receiverId,
    'exchange_request',
    `New ${mode === 'swap' ? 'Skill Swap' : 'Credit'} Request from ${sender.name}`,
    `${sender.name} requested a ${duration}-min session in ${reqSkill?.name || 'a skill'}.`,
    '/exchanges'
  );

  res.status(201).json({ id, creditCost });
});

app.post('/api/exchanges/requests/:id/respond', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const requestId = String(req.params.id);
  const { action } = req.body as { action: 'accept' | 'reject' };

  const requestRow = db.prepare(`SELECT * FROM exchange_requests WHERE id = ?`).get(requestId) as any;
  if (!requestRow) {
    res.status(404).json({ error: 'Exchange request not found.' });
    return;
  }
  if (requestRow.receiver_id !== userId) {
    res.status(403).json({ error: 'Only the recipient can respond to this request.' });
    return;
  }
  if (requestRow.status !== 'pending') {
    res.status(400).json({ error: `Request has already been ${requestRow.status}.` });
    return;
  }

  const receiver = db.prepare(`SELECT name FROM profiles WHERE id = ?`).get(userId) as { name: string };

  if (action === 'reject') {
    db.prepare(`UPDATE exchange_requests SET status = 'rejected', updated_at = datetime('now') WHERE id = ?`).run(requestId);
    createNotification(
      requestRow.sender_id,
      'exchange_rejected',
      `Request declined by ${receiver.name}`,
      `${receiver.name} declined your exchange request.`,
      '/exchanges'
    );
    res.json({ status: 'rejected' });
    return;
  }

  if (action !== 'accept') {
    res.status(400).json({ error: 'Action must be accept or reject.' });
    return;
  }

  // Verify learner still has credits for credit exchanges
  if (requestRow.mode === 'credit' && requestRow.credit_cost > 0) {
    const learnerWallet = db.prepare(`SELECT balance FROM credit_wallets WHERE user_id = ?`).get(requestRow.sender_id) as {
      balance: number;
    };
    if (!learnerWallet || learnerWallet.balance < requestRow.credit_cost) {
      res.status(400).json({ error: 'Requester no longer has sufficient credits for this exchange.' });
      return;
    }
  }

  const exchangeId = uid();
  db.transaction(() => {
    db.prepare(`UPDATE exchange_requests SET status = 'accepted', updated_at = datetime('now') WHERE id = ?`).run(requestId);

    // receiver teaches requested_skill_id; sender learns it (and teaches offered_skill_id if swap)
    db.prepare(
      `INSERT INTO exchanges (id, request_id, teacher_id, learner_id, skill_taught_id, skill_learned_id, mode, credit_amount, duration_minutes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted')`
    ).run(
      exchangeId,
      requestId,
      requestRow.receiver_id,
      requestRow.sender_id,
      requestRow.requested_skill_id,
      requestRow.offered_skill_id || null,
      requestRow.mode,
      requestRow.credit_cost,
      requestRow.duration_minutes
    );

    const [p1, p2] = [requestRow.sender_id, requestRow.receiver_id].sort();
    db.prepare(`INSERT OR IGNORE INTO conversations (id, participant_one, participant_two) VALUES (?, ?, ?)`).run(uid(), p1, p2);

    createNotification(
      requestRow.sender_id,
      'exchange_accepted',
      `${receiver.name} accepted your request`,
      'Your skill exchange is active! You can now message and schedule your session.',
      '/exchanges'
    );
  })();

  res.json({ status: 'accepted', exchangeId });
});

app.post('/api/exchanges/:id/confirm-complete', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const exchangeId = String(req.params.id);
  const { projectNote } = (req.body || {}) as { projectNote?: string };

  try {
    const result = db.transaction(() => {
      const ex = db.prepare(`SELECT * FROM exchanges WHERE id = ?`).get(exchangeId) as any;
      if (!ex) throw new Error('NOT_FOUND');
      if (ex.teacher_id !== userId && ex.learner_id !== userId) throw new Error('FORBIDDEN');
      if (ex.status === 'completed') {
        return { status: 'completed', alreadySettled: true };
      }

      const isTeacher = ex.teacher_id === userId;
      let teacherConfirmed = Boolean(ex.teacher_confirmed);
      let learnerConfirmed = Boolean(ex.learner_confirmed);

      if (isTeacher) {
        teacherConfirmed = true;
        db.prepare(`UPDATE exchanges SET teacher_confirmed = 1, project_note = COALESCE(NULLIF(?, ''), project_note) WHERE id = ?`).run(
          projectNote || '',
          exchangeId
        );
      } else {
        learnerConfirmed = true;
        db.prepare(`UPDATE exchanges SET learner_confirmed = 1, project_note = COALESCE(NULLIF(?, ''), project_note) WHERE id = ?`).run(
          projectNote || '',
          exchangeId
        );
      }

      const partnerId = isTeacher ? ex.learner_id : ex.teacher_id;
      const actor = db.prepare(`SELECT name FROM profiles WHERE id = ?`).get(userId) as { name: string };

      if (!(teacherConfirmed && learnerConfirmed)) {
        createNotification(
          partnerId,
          'exchange_confirmation',
          `${actor.name} confirmed exchange completion`,
          'Please confirm completion on My Exchanges to finalize and release any credits.',
          '/exchanges'
        );
        return {
          status: 'awaiting_partner',
          teacherConfirmed,
          learnerConfirmed,
        };
      }

      // Both parties confirmed -> atomic, idempotent credit settlement
      if (ex.mode === 'credit' && ex.credit_amount > 0) {
        const learnerWallet = db.prepare(`SELECT * FROM credit_wallets WHERE user_id = ?`).get(ex.learner_id) as any;
        const teacherWallet = db.prepare(`SELECT * FROM credit_wallets WHERE user_id = ?`).get(ex.teacher_id) as any;

        if (!learnerWallet || learnerWallet.balance < ex.credit_amount) {
          throw new Error('INSUFFICIENT_CREDITS');
        }

        const existingSpend = db
          .prepare(`SELECT id FROM credit_transactions WHERE exchange_id = ? AND type = 'spend'`)
          .get(exchangeId);
        if (!existingSpend) {
          const newLearnerBal = learnerWallet.balance - ex.credit_amount;
          db.prepare(
            `UPDATE credit_wallets SET balance = ?, total_spent = total_spent + ?, updated_at = datetime('now') WHERE user_id = ?`
          ).run(newLearnerBal, ex.credit_amount, ex.learner_id);
          db.prepare(
            `INSERT INTO credit_transactions (id, wallet_user_id, exchange_id, type, amount, balance_after, description)
             VALUES (?, ?, ?, 'spend', ?, ?, ?)`
          ).run(uid(), ex.learner_id, exchangeId, -ex.credit_amount, newLearnerBal, `Paid for completed credit exchange`);
        }

        const existingEarn = db
          .prepare(`SELECT id FROM credit_transactions WHERE exchange_id = ? AND type = 'earn'`)
          .get(exchangeId);
        if (!existingEarn) {
          const newTeacherBal = teacherWallet.balance + ex.credit_amount;
          db.prepare(
            `UPDATE credit_wallets SET balance = ?, total_earned = total_earned + ?, updated_at = datetime('now') WHERE user_id = ?`
          ).run(newTeacherBal, ex.credit_amount, ex.teacher_id);
          db.prepare(
            `INSERT INTO credit_transactions (id, wallet_user_id, exchange_id, type, amount, balance_after, description)
             VALUES (?, ?, ?, 'earn', ?, ?, ?)`
          ).run(uid(), ex.teacher_id, exchangeId, ex.credit_amount, newTeacherBal, `Earned credits for completed teaching exchange`);
        }
      }

      db.prepare(`UPDATE exchanges SET status = 'completed', completed_at = datetime('now') WHERE id = ?`).run(exchangeId);

      const teacherBadges = awardBadgesForUser(ex.teacher_id);
      const learnerBadges = awardBadgesForUser(ex.learner_id);

      createNotification(
        ex.teacher_id,
        'credit',
        'Exchange Completed',
        ex.mode === 'credit'
          ? `Both parties confirmed. You earned +${ex.credit_amount} credit(s)!${teacherBadges.length ? ` Badge unlocked: ${teacherBadges.join(', ')}` : ''}`
          : `Both parties confirmed your swap!${teacherBadges.length ? ` Badge unlocked: ${teacherBadges.join(', ')}` : ''}`,
        '/exchanges'
      );
      createNotification(
        ex.learner_id,
        'credit',
        'Exchange Completed',
        `Both parties confirmed completion. You can now leave a peer review.${learnerBadges.length ? ` Badge unlocked: ${learnerBadges.join(', ')}` : ''}`,
        '/exchanges'
      );

      return { status: 'completed', alreadySettled: false };
    })();

    res.json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'NOT_FOUND') res.status(404).json({ error: 'Exchange not found.' });
    else if (msg === 'FORBIDDEN') res.status(403).json({ error: 'Not a participant of this exchange.' });
    else if (msg === 'INSUFFICIENT_CREDITS') res.status(400).json({ error: 'Learner does not have enough credits to settle this exchange.' });
    else res.status(500).json({ error: msg });
  }
});

app.get('/api/wallet', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const wallet = db.prepare(`SELECT * FROM credit_wallets WHERE user_id = ?`).get(userId);
  const profile = db.prepare(`SELECT credits_per_30min FROM profiles WHERE id = ?`).get(userId) as { credits_per_30min: number };
  const transactions = db
    .prepare(
      `SELECT id, exchange_id, type, amount, balance_after, description, created_at
       FROM credit_transactions
       WHERE wallet_user_id = ?
       ORDER BY created_at DESC`
    )
    .all(userId);

  res.json({
    wallet: wallet || { user_id: userId, balance: 0, total_earned: 0, total_spent: 0 },
    credits_per_30min: profile?.credits_per_30min ?? 1,
    transactions,
  });
});

app.patch('/api/wallet/rate', requireAuth, (req: AuthedRequest, res: Response) => {
  const rate = Math.max(1, Math.min(10, Math.round(Number(req.body.credits_per_30min) || 1)));
  db.prepare(`UPDATE profiles SET credits_per_30min = ?, updated_at = datetime('now') WHERE id = ?`).run(rate, req.userId);
  res.json({ credits_per_30min: rate });
});

// ---------------- MESSAGING ----------------

app.get('/api/conversations', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const convos = db
    .prepare(
      `SELECT c.id, c.participant_one, c.participant_two, c.updated_at,
              CASE WHEN c.participant_one = ? THEN p2.id ELSE p1.id END AS peer_id,
              CASE WHEN c.participant_one = ? THEN p2.name ELSE p1.name END AS peer_name,
              CASE WHEN c.participant_one = ? THEN p2.avatar_url ELSE p1.avatar_url END AS peer_avatar,
              (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
              (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id <> ? AND m.read_at IS NULL) AS unread_count
       FROM conversations c
       JOIN profiles p1 ON p1.id = c.participant_one
       JOIN profiles p2 ON p2.id = c.participant_two
       WHERE c.participant_one = ? OR c.participant_two = ?
       ORDER BY COALESCE(last_message_at, c.updated_at) DESC`
    )
    .all(userId, userId, userId, userId, userId, userId);

  res.json({ conversations: convos });
});

app.post('/api/conversations', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const { peerId } = req.body as { peerId?: string };
  if (!peerId || peerId === userId) {
    res.status(400).json({ error: 'Valid peerId is required.' });
    return;
  }
  const [p1, p2] = [userId, peerId].sort();
  let existing = db
    .prepare(`SELECT id FROM conversations WHERE participant_one = ? AND participant_two = ?`)
    .get(p1, p2) as { id: string } | undefined;

  if (!existing) {
    const id = uid();
    db.prepare(`INSERT INTO conversations (id, participant_one, participant_two) VALUES (?, ?, ?)`).run(id, p1, p2);
    existing = { id };
  }
  res.json({ conversationId: existing.id });
});

app.get('/api/conversations/:id/messages', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const convoId = String(req.params.id);
  const convo = db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(convoId) as any;
  if (!convo || (convo.participant_one !== userId && convo.participant_two !== userId)) {
    res.status(403).json({ error: 'Not a participant in this conversation.' });
    return;
  }

  db.prepare(`UPDATE messages SET read_at = datetime('now') WHERE conversation_id = ? AND sender_id <> ? AND read_at IS NULL`).run(
    convoId,
    userId
  );

  const messages = db
    .prepare(
      `SELECT m.*, p.name AS sender_name, p.avatar_url AS sender_avatar
       FROM messages m
       JOIN profiles p ON p.id = m.sender_id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC`
    )
    .all(convoId);

  res.json({ messages });
});

app.post('/api/conversations/:id/messages', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const convoId = String(req.params.id);
  const { content } = req.body as { content?: string };
  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Message cannot be empty.' });
    return;
  }

  const convo = db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(convoId) as any;
  if (!convo || (convo.participant_one !== userId && convo.participant_two !== userId)) {
    res.status(403).json({ error: 'Not a participant in this conversation.' });
    return;
  }

  const msgId = uid();
  db.prepare(`INSERT INTO messages (id, conversation_id, sender_id, content) VALUES (?, ?, ?, ?)`).run(
    msgId,
    convoId,
    userId,
    content.trim()
  );
  db.prepare(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`).run(convoId);

  const msg = db
    .prepare(
      `SELECT m.*, p.name AS sender_name, p.avatar_url AS sender_avatar
       FROM messages m
       JOIN profiles p ON p.id = m.sender_id
       WHERE m.id = ?`
    )
    .get(msgId) as any;

  const recipientId = convo.participant_one === userId ? convo.participant_two : convo.participant_one;
  pushRealtime(recipientId, 'message', msg);
  pushRealtime(userId, 'message', msg);

  createNotification(
    recipientId,
    'message',
    `New message from ${msg.sender_name}`,
    content.trim().slice(0, 120),
    '/messages'
  );

  res.status(201).json({ message: msg });
});

// ---------------- SESSIONS & MICRO-SESSIONS ----------------

app.get('/api/sessions', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const scope = (req.query.scope as string) || 'all';

  const rows = db
    .prepare(
      `SELECT s.*,
              hp.name AS host_name, hp.avatar_url AS host_avatar,
              gp.name AS guest_name, gp.avatar_url AS guest_avatar,
              sc.name AS circle_name,
              (SELECT COUNT(*) FROM session_participants sp WHERE sp.session_id = s.id) AS participant_count,
              EXISTS(SELECT 1 FROM session_participants sp WHERE sp.session_id = s.id AND sp.user_id = ?) AS user_joined
       FROM sessions s
       JOIN profiles hp ON hp.id = s.host_id
       LEFT JOIN profiles gp ON gp.id = s.guest_id
       LEFT JOIN skill_circles sc ON sc.id = s.circle_id
       WHERE (? = 'micro' AND s.is_micro = 1)
          OR (? <> 'micro' AND (s.host_id = ? OR s.guest_id = ? OR s.is_micro = 1 OR EXISTS(SELECT 1 FROM session_participants sp WHERE sp.session_id = s.id AND sp.user_id = ?)))
       ORDER BY s.scheduled_date ASC, s.start_time ASC`
    )
    .all(userId, scope, scope, userId, userId, userId)
    .map((s: any) => ({ ...s, is_micro: Boolean(s.is_micro), user_joined: Boolean(s.user_joined) }));

  res.json({ sessions: rows });
});

app.post('/api/sessions', requireAuth, (req: AuthedRequest, res: Response) => {
  const hostId = req.userId!;
  const {
    exchangeId,
    circleId,
    guestId,
    title,
    skillName,
    scheduledDate,
    startTime,
    durationMinutes,
    method,
    isMicro,
    maxParticipants,
    notes,
  } = req.body as any;

  if (!title?.trim() || !skillName?.trim() || !scheduledDate || !startTime) {
    res.status(400).json({ error: 'Title, skill, date, and start time are required.' });
    return;
  }
  const duration = Number(durationMinutes);
  const minDur = 15;
  const maxDur = isMicro ? 30 : 60;
  if (isNaN(duration) || duration < minDur || duration > maxDur) {
    res.status(400).json({
      error: isMicro ? 'Micro-skill sessions must be between 15 and 30 minutes.' : 'Sessions must be between 15 and 60 minutes.',
    });
    return;
  }

  const id = uid();
  const initialStatus = isMicro || circleId ? 'accepted' : guestId ? 'requested' : 'accepted';

  db.prepare(
    `INSERT INTO sessions (id, exchange_id, circle_id, host_id, guest_id, title, skill_name, scheduled_date, start_time, duration_minutes, method, status, is_micro, max_participants, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    exchangeId || null,
    circleId || null,
    hostId,
    guestId || null,
    title.trim(),
    skillName.trim(),
    scheduledDate,
    startTime,
    duration,
    method || 'online',
    initialStatus,
    isMicro ? 1 : 0,
    maxParticipants || (isMicro ? 6 : 2),
    notes || ''
  );

  if (guestId && guestId !== hostId) {
    const host = db.prepare(`SELECT name FROM profiles WHERE id = ?`).get(hostId) as { name: string };
    createNotification(
      guestId,
      'session',
      `Session Request from ${host.name}`,
      `${title.trim()} on ${scheduledDate} at ${startTime} (${duration} min).`,
      '/schedule'
    );
  }

  res.status(201).json({ id });
});

app.patch('/api/sessions/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const sessionId = String(req.params.id);
  const { status, scheduledDate, startTime, durationMinutes, method } = req.body as any;

  const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId) as any;
  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }
  if (session.host_id !== userId && session.guest_id !== userId) {
    res.status(403).json({ error: 'Only session participants can update this session.' });
    return;
  }

  const nextDate = scheduledDate || session.scheduled_date;
  const nextTime = startTime || session.start_time;
  const nextDuration = durationMinutes ? Math.max(15, Math.min(60, Number(durationMinutes))) : session.duration_minutes;
  const nextMethod = method || session.method;
  const nextStatus = status || session.status;

  db.prepare(
    `UPDATE sessions SET scheduled_date = ?, start_time = ?, duration_minutes = ?, method = ?, status = ? WHERE id = ?`
  ).run(nextDate, nextTime, nextDuration, nextMethod, nextStatus, sessionId);

  const otherId = session.host_id === userId ? session.guest_id : session.host_id;
  if (otherId) {
    const actor = db.prepare(`SELECT name FROM profiles WHERE id = ?`).get(userId) as { name: string };
    createNotification(
      otherId,
      'session',
      `Session ${nextStatus}: ${session.title}`,
      `${actor.name} updated session to ${nextDate} at ${nextTime} (${nextStatus}).`,
      '/schedule'
    );
  }

  res.json({ ok: true });
});

app.post('/api/sessions/:id/join', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const sessionId = String(req.params.id);
  const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId) as any;
  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }
  if (session.status === 'cancelled' || session.status === 'completed') {
    res.status(400).json({ error: 'Cannot join a closed session.' });
    return;
  }

  const countRow = db
    .prepare(`SELECT COUNT(*) AS cnt FROM session_participants WHERE session_id = ?`)
    .get(sessionId) as { cnt: number };
  if (countRow.cnt >= session.max_participants) {
    res.status(400).json({ error: 'This session is already at capacity.' });
    return;
  }

  db.prepare(`INSERT OR IGNORE INTO session_participants (id, session_id, user_id) VALUES (?, ?, ?)`).run(
    uid(),
    sessionId,
    userId
  );

  const user = db.prepare(`SELECT name FROM profiles WHERE id = ?`).get(userId) as { name: string };
  if (session.host_id !== userId) {
    createNotification(
      session.host_id,
      'session',
      `${user.name} joined your session`,
      `Joined "${session.title}" scheduled for ${session.scheduled_date}.`,
      '/micro-sessions'
    );
  }

  res.json({ joined: true });
});

// ---------------- REVIEWS & SKILL PASSPORT ----------------

app.post('/api/reviews', requireAuth, (req: AuthedRequest, res: Response) => {
  const reviewerId = req.userId!;
  const { exchangeId, revieweeId, rating, comment } = req.body as {
    exchangeId: string;
    revieweeId: string;
    rating: number;
    comment: string;
  };

  const ex = db.prepare(`SELECT * FROM exchanges WHERE id = ?`).get(exchangeId) as any;
  if (!ex || ex.status !== 'completed') {
    res.status(403).json({ error: 'Reviews are only allowed after an exchange is completed by both parties.' });
    return;
  }
  const validPair =
    (ex.teacher_id === reviewerId && ex.learner_id === revieweeId) ||
    (ex.learner_id === reviewerId && ex.teacher_id === revieweeId);
  if (!validPair) {
    res.status(403).json({ error: 'You can only review your partner from this completed exchange.' });
    return;
  }

  const numericRating = Math.max(1, Math.min(5, Math.round(Number(rating))));
  const existing = db
    .prepare(`SELECT id FROM reviews WHERE exchange_id = ? AND reviewer_id = ?`)
    .get(exchangeId, reviewerId);
  if (existing) {
    res.status(409).json({ error: 'You have already reviewed this exchange.' });
    return;
  }

  db.prepare(
    `INSERT INTO reviews (id, exchange_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(uid(), exchangeId, reviewerId, revieweeId, numericRating, (comment || '').trim());

  const newBadges = awardBadgesForUser(revieweeId);
  const reviewer = db.prepare(`SELECT name FROM profiles WHERE id = ?`).get(reviewerId) as { name: string };

  createNotification(
    revieweeId,
    'review',
    `New ${numericRating}-Star Review from ${reviewer.name}`,
    comment ? `"${comment.slice(0, 100)}"` : 'Check your Skill Passport for updated peer feedback.',
    '/passport'
  );

  res.status(201).json({ ok: true, newBadges });
});

app.get('/api/passport', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const profile = hydrateProfile(userId);
  const completedExchanges = db
    .prepare(
      `SELECT e.*,
              tp.name AS teacher_name, lp.name AS learner_name,
              st.name AS skill_taught_name, sl.name AS skill_learned_name
       FROM exchanges e
       JOIN profiles tp ON tp.id = e.teacher_id
       JOIN profiles lp ON lp.id = e.learner_id
       JOIN skills st ON st.id = e.skill_taught_id
       LEFT JOIN skills sl ON sl.id = e.skill_learned_id
       WHERE e.status = 'completed' AND (e.teacher_id = ? OR e.learner_id = ?)
       ORDER BY e.completed_at DESC`
    )
    .all(userId, userId);

  const milestonesCompleted = db
    .prepare(
      `SELECT rm.id, rm.title, rm.week_label, rm.completed_at, r.skill_name
       FROM roadmap_milestones rm
       JOIN roadmaps r ON r.id = rm.roadmap_id
       WHERE r.user_id = ? AND rm.completed = 1
       ORDER BY rm.completed_at DESC`
    )
    .all(userId);

  const allBadgeDefs = [
    { key: 'first_skill_shared', name: 'First Skill Shared', description: 'Complete 1 teaching exchange.' },
    { key: 'first_skill_learned', name: 'First Skill Learned', description: 'Complete 1 learning exchange.' },
    { key: 'knowledge_sharer', name: 'Knowledge Sharer', description: 'Complete 3+ teaching exchanges.' },
    { key: 'active_learner', name: 'Active Learner', description: 'Complete 3+ learning exchanges.' },
    { key: 'community_mentor', name: 'Community Mentor', description: '5+ completed exchanges with 4.5+ average rating.' },
  ];

  res.json({
    profile,
    completedExchanges,
    milestonesCompleted,
    allBadgeDefs,
  });
});

// ---------------- GROUP SKILL CIRCLES ----------------

app.get('/api/circles', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const circles = db
    .prepare(
      `SELECT sc.*, p.name AS creator_name
       FROM skill_circles sc
       JOIN profiles p ON p.id = sc.creator_id
       ORDER BY sc.created_at DESC`
    )
    .all() as any[];

  const hydrated = circles.map((c) => {
    const members = db
      .prepare(
        `SELECT gm.*, p.name, p.avatar_url
         FROM group_memberships gm
         JOIN profiles p ON p.id = gm.user_id
         WHERE gm.circle_id = ?
         ORDER BY gm.role DESC, gm.joined_at ASC`
      )
      .all(c.id) as any[];

    const sessions = db
      .prepare(
        `SELECT s.*, p.name AS host_name
         FROM sessions s
         JOIN profiles p ON p.id = s.host_id
         WHERE s.circle_id = ? AND s.status <> 'cancelled'
         ORDER BY s.scheduled_date ASC`
      )
      .all(c.id);

    const isMember = members.some((m) => m.user_id === userId);
    return { ...c, members, sessions, isMember };
  });

  res.json({ circles: hydrated });
});

app.post('/api/circles', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const { name, description, focusSkill, teachingSkill, maxMembers } = req.body as any;
  if (!name?.trim() || !focusSkill?.trim()) {
    res.status(400).json({ error: 'Circle name and focus skill are required.' });
    return;
  }

  const circleId = uid();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO skill_circles (id, name, description, focus_skill, creator_id, max_members)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(circleId, name.trim(), (description || '').trim(), focusSkill.trim(), userId, Math.max(2, Math.min(50, Number(maxMembers) || 12)));

    db.prepare(
      `INSERT INTO group_memberships (id, circle_id, user_id, role, teaching_skill) VALUES (?, ?, ?, 'organizer', ?)`
    ).run(uid(), circleId, userId, (teachingSkill || focusSkill).trim());
  })();

  res.status(201).json({ id: circleId });
});

app.post('/api/circles/:id/join', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const circleId = String(req.params.id);
  const { teachingSkill } = (req.body || {}) as { teachingSkill?: string };

  const circle = db.prepare(`SELECT * FROM skill_circles WHERE id = ?`).get(circleId) as any;
  if (!circle) {
    res.status(404).json({ error: 'Circle not found.' });
    return;
  }

  const memberCount = db.prepare(`SELECT COUNT(*) AS cnt FROM group_memberships WHERE circle_id = ?`).get(circleId) as { cnt: number };
  if (memberCount.cnt >= circle.max_members) {
    res.status(400).json({ error: 'This Skill Circle is full.' });
    return;
  }

  db.prepare(
    `INSERT OR IGNORE INTO group_memberships (id, circle_id, user_id, role, teaching_skill) VALUES (?, ?, ?, 'member', ?)`
  ).run(uid(), circleId, userId, (teachingSkill || '').trim());

  const user = db.prepare(`SELECT name FROM profiles WHERE id = ?`).get(userId) as { name: string };
  if (circle.creator_id !== userId) {
    createNotification(
      circle.creator_id,
      'group_invite',
      `${user.name} joined ${circle.name}`,
      teachingSkill ? `Offering to teach: ${teachingSkill}` : 'New member joined your Skill Circle.',
      '/circles'
    );
  }

  res.json({ joined: true });
});

app.post('/api/circles/:id/leave', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const circleId = String(req.params.id);
  db.prepare(`DELETE FROM group_memberships WHERE circle_id = ? AND user_id = ?`).run(circleId, userId);
  res.json({ left: true });
});

app.post('/api/circles/:id/invite', requireAuth, (req: AuthedRequest, res: Response) => {
  const inviterId = req.userId!;
  const circleId = String(req.params.id);
  const { targetUserId } = req.body as { targetUserId?: string };
  if (!targetUserId) {
    res.status(400).json({ error: 'Select a peer to invite.' });
    return;
  }
  const circle = db.prepare(`SELECT name FROM skill_circles WHERE id = ?`).get(circleId) as { name: string } | undefined;
  const inviter = db.prepare(`SELECT name FROM profiles WHERE id = ?`).get(inviterId) as { name: string };
  if (!circle) {
    res.status(404).json({ error: 'Circle not found.' });
    return;
  }

  createNotification(
    targetUserId,
    'group_invite',
    `Invitation to join "${circle.name}"`,
    `${inviter.name} invited you to join their Skill Circle.`,
    '/circles'
  );
  res.json({ invited: true });
});

app.post('/api/circles/:id/sessions', requireAuth, (req: AuthedRequest, res: Response) => {
  const hostId = req.userId!;
  const circleId = String(req.params.id);
  const { title, skillName, scheduledDate, startTime, durationMinutes, method, notes } = req.body as any;

  const isMember = db
    .prepare(`SELECT id FROM group_memberships WHERE circle_id = ? AND user_id = ?`)
    .get(circleId, hostId);
  if (!isMember) {
    res.status(403).json({ error: 'Join the circle before scheduling a group session.' });
    return;
  }

  const duration = Math.max(15, Math.min(60, Number(durationMinutes) || 45));
  const id = uid();
  db.prepare(
    `INSERT INTO sessions (id, circle_id, host_id, title, skill_name, scheduled_date, start_time, duration_minutes, method, status, is_micro, max_participants, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted', 0, 20, ?)`
  ).run(id, circleId, hostId, title.trim(), skillName.trim(), scheduledDate, startTime, duration, method || 'online', notes || '');

  const members = db
    .prepare(`SELECT user_id FROM group_memberships WHERE circle_id = ? AND user_id <> ?`)
    .all(circleId, hostId) as Array<{ user_id: string }>;
  const circle = db.prepare(`SELECT name FROM skill_circles WHERE id = ?`).get(circleId) as { name: string };
  for (const m of members) {
    createNotification(
      m.user_id,
      'session',
      `New Group Session in ${circle.name}`,
      `${title.trim()} (${skillName.trim()}) on ${scheduledDate} at ${startTime}.`,
      '/circles'
    );
  }

  res.status(201).json({ id });
});

// ---------------- LEARNING ROADMAPS ----------------

app.get('/api/roadmaps', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const roadmaps = db
    .prepare(`SELECT * FROM roadmaps WHERE user_id = ? ORDER BY created_at DESC`)
    .all(userId) as any[];

  const hydrated = roadmaps.map((rm) => {
    const milestones = db
      .prepare(`SELECT * FROM roadmap_milestones WHERE roadmap_id = ? ORDER BY stage_index ASC`)
      .all(rm.id)
      .map((m: any) => ({
        ...m,
        topics: JSON.parse(m.topics || '[]'),
        completed: Boolean(m.completed),
      }));
    return { ...rm, milestones };
  });

  res.json({ roadmaps: hydrated });
});

app.post('/api/roadmaps/generate', requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const { skill, currentLevel, targetLevel, weeklyHours } = req.body as {
    skill: string;
    currentLevel: string;
    targetLevel: string;
    weeklyHours: number;
  };

  if (!skill?.trim()) {
    res.status(400).json({ error: 'Skill name is required.' });
    return;
  }

  const hours = Math.max(1, Math.min(40, Number(weeklyHours) || 4));
  const partnerRows = db
    .prepare(
      `SELECT DISTINCT p.name
       FROM profiles p
       JOIN user_skills us ON us.user_id = p.id
       JOIN skills s ON s.id = us.skill_id
       WHERE p.id <> ? AND us.type = 'teach' AND lower(s.name) LIKE ?
       LIMIT 3`
    )
    .all(userId, `%${skill.trim().toLowerCase()}%`) as Array<{ name: string }>;

  const recommendedPartners = partnerRows.map((r) => r.name);
  const draft = await generateLearningRoadmap(
    skill.trim(),
    currentLevel || 'beginner',
    targetLevel || 'intermediate',
    hours,
    recommendedPartners
  );

  const roadmapId = uid();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO roadmaps (id, user_id, skill_name, current_level, target_level, weekly_hours, ai_mode, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(roadmapId, userId, skill.trim(), currentLevel || 'beginner', targetLevel || 'intermediate', hours, draft.mode, draft.summary);

    const insertM = db.prepare(
      `INSERT INTO roadmap_milestones (id, roadmap_id, stage_index, week_label, title, topics, suggested_session, partner_hint, completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
    );
    for (const m of draft.milestones) {
      insertM.run(
        uid(),
        roadmapId,
        m.stageIndex,
        m.weekLabel,
        m.title,
        JSON.stringify(m.topics || []),
        m.suggestedSession,
        m.partnerHint || ''
      );
    }
  })();

  const created = db.prepare(`SELECT * FROM roadmaps WHERE id = ?`).get(roadmapId) as any;
  const milestones = db
    .prepare(`SELECT * FROM roadmap_milestones WHERE roadmap_id = ? ORDER BY stage_index ASC`)
    .all(roadmapId)
    .map((m: any) => ({ ...m, topics: JSON.parse(m.topics || '[]'), completed: Boolean(m.completed) }));

  res.status(201).json({ roadmap: { ...created, milestones } });
});

app.patch('/api/roadmaps/milestones/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const milestoneId = String(req.params.id);
  const { completed } = req.body as { completed: boolean };

  const row = db
    .prepare(
      `SELECT rm.id FROM roadmap_milestones rm
       JOIN roadmaps r ON r.id = rm.roadmap_id
       WHERE rm.id = ? AND r.user_id = ?`
    )
    .get(milestoneId, userId);

  if (!row) {
    res.status(404).json({ error: 'Milestone not found.' });
    return;
  }

  db.prepare(`UPDATE roadmap_milestones SET completed = ?, completed_at = ? WHERE id = ?`).run(
    completed ? 1 : 0,
    completed ? new Date().toISOString() : null,
    milestoneId
  );

  res.json({ ok: true, completed: Boolean(completed) });
});

app.delete('/api/roadmaps/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  db.prepare(`DELETE FROM roadmaps WHERE id = ? AND user_id = ?`).run(String(req.params.id), req.userId);
  res.json({ deleted: true });
});

// ---------------- NOTIFICATIONS & DASHBOARD ----------------

app.get('/api/notifications', requireAuth, (req: AuthedRequest, res: Response) => {
  const notifications = db
    .prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`)
    .all(req.userId)
    .map((n: any) => ({ ...n, is_read: Boolean(n.is_read) }));
  res.json({ notifications });
});

app.patch('/api/notifications/:id/read', requireAuth, (req: AuthedRequest, res: Response) => {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`).run(String(req.params.id), req.userId);
  res.json({ ok: true });
});

app.post('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res: Response) => {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(req.userId);
  res.json({ ok: true });
});

app.get('/api/dashboard', requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const profile = hydrateProfile(userId);
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  // Profile completion calculation
  let completion = 20; // name + email
  if (profile.bio?.trim().length > 10) completion += 15;
  if (profile.avatar_url) completion += 10;
  if (profile.teachSkills.length > 0) completion += 20;
  if (profile.learnSkills.length > 0) completion += 20;
  if (profile.weekly_availability.length > 0) completion += 15;

  const upcomingSessions = db
    .prepare(
      `SELECT s.*, hp.name AS host_name, gp.name AS guest_name
       FROM sessions s
       JOIN profiles hp ON hp.id = s.host_id
       LEFT JOIN profiles gp ON gp.id = s.guest_id
       WHERE (s.host_id = ? OR s.guest_id = ? OR EXISTS(SELECT 1 FROM session_participants sp WHERE sp.session_id = s.id AND sp.user_id = ?))
         AND s.status IN ('requested', 'accepted', 'rescheduled')
       ORDER BY s.scheduled_date ASC, s.start_time ASC
       LIMIT 4`
    )
    .all(userId, userId, userId);

  const pendingRequests = db
    .prepare(
      `SELECT er.*, sp.name AS sender_name, rp.name AS receiver_name, rs.name AS requested_skill_name
       FROM exchange_requests er
       JOIN profiles sp ON sp.id = er.sender_id
       JOIN profiles rp ON rp.id = er.receiver_id
       JOIN skills rs ON rs.id = er.requested_skill_id
       WHERE (er.receiver_id = ? OR er.sender_id = ?) AND er.status = 'pending'
       ORDER BY er.created_at DESC
       LIMIT 4`
    )
    .all(userId, userId);

  const recentMessages = db
    .prepare(
      `SELECT c.id AS conversation_id,
              CASE WHEN c.participant_one = ? THEN p2.name ELSE p1.name END AS peer_name,
              CASE WHEN c.participant_one = ? THEN p2.avatar_url ELSE p1.avatar_url END AS peer_avatar,
              m.content, m.created_at
       FROM conversations c
       JOIN profiles p1 ON p1.id = c.participant_one
       JOIN profiles p2 ON p2.id = c.participant_two
       JOIN messages m ON m.id = (SELECT id FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1)
       WHERE c.participant_one = ? OR c.participant_two = ?
       ORDER BY m.created_at DESC
       LIMIT 3`
    )
    .all(userId, userId, userId, userId);

  const roadmaps = db.prepare(`SELECT id, skill_name, target_level FROM roadmaps WHERE user_id = ? ORDER BY created_at DESC LIMIT 3`).all(userId) as any[];
  const roadmapProgress = roadmaps.map((rm) => {
    const stats = db
      .prepare(`SELECT COUNT(*) AS total, SUM(completed) AS done FROM roadmap_milestones WHERE roadmap_id = ?`)
      .get(rm.id) as { total: number; done: number | null };
    const total = stats.total || 0;
    const done = stats.done || 0;
    return {
      ...rm,
      total,
      done,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  });

  // Top 3 matches using rule-based fast scorer on dashboard (AI Matches page triggers full Gemini scoring)
  const peerIds = db.prepare(`SELECT id FROM profiles WHERE id <> ?`).all(userId) as Array<{ id: string }>;
  const peers = peerIds.map((r) => hydrateProfile(r.id)).filter(Boolean) as any[];
  const { ruleBasedMatch } = await import('./server/ai.ts');
  const scored = ruleBasedMatch(
    {
      id: profile.id,
      name: profile.name,
      preferred_method: profile.preferred_method,
      weekly_availability: profile.weekly_availability,
      teachSkills: profile.teachSkills,
      learnSkills: profile.learnSkills,
      avgRating: profile.avgRating,
    },
    peers.map((p) => ({
      id: p.id,
      name: p.name,
      preferred_method: p.preferred_method,
      weekly_availability: p.weekly_availability,
      teachSkills: p.teachSkills,
      learnSkills: p.learnSkills,
      avgRating: p.avgRating,
    }))
  );
  const topMatches = scored.slice(0, 3).map((s) => ({
    ...peers.find((p) => p.id === s.userId),
    matchScore: s.matchScore,
    why: s.why,
  }));

  res.json({
    profile,
    profileCompletion: Math.min(100, completion),
    upcomingSessions,
    pendingRequests,
    recentMessages,
    roadmapProgress,
    topMatches,
  });
});

// ---------------- VITE / STATIC SERVING ----------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SkillSwap full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
