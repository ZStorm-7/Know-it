import { NextResponse } from "next/server";
import { MODEL_FAST, MODEL_SMART, readKeys } from "@/lib/server/gemini";

// A quick health check for the AI: open /api/ai-status before a demo.
// It sends one tiny request per configured key and per model, and never shows a key.
// The answer is cached for a minute so nobody can use this page to burn credits.
let cache: { at: number; body: unknown } | null = null;

async function probe(key: string, model: string): Promise<string> {
  try {
    // Call the endpoint directly so each key is judged on its own, without the automatic fallback.
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: 20,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: 'Reply with {"ok":true}' }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return "ok";
    const t = (await res.text().catch(() => "")).toLowerCase();
    if (res.status === 402 || t.includes("credits") || t.includes("billing")) return "out of credits";
    if (res.status === 429 || t.includes("quota")) return "quota reached";
    if (res.status === 401 || res.status === 403) return "key rejected";
    if (res.status === 404) return "model not available";
    return `error ${res.status}`;
  } catch {
    return "could not reach Gemini";
  }
}

export async function GET() {
  if (cache && Date.now() - cache.at < 60_000) return NextResponse.json(cache.body, { headers: { "Cache-Control": "no-store" } });
  const keys = readKeys();
  const keyResults = await Promise.all(
    keys.map(async (k) => ({ key: k.label, [MODEL_SMART]: await probe(k.key, MODEL_SMART), [MODEL_FAST]: await probe(k.key, MODEL_FAST) })),
  );
  const works = keyResults.some((r) => r[MODEL_SMART] === "ok" || r[MODEL_FAST] === "ok");
  const body = {
    ready: works,
    backupKeyConfigured: keys.some((k) => k.label === "backup"),
    keys: keyResults,
    note: works
      ? "At least one key and model is working. If the first choice fails, the app switches to the next automatically."
      : "No key is working right now. Add credits or a valid key.",
    checkedAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), body };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
