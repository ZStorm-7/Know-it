import { NextRequest } from "next/server";
import { GeminiError } from "@/lib/server/gemini";
import { validSession } from "@/lib/server/auth";
import { getUser, myEntry, nameKey, setBest } from "@/lib/server/board-store";
import { handle } from "@/lib/server/route-utils";

export async function POST(req: NextRequest) {
  return handle(req, async (body) => {
    const name = String(body.name ?? "");
    const token = String(body.token ?? "");
    const score = Math.floor(Number(body.score));
    if (!Number.isFinite(score) || score < 0 || score > 300) throw new GeminiError("bad score", 400, "That score doesn't look right.");
    const key = nameKey(name);
    const user = await getUser(key);
    if (!user || !validSession(user, token)) {
      throw new GeminiError("auth", 401, "Your sign-in expired. Please sign in again.");
    }
    await setBest(key, score);
    return (await myEntry(key)) ?? { rank: 1, score };
  });
}
