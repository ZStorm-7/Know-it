import { NextRequest } from "next/server";
import { GeminiError } from "@/lib/server/gemini";
import { addSession, checkPassword, hashPassword, lockedOut, noteFail, passwordProblem, validSession } from "@/lib/server/auth";
import { getUser, nameKey, putUser } from "@/lib/server/board-store";
import { handle } from "@/lib/server/route-utils";

// Change a password, or set one for an account made before passwords existed.
// Changing it signs the account out everywhere else.
export async function POST(req: NextRequest) {
  return handle(req, async (body) => {
    const name = String(body.name ?? "");
    const token = String(body.token ?? "");
    const oldPassword = String(body.oldPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    const key = nameKey(name);
    const user = await getUser(key);
    if (!user || !validSession(user, token)) throw new GeminiError("auth", 401, "Your sign-in expired. Please sign in again.");
    if (lockedOut(key)) throw new GeminiError("locked", 429, "Too many wrong tries. Wait 10 minutes and try again.");

    if (user.hash) {
      if (!(await checkPassword(oldPassword, user))) {
        noteFail(key);
        throw new GeminiError("auth", 401, "Your current password isn't right.");
      }
    }
    const problem = passwordProblem(newPassword, user.name);
    if (problem) throw new GeminiError("bad password", 400, problem);

    Object.assign(user, await hashPassword(newPassword));
    delete user.token; // retire the old plain token
    user.sessions = [];
    const fresh = addSession(user); // only this computer stays signed in
    await putUser(key, user);
    return { token: fresh, hasPassword: true };
  });
}
