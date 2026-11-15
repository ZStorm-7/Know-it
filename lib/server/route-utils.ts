import { NextRequest, NextResponse } from "next/server";
import { GeminiError } from "./gemini";

// Simple in-memory sliding-window rate limit per IP (per server instance).
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;

export function rateLimited(req: NextRequest): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > MAX_PER_WINDOW;
}

export async function handle(
  req: NextRequest,
  fn: (body: Record<string, unknown>) => Promise<unknown>,
) {
  if (rateLimited(req)) {
    return NextResponse.json(
      { error: "Whoa, slow down! Nimbus needs a breather. Try again in a minute." },
      { status: 429 },
    );
  }
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    return NextResponse.json(await fn(body));
  } catch (e) {
    if ((e as Error)?.name === "AbortError") {
      return NextResponse.json({ error: "Cancelled" }, { status: 499 });
    }
    const status = e instanceof GeminiError ? e.status : 500;
    console.error("[api]", e);
    const isNetwork = (e as Error)?.message?.includes("fetch failed");
    const msg =
      e instanceof GeminiError && e.userMessage
        ? e.userMessage
        : isNetwork
          ? "The server can't reach the AI. Check your internet connection."
          : "Something went wrong on the server. Please try again.";
    return NextResponse.json({ error: msg }, { status });
  }
}
