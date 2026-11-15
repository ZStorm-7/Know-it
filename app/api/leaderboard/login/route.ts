import { NextRequest } from "next/server";
import { GeminiError } from "@/lib/server/gemini";
import { getUser, myEntry, nameKey } from "@/lib/server/board-store";
import { handle } from "@/lib/server/route-utils";

// Sign in on a new phone with the username and the recovery code from the old one.
export async function POST(req: NextRequest) {
  return handle(req, async (body) => {
    const name = String(body.name ?? "").trim();
    const token = String(body.token ?? "").trim();
    const user = name ? await getUser(nameKey(name)) : null;
    if (!user || user.token !== token) {
      throw new GeminiError("auth", 401, "That username and recovery code don't match. Check both and try again.");
    }
    const entry = await myEntry(nameKey(name));
    return { name: user.name, token: user.token, rank: entry?.rank ?? null, score: entry?.score ?? 0 };
  });
}
