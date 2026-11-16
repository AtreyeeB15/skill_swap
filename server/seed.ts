import bcrypt from 'bcryptjs';
import { db, uid, awardBadgesForUser } from './db.ts';

export function seedIfEmpty(): void {
  const existing = db.prepare('SELECT COUNT(*) AS cnt FROM profiles').get() as { cnt: number };
  if (existing.cnt > 0) return;

  const passwordHash = bcrypt.hashSync('SkillSwap123!', 10);

  const skillsData = [
    { id: 'skill-react', name: 'React & TypeScript', category: 'Software Engineering' },
    { id: 'skill-figma', name: 'UI/UX Design (Figma)', category: 'Design' },
    { id: 'skill-python', name: 'Python & Data Science', category: 'Data & AI' },
    { id: 'skill-guitar', name: 'Acoustic Guitar', category: 'Music' },
    { id: 'skill-spanish', name: 'Conversational Spanish', category: 'Languages' },
    { id: 'skill-speaking', name: 'Public Speaking', category: 'Communication' },
    { id: 'skill-sql', name: 'SQL & Database Design', category: 'Software Engineering' },
    { id: 'skill-photo', name: 'Digital Photography', category: 'Creative Arts' },
    { id: 'skill-math', name: 'Calculus & Linear Algebra', category: 'Mathematics' },
    { id: 'skill-video', name: 'Video Editing (Premiere)', category: 'Media' },
  ];

  const insertSkill = db.prepare('INSERT INTO skills (id, name, category) VALUES (?, ?, ?)');
  for (const s of skillsData) {
    insertSkill.run(s.id, s.name, s.category);
  }

  const users = [
    {
      id: 'user-maya',
      name: 'Maya Lin',
      email: 'maya@skillswap.edu',
      avatar_url: '/src/assets/images/avatar_maya_1794833153780.jpg',
      bio: 'CS & HCI senior building accessible design systems. Happy to trade React mentoring for acoustic guitar or conversational Spanish.',
      preferred_method: 'online',
      weekly_availability: JSON.stringify(['Mon Eve', 'Wed Eve', 'Sat Morn']),
      credits_per_30min: 1,
      balance: 8,
      earned: 10,
      spent: 2,
      teach: [
        { skillId: 'skill-react', proficiency: 'expert', desc: 'Hooks, state architecture, and TypeScript patterns' },
        { skillId: 'skill-figma', proficiency: 'advanced', desc: 'Component libraries and interactive prototypes' },
      ],
      learn: [
        { skillId: 'skill-guitar', proficiency: 'beginner', desc: 'Fingerpicking basics and chord transitions' },
        { skillId: 'skill-spanish', proficiency: 'intermediate', desc: 'Everyday conversation fluency' },
      ],
    },
    {
      id: 'user-marcus',
      name: 'Marcus Vance',
      email: 'marcus@skillswap.edu',
      avatar_url: '/src/assets/images/avatar_marcus_1794833155485.jpg',
      bio: 'Audio engineering junior and campus acoustic guitarist. Looking to level up React, TypeScript, and SQL for portfolio projects.',
      preferred_method: 'in-person',
      weekly_availability: JSON.stringify(['Mon Eve', 'Tue Eve', 'Sat Morn']),
      credits_per_30min: 1,
      balance: 7,
      earned: 8,
      spent: 1,
      teach: [
        { skillId: 'skill-guitar', proficiency: 'expert', desc: 'Rhythm, fingerstyle, and songwriting accompaniment' },
        { skillId: 'skill-video', proficiency: 'intermediate', desc: 'Color grading and clean audio sync' },
      ],
      learn: [
        { skillId: 'skill-react', proficiency: 'beginner', desc: 'Building interactive web components' },
        { skillId: 'skill-sql', proficiency: 'beginner', desc: 'Joins, schemas, and query optimization' },
      ],
    },
    {
      id: 'user-priya',
      name: 'Priya Nair',
      email: 'priya@skillswap.edu',
      avatar_url: '/src/assets/images/avatar_priya_1794833155344.jpg',
      bio: 'Applied Statistics & ML grad student. Love breaking down Python notebooks, Pandas workflows, and linear algebra intuition.',
      preferred_method: 'online',
      weekly_availability: JSON.stringify(['Mon Eve', 'Thu Eve', 'Sun Aft']),
      credits_per_30min: 1,
      balance: 9,
      earned: 11,
      spent: 2,
      teach: [
        { skillId: 'skill-python', proficiency: 'expert', desc: 'Pandas, scikit-learn, and clean research code' },
        { skillId: 'skill-math', proficiency: 'expert', desc: 'Eigenvalues, matrix calculus, and exam prep' },
      ],
      learn: [
        { skillId: 'skill-speaking', proficiency: 'intermediate', desc: 'Conference talk pacing and storytelling' },
        { skillId: 'skill-figma', proficiency: 'beginner', desc: 'Research poster and dashboard layouts' },
      ],
    },
    {
      id: 'user-leo',
      name: 'Leo Morales',
      email: 'leo@skillswap.edu',
      avatar_url: '/src/assets/images/avatar_leo_1794833155252.jpg',
      bio: 'Bilingual journalism major and campus photographer. Teaching natural Spanish conversation and manual camera framing.',
      preferred_method: 'online',
      weekly_availability: JSON.stringify(['Wed Eve', 'Fri Aft', 'Sat Morn']),
      credits_per_30min: 1,
      balance: 6,
      earned: 7,
      spent: 1,
      teach: [
        { skillId: 'skill-spanish', proficiency: 'expert', desc: 'Natural idioms, pronunciation, and real-world dialogue' },
        { skillId: 'skill-photo', proficiency: 'advanced', desc: 'Manual exposure, composition, and Lightroom' },
      ],
      learn: [
        { skillId: 'skill-react', proficiency: 'beginner', desc: 'Custom portfolio site in React' },
        { skillId: 'skill-python', proficiency: 'beginner', desc: 'Data scraping for journalism stories' },
      ],
    },
    {
      id: 'user-elena',
      name: 'Elena Rostova',
      email: 'elena@skillswap.edu',
      avatar_url: '',
      bio: 'Debate club president and architecture student. Coaching persuasive pitch decks and Figma visual storytelling.',
      preferred_method: 'in-person',
      weekly_availability: JSON.stringify(['Tue Eve', 'Thu Eve', 'Sun Aft']),
      credits_per_30min: 2,
      balance: 5,
      earned: 6,
      spent: 1,
      teach: [
        { skillId: 'skill-speaking', proficiency: 'expert', desc: 'Executive presence, pitch pacing, and Q&A handling' },
        { skillId: 'skill-figma', proficiency: 'advanced', desc: 'Editorial presentation systems' },
      ],
      learn: [
        { skillId: 'skill-photo', proficiency: 'intermediate', desc: 'Architectural daylight photography' },
        { skillId: 'skill-sql', proficiency: 'beginner', desc: 'Database fundamentals' },
      ],
    },
    {
      id: 'user-sam',
      name: 'Samir Patel',
      email: 'samir@skillswap.edu',
      avatar_url: '',
      bio: 'Backend engineering senior obsessed with PostgreSQL indexing, query plans, and clean API schemas.',
      preferred_method: 'chat',
      weekly_availability: JSON.stringify(['Mon Eve', 'Wed Eve', 'Fri Aft']),
      credits_per_30min: 1,
      balance: 7,
      earned: 8,
      spent: 1,
      teach: [
        { skillId: 'skill-sql', proficiency: 'expert', desc: 'Relational modeling, RLS policies, and transactions' },
        { skillId: 'skill-python', proficiency: 'advanced', desc: 'FastAPI services and automated testing' },
      ],
      learn: [
        { skillId: 'skill-guitar', proficiency: 'beginner', desc: 'Basic campfire chords' },
        { skillId: 'skill-speaking', proficiency: 'intermediate', desc: 'Technical demo clarity' },
      ],
    },
    {
      id: 'user-chloe',
      name: 'Chloe Bennett',
      email: 'chloe@skillswap.edu',
      avatar_url: '',
      bio: 'Film & digital media junior editing campus documentaries. Always down to swap Premiere workflows for math tutoring.',
      preferred_method: 'online',
      weekly_availability: JSON.stringify(['Tue Eve', 'Fri Aft', 'Sat Morn']),
      credits_per_30min: 1,
      balance: 5,
      earned: 5,
      spent: 0,
      teach: [
        { skillId: 'skill-video', proficiency: 'expert', desc: 'Pacing, sound design, and multi-cam timelines' },
        { skillId: 'skill-photo', proficiency: 'advanced', desc: 'Portrait lighting on a budget' },
      ],
      learn: [
        { skillId: 'skill-math', proficiency: 'beginner', desc: 'Linear algebra for 3D graphics' },
        { skillId: 'skill-figma', proficiency: 'intermediate', desc: 'Motion storyboards' },
      ],
    },
    {
      id: 'user-devon',
      name: 'Devon Brooks',
      email: 'devon@skillswap.edu',
      avatar_url: '',
      bio: 'Mathematics honors student and peer tutor. Making multivariable calculus and linear algebra intuitive.',
      preferred_method: 'online',
      weekly_availability: JSON.stringify(['Mon Eve', 'Thu Eve', 'Sat Morn']),
      credits_per_30min: 1,
      balance: 6,
      earned: 7,
      spent: 1,
      teach: [
        { skillId: 'skill-math', proficiency: 'expert', desc: 'Proof intuition, vector spaces, and integrals' },
      ],
      learn: [
        { skillId: 'skill-spanish', proficiency: 'beginner', desc: 'Travel & campus conversation' },
        { skillId: 'skill-react', proficiency: 'intermediate', desc: 'Interactive math visualizations' },
      ],
    },
    {
      id: 'user-nina',
      name: 'Nina Alvarez',
      email: 'nina@skillswap.edu',
      avatar_url: '',
      bio: 'Product design fellow focusing on rapid UX research and user testing.',
      preferred_method: 'online',
      weekly_availability: JSON.stringify(['Wed Eve', 'Thu Eve', 'Sun Aft']),
      credits_per_30min: 1,
      balance: 5,
      earned: 5,
      spent: 0,
      teach: [
        { skillId: 'skill-figma', proficiency: 'expert', desc: 'Auto-layout, design tokens, and usability testing' },
      ],
      learn: [
        { skillId: 'skill-python', proficiency: 'beginner', desc: 'Analyzing survey CSVs in Python' },
        { skillId: 'skill-video', proficiency: 'beginner', desc: 'Short product demo reels' },
      ],
    },
  ];

  const insertProfile = db.prepare(`
    INSERT INTO profiles (id, name, email, password_hash, avatar_url, bio, preferred_method, weekly_availability, credits_per_30min, onboarding_completed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const insertWallet = db.prepare(`
    INSERT INTO credit_wallets (user_id, balance, total_earned, total_spent) VALUES (?, ?, ?, ?)
  `);
  const insertUserSkill = db.prepare(`
    INSERT INTO user_skills (id, user_id, skill_id, type, proficiency, description) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertTx = db.prepare(`
    INSERT INTO credit_transactions (id, wallet_user_id, exchange_id, type, amount, balance_after, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const u of users) {
    insertProfile.run(u.id, u.name, u.email, passwordHash, u.avatar_url, u.bio, u.preferred_method, u.weekly_availability, u.credits_per_30min);
    insertWallet.run(u.id, u.balance, u.earned, u.spent);
    insertTx.run(uid(), u.id, null, 'initial_grant', 5, 5, 'Welcome starter credits');

    for (const t of u.teach) {
      insertUserSkill.run(uid(), u.id, t.skillId, 'teach', t.proficiency, t.desc);
    }
    for (const l of u.learn) {
      insertUserSkill.run(uid(), u.id, l.skillId, 'learn', l.proficiency, l.desc);
    }
  }

  // Sample completed exchange (Maya taught Priya UI/UX Design; Priya taught Maya Data Viz/Python concepts - swap)
  const req1 = 'req-seed-1';
  const ex1 = 'ex-seed-1';
  db.prepare(`
    INSERT INTO exchange_requests (id, sender_id, receiver_id, offered_skill_id, requested_skill_id, mode, credit_cost, duration_minutes, preferred_method, proposed_date, message, status)
    VALUES (?, 'user-maya', 'user-priya', 'skill-figma', 'skill-python', 'swap', 0, 45, 'online', '2026-11-10', 'Would love to trade Figma layout feedback for Python Pandas tips!', 'accepted')
  `).run(req1);

  db.prepare(`
    INSERT INTO exchanges (id, request_id, teacher_id, learner_id, skill_taught_id, skill_learned_id, mode, credit_amount, duration_minutes, status, teacher_confirmed, learner_confirmed, project_note, completed_at)
    VALUES (?, ?, 'user-priya', 'user-maya', 'skill-python', 'skill-figma', 'swap', 0, 45, 'completed', 1, 1, 'Built a clean Pandas notebook + Figma research poster layout.', datetime('now', '-3 days'))
  `).run(ex1, req1);

  // Sample completed credit exchange (Marcus taught Maya Acoustic Guitar -> Maya spent 1, Marcus earned 1)
  const req2 = 'req-seed-2';
  const ex2 = 'ex-seed-2';
  db.prepare(`
    INSERT INTO exchange_requests (id, sender_id, receiver_id, offered_skill_id, requested_skill_id, mode, credit_cost, duration_minutes, preferred_method, proposed_date, message, status)
    VALUES (?, 'user-maya', 'user-marcus', NULL, 'skill-guitar', 'credit', 1, 30, 'in-person', '2026-11-12', 'Booking a 30-min acoustic fingerpicking session!', 'accepted')
  `).run(req2);

  db.prepare(`
    INSERT INTO exchanges (id, request_id, teacher_id, learner_id, skill_taught_id, skill_learned_id, mode, credit_amount, duration_minutes, status, teacher_confirmed, learner_confirmed, project_note, completed_at)
    VALUES (?, ?, 'user-marcus', 'user-maya', 'skill-guitar', NULL, 'credit', 1, 30, 'completed', 1, 1, 'Mastered Travis picking pattern C-G-Am-F.', datetime('now', '-1 days'))
  `).run(ex2, req2);

  insertTx.run(uid(), 'user-maya', ex2, 'spend', -1, 4, 'Completed credit exchange: Acoustic Guitar with Marcus Vance');
  insertTx.run(uid(), 'user-marcus', ex2, 'earn', 1, 6, 'Earned credits teaching Acoustic Guitar to Maya Lin');

  // Active accepted exchange between Maya and Leo
  const req3 = 'req-seed-3';
  const ex3 = 'ex-seed-3';
  db.prepare(`
    INSERT INTO exchange_requests (id, sender_id, receiver_id, offered_skill_id, requested_skill_id, mode, credit_cost, duration_minutes, preferred_method, proposed_date, message, status)
    VALUES (?, 'user-leo', 'user-maya', 'skill-spanish', 'skill-react', 'swap', 0, 45, 'online', '2026-11-18', 'Happy to practice Spanish conversation if you can review my React portfolio!', 'accepted')
  `).run(req3);

  db.prepare(`
    INSERT INTO exchanges (id, request_id, teacher_id, learner_id, skill_taught_id, skill_learned_id, mode, credit_amount, duration_minutes, status, teacher_confirmed, learner_confirmed, project_note)
    VALUES (?, ?, 'user-maya', 'user-leo', 'skill-react', 'skill-spanish', 'swap', 0, 45, 'accepted', 0, 0, '')
  `).run(ex3, req3);

  // Pending incoming request to Maya from Samir
  db.prepare(`
    INSERT INTO exchange_requests (id, sender_id, receiver_id, offered_skill_id, requested_skill_id, mode, credit_cost, duration_minutes, preferred_method, proposed_date, message, status)
    VALUES ('req-seed-4', 'user-sam', 'user-maya', 'skill-sql', 'skill-figma', 'swap', 0, 30, 'online', '2026-11-20', 'Hey Maya! Want to swap a 30-min SQL indexing review for a quick Figma wireframe critique?', 'pending')
  `).run();

  // Reviews on completed exchanges
  db.prepare(`
    INSERT INTO reviews (id, exchange_id, reviewer_id, reviewee_id, rating, comment)
    VALUES (?, ?, 'user-maya', 'user-priya', 5, 'Priya made Pandas groupby & merge click in 20 minutes. Clear examples and zero jargon.')
  `).run(uid(), ex1);
  db.prepare(`
    INSERT INTO reviews (id, exchange_id, reviewer_id, reviewee_id, rating, comment)
    VALUES (?, ?, 'user-priya', 'user-maya', 5, 'Maya restructured my entire research poster grid in Figma with super practical typography tips.')
  `).run(uid(), ex1);
  db.prepare(`
    INSERT INTO reviews (id, exchange_id, reviewer_id, reviewee_id, rating, comment)
    VALUES (?, ?, 'user-maya', 'user-marcus', 5, 'Patient pacing and great chord drills. Already playing smoothly!')
  `).run(uid(), ex2);

  // Conversations & Messages
  const convo1 = 'convo-maya-leo';
  db.prepare(`INSERT INTO conversations (id, participant_one, participant_two) VALUES (?, 'user-leo', 'user-maya')`).run(convo1);
  db.prepare(`INSERT INTO messages (id, conversation_id, sender_id, content, created_at) VALUES (?, ?, 'user-leo', 'Hey Maya! Excited for our React / Spanish swap this week.', datetime('now', '-2 hours'))`).run(uid(), convo1);
  db.prepare(`INSERT INTO messages (id, conversation_id, sender_id, content, created_at) VALUES (?, ?, 'user-maya', 'Same here Leo! Bring your portfolio repo link and we can pair on components first.', datetime('now', '-1 hours'))`).run(uid(), convo1);

  const convo2 = 'convo-maya-marcus';
  db.prepare(`INSERT INTO conversations (id, participant_one, participant_two) VALUES (?, 'user-marcus', 'user-maya')`).run(convo2);
  db.prepare(`INSERT INTO messages (id, conversation_id, sender_id, content, created_at) VALUES (?, ?, 'user-marcus', 'Great progress on the fingerpicking patterns! Let me know when you want part 2.', datetime('now', '-1 days'))`).run(uid(), convo2);

  // Skill Circles
  const circle1 = 'circle-fullstack';
  const circle2 = 'circle-creative';
  db.prepare(`
    INSERT INTO skill_circles (id, name, description, focus_skill, creator_id, max_members)
    VALUES (?, 'Full-Stack Campus Builders', 'Weekly peer studio where frontend, SQL, and UX students ship real portfolio apps together.', 'React & TypeScript', 'user-maya', 12)
  `).run(circle1);
  db.prepare(`
    INSERT INTO skill_circles (id, name, description, focus_skill, creator_id, max_members)
    VALUES (?, 'Storytellers & Creators Circle', 'Collaborative group blending acoustic sound, photography, video editing, and public speaking.', 'Digital Photography', 'user-leo', 10)
  `).run(circle2);

  const insertMember = db.prepare(`INSERT INTO group_memberships (id, circle_id, user_id, role, teaching_skill) VALUES (?, ?, ?, ?, ?)`);
  insertMember.run(uid(), circle1, 'user-maya', 'organizer', 'React & TypeScript');
  insertMember.run(uid(), circle1, 'user-sam', 'member', 'SQL & Database Design');
  insertMember.run(uid(), circle1, 'user-nina', 'member', 'UI/UX Design (Figma)');
  insertMember.run(uid(), circle2, 'user-leo', 'organizer', 'Digital Photography');
  insertMember.run(uid(), circle2, 'user-marcus', 'member', 'Acoustic Guitar');
  insertMember.run(uid(), circle2, 'user-elena', 'member', 'Public Speaking');

  // Scheduled 1:1 & Group & Micro-Skill Sessions
  db.prepare(`
    INSERT INTO sessions (id, exchange_id, circle_id, host_id, guest_id, title, skill_name, scheduled_date, start_time, duration_minutes, method, status, is_micro, max_participants, notes)
    VALUES ('sess-1', ?, NULL, 'user-maya', 'user-leo', 'React Portfolio Architecture + Spanish Drill', 'React & TypeScript', date('now', '+2 days'), '18:00', 45, 'online', 'accepted', 0, 2, 'Bring your GitHub repo and 5 Spanish travel prompts.')
  `).run(ex3);

  db.prepare(`
    INSERT INTO sessions (id, exchange_id, circle_id, host_id, guest_id, title, skill_name, scheduled_date, start_time, duration_minutes, method, status, is_micro, max_participants, notes)
    VALUES ('sess-group-1', NULL, ?, 'user-maya', NULL, 'Circle Workshop: Figma Tokens to SQL Schemas', 'UI/UX Design (Figma)', date('now', '+4 days'), '17:30', 60, 'online', 'accepted', 0, 12, 'Maya covers React components, Samir leads SQL modeling.')
  `).run(circle1);

  db.prepare(`
    INSERT INTO sessions (id, exchange_id, circle_id, host_id, guest_id, title, skill_name, scheduled_date, start_time, duration_minutes, method, status, is_micro, max_participants, notes)
    VALUES ('micro-1', NULL, NULL, 'user-priya', NULL, '20-Min Pandas GroupBy Rescue', 'Python & Data Science', date('now', '+1 days'), '19:00', 20, 'online', 'accepted', 1, 6, 'Quick live walkthrough of multi-index aggregation and pivot tables.')
  `).run();

  db.prepare(`
    INSERT INTO sessions (id, exchange_id, circle_id, host_id, guest_id, title, skill_name, scheduled_date, start_time, duration_minutes, method, status, is_micro, max_participants, notes)
    VALUES ('micro-2', NULL, NULL, 'user-elena', NULL, '15-Min Pitch Hook Clinic', 'Public Speaking', date('now', '+3 days'), '16:00', 15, 'in-person', 'accepted', 1, 5, 'Test your 60-second project intro and get crisp peer feedback.')
  `).run();

  db.prepare(`
    INSERT INTO sessions (id, exchange_id, circle_id, host_id, guest_id, title, skill_name, scheduled_date, start_time, duration_minutes, method, status, is_micro, max_participants, notes)
    VALUES ('micro-3', NULL, NULL, 'user-sam', NULL, '25-Min SQL Indexing & Query Plans', 'SQL & Database Design', date('now', '+5 days'), '18:30', 25, 'online', 'accepted', 1, 8, 'Understand EXPLAIN ANALYZE in under half an hour.')
  `).run();

  db.prepare(`INSERT INTO session_participants (id, session_id, user_id) VALUES (?, 'micro-1', 'user-maya')`).run(uid());

  // Seed Learning Roadmap for Maya
  const rmId = 'roadmap-seed-maya';
  db.prepare(`
    INSERT INTO roadmaps (id, user_id, skill_name, current_level, target_level, weekly_hours, ai_mode, summary)
    VALUES (?, 'user-maya', 'Acoustic Guitar', 'beginner', 'intermediate', 4, 'gemini', 'A 4-stage fingerstyle and rhythm roadmap tailored for 4 hours per week alongside campus peer sessions.')
  `).run(rmId);

  const insertMilestone = db.prepare(`
    INSERT INTO roadmap_milestones (id, roadmap_id, stage_index, week_label, title, topics, suggested_session, partner_hint, completed, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertMilestone.run(uid(), rmId, 1, 'Weeks 1-2', 'Open Chords & Steady Right-Hand Pulse', JSON.stringify(['Clean C, G, D, Em, Am transitions', 'Metronome strumming at 75 BPM', 'Thumb independence drill']), '30-min Chord Fluency Check with Marcus Vance', 'Marcus Vance (Expert Acoustic Guitar)', 1, new Date().toISOString());
  insertMilestone.run(uid(), rmId, 2, 'Weeks 3-4', 'Travis Picking & Fingerboard Mapping', JSON.stringify(['Alternating bass thumb pattern', 'Pinch & syncopated melody notes', 'Barre chord F & Bm prep']), '30-min Fingerpicking Swap', 'Marcus Vance (In-person or Online)', 0, null);
  insertMilestone.run(uid(), rmId, 3, 'Weeks 5-6', 'Dynamic Arrangement & Capo Voicings', JSON.stringify(['Transposing with a capo', 'Percussive slap & palm muting', 'Learning 2 full acoustic arrangements']), '25-min Micro-Session Song Lab', 'Storytellers & Creators Circle', 0, null);
  insertMilestone.run(uid(), rmId, 4, 'Weeks 7-8', 'Live Acoustic Recording & Peer Showcase', JSON.stringify(['Clean mic placement & phrasing', 'Full-song playthrough without stops', 'Record takeaway clip for Skill Passport']), '45-min Peer Showcase Session', 'Marcus Vance or Circle Jam', 0, null);

  // Award initial badges for seeded completed exchanges
  for (const u of users) {
    awardBadgesForUser(u.id);
  }

  // Notifications for Maya
  const insertNotif = db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, body, link, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertNotif.run(uid(), 'user-maya', 'exchange_request', 'New Skill Swap Request from Samir Patel', 'Samir offered SQL & Database Design for a 30-min UI/UX Design (Figma) critique.', '/exchanges', 0);
  insertNotif.run(uid(), 'user-maya', 'message', 'New message from Leo Morales', 'Hey Maya! Excited for our React / Spanish swap this week.', '/messages', 0);
  insertNotif.run(uid(), 'user-maya', 'session', 'Upcoming Session in 2 days', 'React Portfolio Architecture + Spanish Drill with Leo Morales at 18:00.', '/schedule', 0);
  insertNotif.run(uid(), 'user-maya', 'credit', 'Exchange Completed (-1 credit)', 'Acoustic Guitar session with Marcus Vance finalized. Badges updated!', '/wallet', 1);
}
