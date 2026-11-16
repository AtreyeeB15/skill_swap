import { GoogleGenAI, Type } from '@google/genai';

export interface SkillSummary {
  name: string;
  proficiency: string;
}

export interface PeerCandidate {
  id: string;
  name: string;
  preferred_method: string;
  weekly_availability: string[];
  teachSkills: SkillSummary[];
  learnSkills: SkillSummary[];
  avgRating: number;
}

export interface MatchResult {
  userId: string;
  matchScore: number;
  why: string;
}

export interface RoadmapMilestoneDraft {
  stageIndex: number;
  weekLabel: string;
  title: string;
  topics: string[];
  suggestedSession: string;
  partnerHint: string;
}

export interface RoadmapDraft {
  mode: 'gemini' | 'basic';
  summary: string;
  milestones: RoadmapMilestoneDraft[];
}

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key.trim().length < 10) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function ruleBasedMatch(me: PeerCandidate, peers: PeerCandidate[]): MatchResult[] {
  const myTeach = new Map(me.teachSkills.map((s) => [s.name.toLowerCase(), s.proficiency]));
  const myLearn = new Map(me.learnSkills.map((s) => [s.name.toLowerCase(), s.proficiency]));
  const myAvail = new Set(me.weekly_availability);

  return peers
    .map((peer) => {
      const theyTeachMe = peer.teachSkills.filter((s) => myLearn.has(s.name.toLowerCase()));
      const iTeachThem = peer.learnSkills.filter((s) => myTeach.has(s.name.toLowerCase()));
      const sharedSlots = peer.weekly_availability.filter((slot) => myAvail.has(slot));

      let score = 40;
      score += Math.min(32, theyTeachMe.length * 22);
      score += Math.min(18, iTeachThem.length * 15);
      score += Math.min(8, sharedSlots.length * 4);
      if (peer.preferred_method === me.preferred_method) score += 5;
      if (peer.avgRating >= 4.5) score += 3;

      const proficiencyBonus = theyTeachMe.some((s) => s.proficiency === 'expert' || s.proficiency === 'advanced') ? 4 : 0;
      const finalScore = Math.min(98, Math.max(44, score + proficiencyBonus));

      const reasons: string[] = [];
      if (theyTeachMe.length > 0) {
        reasons.push(`teaches ${theyTeachMe[0].name} (${theyTeachMe[0].proficiency})`);
      }
      if (iTeachThem.length > 0) {
        reasons.push(`wants to learn ${iTeachThem[0].name}`);
      }
      if (sharedSlots.length > 0) {
        reasons.push(`overlaps on ${sharedSlots[0]}`);
      }
      if (reasons.length === 0) {
        reasons.push(
          peer.teachSkills.length > 0
            ? `offers ${peer.teachSkills[0].name} via ${peer.preferred_method}`
            : `active peer available ${peer.preferred_method}`
        );
      }

      return {
        userId: peer.id,
        matchScore: finalScore,
        why: `Match based on: ${reasons.join(', ')}.`,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

export async function generatePeerMatches(
  me: PeerCandidate,
  peers: PeerCandidate[]
): Promise<{ mode: 'gemini' | 'basic'; matches: MatchResult[] }> {
  if (peers.length === 0) {
    return { mode: 'basic', matches: [] };
  }

  const ai = getGeminiClient();
  if (!ai) {
    return { mode: 'basic', matches: ruleBasedMatch(me, peers) };
  }

  try {
    const prompt = `You are the SkillSwap peer compatibility engine. Score every candidate (0 to 100) for mutual skill exchange fit with the current user.
Consider:
1. Mutual skill overlap (candidate teaches what user wants to learn AND/OR wants what user teaches)
2. Weekly availability slot overlap
3. Preferred learning method alignment (${me.preferred_method})
4. Proficiency fit

Return JSON matching the schema with a concise 1-sentence "why" for each candidate.

Current User:
${JSON.stringify({
  id: me.id,
  name: me.name,
  preferred_method: me.preferred_method,
  weekly_availability: me.weekly_availability,
  teachSkills: me.teachSkills,
  learnSkills: me.learnSkills,
})}

Candidates:
${JSON.stringify(
  peers.map((p) => ({
    id: p.id,
    name: p.name,
    preferred_method: p.preferred_method,
    weekly_availability: p.weekly_availability,
    teachSkills: p.teachSkills,
    learnSkills: p.learnSkills,
    avgRating: p.avgRating,
  }))
)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              userId: { type: Type.STRING },
              matchScore: { type: Type.INTEGER },
              why: { type: Type.STRING },
            },
            required: ['userId', 'matchScore', 'why'],
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '[]').trim()) as MatchResult[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Empty AI match response');
    }

    const byId = new Map(parsed.map((m) => [m.userId, m]));
    const fallback = ruleBasedMatch(me, peers);
    const merged = peers
      .map((p) => {
        const aiItem = byId.get(p.id);
        const fbItem = fallback.find((f) => f.userId === p.id)!;
        if (!aiItem) return fbItem;
        return {
          userId: p.id,
          matchScore: Math.max(10, Math.min(99, Math.round(aiItem.matchScore))),
          why: aiItem.why || fbItem.why,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    return { mode: 'gemini', matches: merged };
  } catch (err) {
    console.warn('Gemini AI matching failed, using rule-based fallback:', (err as Error).message);
    return { mode: 'basic', matches: ruleBasedMatch(me, peers) };
  }
}

export function ruleBasedRoadmap(
  skill: string,
  currentLevel: string,
  targetLevel: string,
  weeklyHours: number,
  recommendedPartners: string[]
): RoadmapDraft {
  const partnerName = recommendedPartners[0] || 'a peer mentor in Explore Skills';
  const secondaryPartner = recommendedPartners[1] || 'a relevant Skill Circle';

  return {
    mode: 'basic',
    summary: `Structured 4-stage learning plan for ${skill} moving from ${currentLevel} to ${targetLevel} at ${weeklyHours} hrs/week.`,
    milestones: [
      {
        stageIndex: 1,
        weekLabel: 'Weeks 1-2',
        title: `Core Foundations in ${skill}`,
        topics: [
          `Essential ${skill} terminology and mental models`,
          'Tooling setup and baseline diagnostic exercise',
          'Daily 25-minute deliberate practice drills',
        ],
        suggestedSession: `30-min Foundations Swap in ${skill}`,
        partnerHint: `Recommended partner: ${partnerName}`,
      },
      {
        stageIndex: 2,
        weekLabel: 'Weeks 3-4',
        title: `Guided Practice & Workflow Fluency`,
        topics: [
          `Core ${skill} workflows and common pitfalls`,
          'Hands-on guided exercise with live peer critique',
          'Building a repeatable practice checklist',
        ],
        suggestedSession: `45-min Co-Working & Feedback Session`,
        partnerHint: `Recommended partner: ${partnerName}`,
      },
      {
        stageIndex: 3,
        weekLabel: 'Weeks 5-6',
        title: `Applied Mini-Project (${targetLevel} Bridge)`,
        topics: [
          `Scoping a focused ${skill} mini-project`,
          'Solving real edge cases and refining technique',
          'Explaining concepts back to a peer (Feynman check)',
        ],
        suggestedSession: `25-min Micro-Skill Clinic`,
        partnerHint: `Collaborate with ${secondaryPartner}`,
      },
      {
        stageIndex: 4,
        weekLabel: 'Weeks 7-8',
        title: `Capstone Review & Skill Passport Showcase`,
        topics: [
          'Polishing your final deliverable',
          'Peer review session & reflection notes',
          'Transitioning to teach basics to newcomers',
        ],
        suggestedSession: `60-min Capstone Review Exchange`,
        partnerHint: `Book final critique with ${partnerName}`,
      },
    ],
  };
}

export async function generateLearningRoadmap(
  skill: string,
  currentLevel: string,
  targetLevel: string,
  weeklyHours: number,
  recommendedPartners: string[]
): Promise<RoadmapDraft> {
  const ai = getGeminiClient();
  if (!ai) {
    return ruleBasedRoadmap(skill, currentLevel, targetLevel, weeklyHours, recommendedPartners);
  }

  try {
    const prompt = `Create a practical, realistic 4-stage peer learning roadmap for a college student learning "${skill}".
Current level: ${currentLevel}
Target level: ${targetLevel}
Weekly study budget: ${weeklyHours} hours/week
Available SkillSwap peer mentors who teach this or related skills: ${recommendedPartners.join(', ') || 'Campus peers'}

Return JSON with a concise 1-sentence summary and 4 ordered stages, each with weekLabel, title, 3 concrete topics, a suggestedSession (15-60 min peer exchange idea), and partnerHint.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            milestones: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stageIndex: { type: Type.INTEGER },
                  weekLabel: { type: Type.STRING },
                  title: { type: Type.STRING },
                  topics: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  suggestedSession: { type: Type.STRING },
                  partnerHint: { type: Type.STRING },
                },
                required: ['stageIndex', 'weekLabel', 'title', 'topics', 'suggestedSession', 'partnerHint'],
              },
            },
          },
          required: ['summary', 'milestones'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      summary?: string;
      milestones?: RoadmapMilestoneDraft[];
    };

    if (!parsed.milestones || parsed.milestones.length === 0) {
      throw new Error('Invalid roadmap structure');
    }

    return {
      mode: 'gemini',
      summary: parsed.summary || `Personalized ${skill} roadmap (${weeklyHours} hrs/week).`,
      milestones: parsed.milestones.map((m, idx) => ({
        stageIndex: m.stageIndex || idx + 1,
        weekLabel: m.weekLabel || `Stage ${idx + 1}`,
        title: m.title,
        topics: Array.isArray(m.topics) ? m.topics : [],
        suggestedSession: m.suggestedSession || '30-min Peer Exchange',
        partnerHint: m.partnerHint || recommendedPartners[0] || 'Explore SkillSwap mentors',
      })),
    };
  } catch (err) {
    console.warn('Gemini roadmap failed, using template fallback:', (err as Error).message);
    return ruleBasedRoadmap(skill, currentLevel, targetLevel, weeklyHours, recommendedPartners);
  }
}
