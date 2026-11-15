import { NextRequest, NextResponse } from "next/server";
import { myEntry, nameKey, storageMode, topEntries } from "@/lib/server/board-store";
import { rateLimited } from "@/lib/server/route-utils";

export async function GET(req: NextRequest) {
  if (rateLimited(req)) return NextResponse.json({ error: "Slow down a little and try again." }, { status: 429 });
  try {
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit")) || 20));
    const me = url.searchParams.get("name");
    const entries = await topEntries(limit);
    const mine = me ? await myEntry(nameKey(me)) : null;
    return NextResponse.json({ mode: storageMode, entries, me: mine }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[leaderboard]", e);
    return NextResponse.json({ error: "The leaderboard is unavailable right now." }, { status: 502 });
  }
}
