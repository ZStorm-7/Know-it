import { NextRequest } from "next/server";
import { checkImage, cleanBox, cleanConf, geminiJSON, MODEL_FAST } from "@/lib/server/gemini";
import { handle } from "@/lib/server/route-utils";

const SYSTEM = `You find physical objects in photos for a friendly learning app used by all ages.
Return JSON only:
{"has_person": boolean, "objects": [{"name": string, "box_2d": [ymin, xmin, ymax, xmax], "confidence": number}]}
Rules:
- box_2d is normalized 0-1000 and tightly fits the object.
- name is a short common noun phrase (e.g. "coffee mug", "running shoe").
- confidence is 0-100: how sure you are about what the object is.
- List at most 3 objects, most prominent first. Ignore background surfaces (walls, floors, tables) unless nothing else is there.
- If the main subject is a person, or part of a person such as a hand or a face, list it too, named only "person", "hand", "face" or "people" for a group. Never identify who someone is.
- has_person is true if a person is in the photo.`;

export async function POST(req: NextRequest) {
  return handle(req, async (body) => {
    const image = checkImage(body.image);
    const out = await geminiJSON<{ has_person?: boolean; objects?: unknown[] }>({
      model: MODEL_FAST,
      system: SYSTEM,
      user: "Find the objects in this photo.",
      imageDataUrl: image,
      temperature: 0.2,
      maxTokens: 1500,
      signal: req.signal,
    });
    const objects = (Array.isArray(out.objects) ? out.objects : [])
      .map((o) => {
        const r = o as Record<string, unknown>;
        const box = cleanBox(r.box_2d);
        const name = String(r.name ?? "").trim().slice(0, 60);
        const confidence = cleanConf(r.confidence);
        return box && name ? { name, box, confidence } : null;
      })
      .filter(Boolean)
      .slice(0, 3);
    return { hasPerson: !!out.has_person, objects };
  });
}
