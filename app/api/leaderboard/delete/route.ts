import { NextRequest } from "next/server";
import { GeminiError } from "@/lib/server/gemini";
import { deleteUser, getUser, nameKey } from "@/lib/server/board-store";
import { handle } from "@/lib/server/route-utils";

export async function POST(req: NextRequest) {
  return handle(req, async (body) => {
    const name = String(body.name ?? "");
    const token = String(body.token ?? "");
    const key = nameKey(name);
    const user = await getUser(key);
    if (!user || user.token !== token) throw new GeminiError("auth", 401, "We couldn't verify your account.");
    await deleteUser(key);
    return { ok: true };
  });
}
