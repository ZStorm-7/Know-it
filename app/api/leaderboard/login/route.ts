import { NextRequest } from "next/server";
import { GeminiError } from "@/lib/server/gemini";
import { addSession, checkPassword, clearFails, lockedOut, noteFail } from "@/lib/server/auth";
import { getUser, myEntry, nameKey, putUser } from "@/lib/server/board-store";
import { handle } from "@/lib/server/route-utils";

const WRONG = "That username and password don't match.";

export async function POST(req: NextRequest) {
  return handle(req, async (body) => {
    const name = String(body.name ?? "").trim();
    const password = String(body.password ?? "");
    const key = nameKey(name);
    if (lockedOut(key)) throw new GeminiError("locked", 429, "Too many wrong tries. Wait 10 minutes and try again.");

    const user = key ? await getUser(key) : null;
    if (!user) {
      noteFail(key);
      throw new GeminiError("auth", 401, WRONG);
    }
    if (!user.hash) {
      throw new GeminiError("legacy", 409, "This account was made before passwords. Open Know it on the phone where you made it, then go to Settings, Account and add a password.");
    }
    if (!(await checkPassword(password, user))) {
      noteFail(key);
      throw new GeminiError("auth", 401, WRONG);
    }
    clearFails(key);
    const token = addSession(user);
    await putUser(key, user);
    const entry = await myEntry(key);
    return { name: user.name, token, hasPassword: true, rank: entry?.rank ?? null, score: entry?.score ?? 0 };
  });
}
