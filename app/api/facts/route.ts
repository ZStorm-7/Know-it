import { NextRequest } from "next/server";
import { checkImage, cleanConf, geminiJSON, languageLine, MODEL_SMART } from "@/lib/server/gemini";

const CATEGORIES = ["kitchen", "clothing", "nature", "tech", "toys", "stationery", "furniture", "other"];
import { handle } from "@/lib/server/route-utils";

const STYLES: Record<string, string> = {
  kid: "Write for a curious 8-year-old: simple words, short sentences, playful.",
  normal: "Write for a curious teen or adult: clear, fun and surprising.",
  nerdy: "Write for a science lover: precise, with a bit more depth (still short).",
};

/** Keep sticky-note names short enough to fit the note (24 characters), cutting at a word. */
function clampTitle(t: string): string {
  const clean = t.replace(/\s+/g, " ").trim();
  if (clean.length <= 24) return clean;
  const cut = clean.slice(0, 24);
  const sp = cut.lastIndexOf(" ");
  return (sp > 8 ? cut.slice(0, sp) : cut).trim();
}

export async function POST(req: NextRequest) {
  return handle(req, async (body) => {
    const image = checkImage(body.image);
    const typed = body.typed === true;
    const target = String(body.target ?? "").trim().slice(0, 60) || "the main object";
    const avoid = (Array.isArray(body.avoid) ? body.avoid : [])
      .map((s) => String(s).slice(0, 200))
      .slice(-40);
    const style = STYLES[String(body.style)] ?? STYLES.normal;
    const count = 5 + Math.floor(Math.random() * 6); // 5-10

    const system = `You are Nimbus, a cheerful cloud who teaches people fun facts about ordinary objects.
${style}
${languageLine(body.lang)}
Return JSON only:
{"object": string, "title": string, "category": string, "facts": string[], "quiz": {"question": string, "options": string[], "answer": number}, "confidence": number}
Rules:
- "object": the plain name of the object.
- "title": a short, charming nickname for this exact object, 2-3 words and at most 24 characters including spaces, like a name written on a sticky note (e.g. "Sir Sips-a-Lot" for a mug). No emojis.
- "category": exactly one of ${CATEGORIES.join(", ")}.
- If the subject is a person or part of a person (a hand, a face, hair, a smile), write fun, general, kind facts about the HUMAN body and being human, based on what is visible and what is generally true for everyone. NEVER identify the person, guess their name, age, gender, ethnicity, health or feelings, or judge how they look. The "title" is a fun nickname for the kind of thing, such as "Marvelous Human" or "Mighty Hand".
- "facts": exactly ${count} facts. Each is ONE sentence, max 25 words, about this kind of object: history, science, materials, records, culture or surprising uses.
- Every fact must be different from each other and from the "already seen" list. Do not rephrase seen facts.
- Only include well-established facts. Avoid world records, exact statistics, dates or names unless they are famous and certain.
- "quiz": one multiple-choice question answerable from your facts, 3 options, "answer" is the 0-based index of the correct option.
- "confidence": 0-100, how sure you are of what the object is.
- No emojis anywhere.`;

    const user = `${typed ? `The player told you what this is: "${target}". Trust the player. Use "${target}" as the object name and write facts about it; the photo is only context.\n` : ""}The object to teach about: "${target}".
Already seen facts (do not repeat): ${avoid.length ? JSON.stringify(avoid) : "none"}.`;

    const ask = (model: string) =>
      geminiJSON<Record<string, unknown>>({ model, system, user, imageDataUrl: image, temperature: 1.0, maxTokens: 3500,signal: req.signal });
    // geminiJSON already switches to the other model or the backup key if the first choice fails
    const out = await ask(MODEL_SMART);

    const seen = new Set(avoid.map((s) => s.toLowerCase()));
    const facts = (Array.isArray(out.facts) ? out.facts : [])
      .map((f) => String(f).trim())
      .filter((f) => f && !seen.has(f.toLowerCase()))
      .filter((f, i, arr) => arr.findIndex((g) => g.toLowerCase() === f.toLowerCase()) === i)
      .slice(0, 10);

    const q = (out.quiz ?? {}) as Record<string, unknown>;
    const options = (Array.isArray(q.options) ? q.options : []).map(String).slice(0, 3);
    const answer = Number(q.answer);
    const quiz =
      typeof q.question === "string" && options.length === 3 && answer >= 0 && answer < 3
        ? { question: q.question, options, answer }
        : null;

    return {
      object: String(out.object ?? target).slice(0, 60),
      category: CATEGORIES.includes(String(out.category)) ? String(out.category) : "other",
      title: clampTitle(String(out.title ?? target).replace(/[^\p{L}\p{N}\s'\-!.,&]/gu, "")) || clampTitle(target),
      facts,
      quiz,
      confidence: cleanConf(out.confidence),
    };
  });
}
