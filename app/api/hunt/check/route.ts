import { NextRequest } from "next/server";
import { checkImage, cleanBox, cleanConf, geminiJSON, languageLine, MODEL_FAST } from "@/lib/server/gemini";
import { handle } from "@/lib/server/route-utils";

export async function POST(req: NextRequest) {
  return handle(req, async (body) => {
    const image = checkImage(body.image);
    const challenge = String(body.challenge ?? "").slice(0, 80);
    const level = Math.max(1, Math.min(99, Number(body.level) || 1));
    const strictness =
      level <= 3
        ? "Be generous: accept any reasonable interpretation."
        : level <= 10
          ? "Be fair: the object must clearly satisfy the challenge."
          : "Be strict: the object must clearly satisfy EVERY part of the challenge, and close calls do not count.";
    const t = (body.target ?? {}) as { name?: unknown; box?: unknown };
    const targetName = typeof t.name === "string" ? t.name.slice(0, 60) : "";
    const targetBox = cleanBox(t.box);
    const out = await geminiJSON<Record<string, unknown>>({
      model: MODEL_FAST,
      system: `You judge a friendly scavenger-hunt game. Decide if the photo shows an object that satisfies the challenge.
Return JSON only:
{"match": boolean, "object": string, "box_2d": [ymin, xmin, ymax, xmax], "comment": string, "reason": string, "wow": string, "confidence": number}
- Strictness for this round: ${strictness}
- "object": short name of the object you judged (the best candidate even if it does not match).
- box_2d: normalized 0-1000 around that object.
- "comment": one short, upbeat sentence (max 14 words). If it does not match, give a gentle hint. No emojis.
- "reason": only when match is false, otherwise "". ONE simple sentence (max 20 words) saying why it does not count: say what you saw and which part of the challenge it misses, like "I saw a coffee mug, but it is not blue." or "That looks like a spoon, and the challenge needs something made of wood." Plain words, no emojis.
- "wow": only when match is true, otherwise "". One surprising, well-established fact about this kind of object that shows how remarkable an ordinary thing can be (max 24 words, start with the object, no exact statistics or dates unless famous and certain, no emojis).
- "confidence": 0-100.
- If the photo mainly shows a person, match is false and comment asks for an object instead.
${languageLine(body.lang)}`,
      user: `Challenge: "${challenge}"${
        targetName
          ? `\nThe player says the object they are showing is "${targetName}"${targetBox ? ` (box_2d ${JSON.stringify(targetBox)})` : ""}. Judge ONLY that object, ignore everything else in the photo.`
          : ""
      }`,
      imageDataUrl: image,
      temperature: 0.2,
      maxTokens: 900,
      signal: req.signal,
    });
    return {
      match: out.match === true,
      object: String(out.object ?? "something").slice(0, 60),
      box: cleanBox(out.box_2d),
      comment: String(out.comment ?? "").slice(0, 140),
      reason: out.match === true ? "" : String(out.reason ?? "").slice(0, 160),
      wow: out.match === true ? String(out.wow ?? "").slice(0, 220) : "",
      confidence: cleanConf(out.confidence),
    };
  });
}
