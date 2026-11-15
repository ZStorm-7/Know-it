import { NextResponse } from "next/server";

// The id of the deployed build. The app compares it with its own to know when to refresh.
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({ build: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" }, { headers: { "Cache-Control": "no-store" } });
}
