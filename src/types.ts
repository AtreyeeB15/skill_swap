export type PreferredMethod = 'online' | 'in-person' | 'chat';
export type Proficiency = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface SkillCatalogItem {
  id: string;
  name: string;
  category: string;
}

export interface UserSkill {
  id: string;
  skill_id: string;
  name: string;
  category: string;
  type: 'teach' | 'learn';
  proficiency: Proficiency;
  description: string;
}

export interface CreditWallet {
  balance: number;
  total_earned: number;
  total_spent: number;
}

export interface CreditTransaction {
  id: string;
  exchange_id: string | null;
  type: 'initial_grant' | 'earn' | 'spend' | 'refund';
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export interface Achievement {
  id: string;
  badge_key: string;
  badge_name: string;
  description: string;
  awarded_at: string;
}

export interface ReviewItem {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_avatar: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  bio: string;
  preferred_method: PreferredMethod;
  weekly_availability: string[];
  credits_per_30min: number;
  onboarding_completed: boolean;
  created_at: string;
  teachSkills: UserSkill[];
  learnSkills: UserSkill[];
  wallet: CreditWallet;
  avgRating: number;
  reviewCount: number;
  completedExchanges: number;
  achievements: Achievement[];
  reviews: ReviewItem[];
}

export interface PeerMatch extends UserProfile {
  matchScore: number;
  why: string;
}

export interface ExchangeRequestItem {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_name: string;
  sender_avatar: string;
  receiver_name: string;
  receiver_avatar: string;
  offered_skill_id: string | null;
  offered_skill_name: string | null;
  requested_skill_id: string;
  requested_skill_name: string;
  mode: 'swap' | 'credit';
  credit_cost: number;
  duration_minutes: number;
  preferred_method: PreferredMethod;
  proposed_date: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
}

export interface ExchangeItem {
  id: string;
  request_id: string | null;
  teacher_id: string;
  learner_id: string;
  teacher_name: string;
  teacher_avatar: string;
  learner_name: string;
  learner_avatar: string;
  skill_taught_id: string;
  skill_taught_name: string;
  skill_learned_id: string | null;
  skill_learned_name: string | null;
  mode: 'swap' | 'credit';
  credit_amount: number;
  duration_minutes: number;
  status: 'accepted' | 'completed' | 'cancelled';
  teacher_confirmed: boolean;
  learner_confirmed: boolean;
  user_has_reviewed: boolean;
  project_note: string;
  completed_at: string | null;
  created_at: string;
}

export interface ConversationItem {
  id: string;
  participant_one: string;
  participant_two: string;
  peer_id: string;
  peer_name: string;
  peer_avatar: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface MessageItem {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

export interface SessionItem {
  id: string;
  exchange_id: string | null;
  circle_id: string | null;
  circle_name: string | null;
  host_id: string;
  host_name: string;
  host_avatar: string;
  guest_id: string | null;
  guest_name: string | null;
  guest_avatar: string | null;
  title: string;
  skill_name: string;
  scheduled_date: string;
  start_time: string;
  duration_minutes: number;
  method: PreferredMethod;
  status: 'requested' | 'accepted' | 'rescheduled' | 'completed' | 'cancelled';
  is_micro: boolean;
  max_participants: number;
  participant_count: number;
  user_joined: boolean;
  notes: string;
}

export interface CircleMember {
  id: string;
  circle_id: string;
  user_id: string;
  name: string;
  avatar_url: string;
  role: 'organizer' | 'member';
  teaching_skill: string;
  joined_at: string;
}

export interface SkillCircle {
  id: string;
  name: string;
  description: string;
  focus_skill: string;
  creator_id: string;
  creator_name: string;
  max_members: number;
  members: CircleMember[];
  sessions: SessionItem[];
  isMember: boolean;
  created_at: string;
}

export interface RoadmapMilestone {
  id: string;
  roadmap_id: string;
  stage_index: number;
  week_label: string;
  title: string;
  topics: string[];
  suggested_session: string;
  partner_hint: string;
  completed: boolean;
  completed_at: string | null;
}

export interface RoadmapItem {
  id: string;
  user_id: string;
  skill_name: string;
  current_level: string;
  target_level: string;
  weekly_hours: number;
  ai_mode: 'gemini' | 'basic';
  summary: string;
  milestones: RoadmapMilestone[];
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface DashboardData {
  profile: UserProfile;
  profileCompletion: number;
  upcomingSessions: SessionItem[];
  pendingRequests: ExchangeRequestItem[];
  recentMessages: Array<{
    conversation_id: string;
    peer_name: string;
    peer_avatar: string;
    content: string;
    created_at: string;
  }>;
  roadmapProgress: Array<{
    id: string;
    skill_name: string;
    target_level: string;
    total: number;
    done: number;
    percent: number;
  }>;
  topMatches: PeerMatch[];
}
