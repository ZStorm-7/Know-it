import { NextRequest } from "next/server";
import { sha } from "@/lib/server/auth";
import { getUser, nameKey, putUser } from "@/lib/server/board-store";
import { handle } from "@/lib/server/route-utils";

// Signs this phone out on the server too, so its token stops working.
export async function POST(req: NextRequest) {
  return handle(req, async (body) => {
    const key = nameKey(String(body.name ?? ""));
    const token = String(body.token ?? "");
    const user = await getUser(key);
    if (user && token) {
      user.sessions = (user.sessions ?? []).filter((h) => h !== sha(token));
      await putUser(key, user);
    }
    return { ok: true };
  });
}
