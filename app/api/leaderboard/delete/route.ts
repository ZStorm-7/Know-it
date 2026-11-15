import { NextRequest } from "next/server";
import { GeminiError } from "@/lib/server/gemini";
import { checkPassword, lockedOut, noteFail, validSession } from "@/lib/server/auth";
import { deleteUser, getUser, nameKey } from "@/lib/server/board-store";
import { handle } from "@/lib/server/route-utils";

export async function POST(req: NextRequest) {
  return handle(req, async (body) => {
    const name = String(body.name ?? "");
    const token = String(body.token ?? "");
    const password = String(body.password ?? "");
    const key = nameKey(name);
    const user = await getUser(key);
    if (!user || !validSession(user, token)) throw new GeminiError("auth", 401, "Your sign-in expired. Please sign in again.");
    if (lockedOut(key)) throw new GeminiError("locked", 429, "Too many wrong tries. Wait 10 minutes and try again.");
    if (user.hash && !(await checkPassword(password, user))) {
      noteFail(key);
      throw new GeminiError("auth", 401, "That password isn't right.");
    }
    await deleteUser(key);
    return { ok: true };
  });
}
