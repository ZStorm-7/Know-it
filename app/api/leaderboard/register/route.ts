import { NextRequest } from "next/server";
import { GeminiError, geminiJSON, MODEL_FAST } from "@/lib/server/gemini";
import { addSession, hashPassword, passwordProblem } from "@/lib/server/auth";
import { claimName, getUser, nameKey, storageMode, type UserRecord } from "@/lib/server/board-store";
import { handle } from "@/lib/server/route-utils";

const SYSTEM = `You are the username moderator for a friendly learning game used by children and adults.
Decide whether a proposed username is appropriate for a public leaderboard. WHEN IN DOUBT, APPROVE: most names are fine.

REJECT only these:
1. Profanity, insults, bullying or hurtful words, in any language, including leetspeak, symbols or numbers standing in for letters, or letters split up.
2. Sexual content, hate, slurs, violence, self-harm, drugs or alcohol.
3. Contact details: a phone number, email or street address.
4. Impersonating staff or the product: names that are exactly or mostly words like admin, moderator, staff, official, support, nimbus, anthropic, claude, gemini, google.
5. A clearly full real name made of a first name AND a full surname (for example "JohnSmith"). A first name, a nickname, or a first name with a letter or number is FINE.

APPROVE all of these kinds of names: first names (Maya, Dev, Ben), names with an initial or number (Maya_K, Dev99, Ben_B, Zara7), animals and objects (SleepyOwl, TacoQueen), game-style names (CloudHunter7, PixelNinja), and silly or cute names.
Short first names such as "Dev" or "Mod" inside a longer harmless name are fine; do not treat them as staff titles.

Return JSON only: {"appropriate": boolean, "reason": string}
"reason" is one short, kind sentence for the player. Never repeat the offending word.`;

export async function POST(req: NextRequest) {
  return handle(req, async (body) => {
    const name = String(body.name ?? "").trim();
    const password = String(body.password ?? "");
    if (!/^[A-Za-z0-9_.-]{3,16}$/.test(name)) {
      throw new GeminiError("bad name", 400, "Use 3 to 16 letters, numbers, dots, dashes or underscores. No spaces.");
    }
    const key = nameKey(name);
    if (key.length < 3) throw new GeminiError("bad name", 400, "Add a few more letters or numbers.");
    const problem = passwordProblem(password, name);
    if (problem) throw new GeminiError("bad password", 400, problem);

    // 1. cheap check first: is it already taken?
    if (await getUser(key)) throw new GeminiError("taken", 409, "That username is taken. Try another one.");

    // 2. Gemini checks it is appropriate. If it can't answer, the name is NOT accepted.
    const verdict = await geminiJSON<{ appropriate?: boolean; reason?: string }>({
      model: MODEL_FAST,
      system: SYSTEM,
      user: `Proposed username: "${name}"`,
      temperature: 0,
      signal: req.signal,
    });
    if (verdict.appropriate !== true) {
      throw new GeminiError("rejected", 422, String(verdict.reason || "Let's pick a friendlier name that everyone would be happy to see.").slice(0, 160));
    }

    // 3. claim it (atomic, so two people can't both get the same name)
    const rec: UserRecord = { name, at: Date.now(), ...(await hashPassword(password)) };
    const token = addSession(rec);
    if (!(await claimName(key, rec))) throw new GeminiError("taken", 409, "That username is taken. Try another one.");
    return { name, token, hasPassword: true, mode: storageMode };
  });
}
