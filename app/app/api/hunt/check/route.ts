import { NextRequest } from "next/server";
import { checkImage, cleanBox, cleanConf, geminiJSON, MODEL_FAST } from "@/lib/server/gemini";
import { handle } from "@/lib/server/route-utils";

export async function POST(req: NextRequest) {
  return handle(req, async (body) => {
    const image = checkImage(body.image);
    const challenge = String(body.challenge ?? "").slice(0, 80);
    const out = await geminiJSON<Record<string, unknown>>({
      model: MODEL_FAST,
      system: `You judge a friendly scavenger-hunt game. Decide if the photo shows an object that satisfies the challenge.
Return JSON only:
{"match": boolean, "object": string, "box_2d": [ymin, xmin, ymax, xmax], "comment": string, "confidence": number}
- Be fair and a little generous: accept reasonable interpretations and close matches.
- "object": short name of the object you judged (the best candidate even if it does not match).
- box_2d: normalized 0-1000 around that object.
- "comment": one short, upbeat sentence (max 14 words). If it does not match, give a gentle hint. No emojis.
- "confidence": 0-100.
- If the photo mainly shows a person, match is false and comment asks for an object instead.`,
      user: `Challenge: "${challenge}"`,
      imageDataUrl: image,
      temperature: 0.2,
      signal: req.signal,
    });
    return {
      match: out.match === true,
      object: String(out.object ?? "something").slice(0, 60),
      box: cleanBox(out.box_2d),
      comment: String(out.comment ?? "").slice(0, 140),
      confidence: cleanConf(out.confidence),
    };
  });
}
