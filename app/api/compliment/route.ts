import { NextRequest } from "next/server";
import { geminiJSON, languageLine, MODEL_FAST } from "@/lib/server/gemini";
import { handle } from "@/lib/server/route-utils";

const VIBES = ["curiosity", "kindness", "creativity", "focus", "sense of wonder", "bravery", "humor", "patience", "good taste", "energy"];

export async function POST(req: NextRequest) {
  return handle(req, async (body) => {
    const vibe = VIBES[Math.floor(Math.random() * VIBES.length)];
    const out = await geminiJSON<{ compliment?: string }>({
      model: MODEL_FAST,
      system: `You are Nimbus, a cheerful cloud mascot in a learning app for all ages.
Return JSON only: {"compliment": string}
Write one warm, original compliment for the user about their ${vibe}, max 16 words.
Only the compliment itself: no questions, no invitations, no calls to action (never say things like "ready for an adventure", "let's go", "hop in", "let's explore").
You cannot see the user, so do not mention looks. No emojis.
${languageLine(body.lang)}`,
      user: "Give me today's compliment.",
      temperature: 1.2,
    });
    const compliment = String(out.compliment ?? "").trim().slice(0, 160);
    if (!compliment) throw new Error("empty");
    return { compliment };
  });
}
