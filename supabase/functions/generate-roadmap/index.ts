// Supabase Edge Function: generate-roadmap
// Deploy with: supabase functions deploy generate-roadmap

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildFallbackRoadmap(skill: string, currentLevel: string, targetLevel: string, weeklyHours: number) {
  return {
    mode: "basic",
    summary: `Structured 4-stage progression for ${skill} (${currentLevel} to ${targetLevel}) paced at ${weeklyHours} hrs/week.`,
    milestones: [
      {
        stageIndex: 1,
        weekLabel: "Weeks 1-2",
        title: `Core Foundations in ${skill}`,
        topics: [`${skill} mental model & vocabulary`, "Environment setup & core tools", "First guided mini-exercise"],
        suggestedSession: `30-min Diagnostic & Basics Swap (${skill})`,
        partnerHint: "Pair with an Intermediate or Advanced peer mentor",
      },
      {
        stageIndex: 2,
        weekLabel: "Weeks 3-4",
        title: "Applied Patterns & Guided Practice",
        topics: ["Common workflows and patterns", "Debugging & critique checklist", "Small real-world build"],
        suggestedSession: "45-min Live Co-Working & Code/Work Review",
        partnerHint: "Find a peer offering hands-on feedback sessions",
      },
      {
        stageIndex: 3,
        weekLabel: "Weeks 5-6",
        title: `Intermediate Depth toward ${targetLevel}`,
        topics: ["Edge cases and quality standards", "Independent mini-project", "Peer teaching rehearsal"],
        suggestedSession: "30-min Micro-Skill Workshop",
        partnerHint: "Join a Skill Circle focused on this domain",
      },
      {
        stageIndex: 4,
        weekLabel: "Weeks 7-8",
        title: "Capstone Portfolio & Peer Review",
        topics: ["End-to-end capstone delivery", "Peer critique & polish", "Document takeaways in Skill Passport"],
        suggestedSession: "60-min Capstone Presentation & Review",
        partnerHint: "Book an Expert peer for final critique",
      },
    ],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: any = {};
  try {
    body = await req.json();
    const { skill, currentLevel, targetLevel, weeklyHours } = body;
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiKey) {
      return new Response(
        JSON.stringify(buildFallbackRoadmap(skill, currentLevel, targetLevel, weeklyHours)),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `Create a practical peer-learning roadmap for "${skill}" from ${currentLevel} to ${targetLevel} at ${weeklyHours} hours/week.
Return ONLY JSON: { "summary": string, "milestones": [{ "stageIndex": number, "weekLabel": string, "title": string, "topics": string[], "suggestedSession": string, "partnerHint": string }] } with 4 stages.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!res.ok) throw new Error("Gemini API error");
    const payload = await res.json();
    const parsed = JSON.parse(payload?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
    return new Response(JSON.stringify({ mode: "gemini", ...parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_err) {
    return new Response(
      JSON.stringify(
        buildFallbackRoadmap(
          body.skill || "Skill",
          body.currentLevel || "beginner",
          body.targetLevel || "intermediate",
          body.weeklyHours || 4
        )
      ),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
