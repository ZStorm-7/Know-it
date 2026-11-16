import { NextRequest } from "next/server";
import { geminiJSON, languageLine, MODEL_FAST } from "@/lib/server/gemini";
import { handle } from "@/lib/server/route-utils";

function tierFor(round: number) {
  if (round <= 3) return "BROAD: a simple trait like a color or shape (e.g. 'something round', 'something blue').";
  if (round <= 6) return "MATERIAL or CATEGORY (e.g. 'something made of wood', 'something from the kitchen').";
  if (round <= 10) return "A SPECIFIC common object (e.g. 'a spoon', 'a pencil', 'a sock').";
  if (round <= 14) return "A COMBINATION of two traits or a specific object with a trait (e.g. 'something soft and white', 'a metal object smaller than your hand').";
  return "VERY HARD: THREE constraints at once, or an unusual but common object with two traits (e.g. 'a red metal object smaller than your hand', 'something round, made of glass and transparent', 'a soft blue thing with a pattern'). Still findable in a home or classroom."
}

export async function POST(req: NextRequest) {
  return handle(req, async (body) => {
    const round = Math.max(1, Math.min(99, Number(body.round) || 1));
    const used = (Array.isArray(body.used) ? body.used : []).map(String).slice(-30);
    const out = await geminiJSON<{ challenge?: string }>({
      model: MODEL_FAST,
      system: `You write scavenger-hunt challenges for a game played on a computer indoors at home, school or an event.
Return JSON only: {"challenge": string}
- The challenge must be findable in a typical home, classroom or office within a minute.
- Phrase it as "Find ..." in under 10 words. No emojis.
- Difficulty for this round: ${tierFor(round)}
${languageLine(body.lang)}`,
      user: `Round ${round}. Already used (do not repeat or closely resemble): ${JSON.stringify(used)}`,
      temperature: 1.1,
      signal: req.signal,
    });
    const challenge = String(out.challenge ?? "").trim().slice(0, 80);
    if (!challenge) throw new Error("empty challenge");
    return { challenge };
  });
}
