// Supabase Edge Function: ai-match
// Deploy with: supabase functions deploy ai-match
// Secret required: supabase secrets set GEMINI_API_KEY=...

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function scorePeerFallback(me: any, peer: any) {
  const myTeach = new Set((me.teachSkills || []).map((s: any) => s.name.toLowerCase()));
  const myLearn = new Set((me.learnSkills || []).map((s: any) => s.name.toLowerCase()));
  const peerTeach = (peer.teachSkills || []).map((s: any) => s.name.toLowerCase());
  const peerLearn = (peer.learnSkills || []).map((s: any) => s.name.toLowerCase());

  const theyTeachMe = peerTeach.filter((s: string) => myLearn.has(s));
  const iTeachThem = peerLearn.filter((s: string) => myTeach.has(s));

  let score = 42;
  score += Math.min(30, theyTeachMe.length * 20);
  score += Math.min(18, iTeachThem.length * 14);

  const myAvail = new Set(me.weekly_availability || []);
  const sharedSlots = (peer.weekly_availability || []).filter((slot: string) => myAvail.has(slot));
  score += Math.min(8, sharedSlots.length * 4);

  if (peer.preferred_method === me.preferred_method) score += 5;

  const clamped = Math.min(98, Math.max(45, score));
  const whyParts: string[] = [];
  if (theyTeachMe.length > 0) whyParts.push(`teaches ${theyTeachMe[0]}`);
  if (iTeachThem.length > 0) whyParts.push(`wants ${iTeachThem[0]}`);
  if (sharedSlots.length > 0) whyParts.push(`shares ${sharedSlots[0]} availability`);

  const why =
    whyParts.length > 0
      ? `Strong mutual fit: ${whyParts.join(", ")}.`
      : `Compatible ${peer.preferred_method} learning style and peer schedule overlap.`;

  return { userId: peer.id, matchScore: clamped, why };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { me, peers } = await req.json();
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiKey) {
      const matches = (peers || []).map((p: any) => scorePeerFallback(me, p))
        .sort((a: any, b: any) => b.matchScore - a.matchScore);
      return new Response(JSON.stringify({ mode: "basic", matches }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Score peer skill-exchange compatibility (0-100) between current user and candidates based on mutual skill fit, availability overlap, method, and proficiency. Return ONLY JSON array of { "userId": string, "matchScore": number, "why": string } where "why" is one concise sentence.
Current user: ${JSON.stringify(me)}
Candidates: ${JSON.stringify(peers)}`;

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

    if (!res.ok) throw new Error("Gemini request failed");
    const payload = await res.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const matches = JSON.parse(text);

    return new Response(JSON.stringify({ mode: "gemini", matches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_err) {
    return new Response(JSON.stringify({ mode: "basic", matches: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
