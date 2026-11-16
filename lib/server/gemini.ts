// Server-only Gemini helper using the OpenAI-compatible endpoint.
// The key comes from GEMINI_API_KEY. In Claude cloud sessions the network
// proxy injects the real key, so the variable can hold a placeholder there.

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export const MODEL_SMART = "gemini-3.5-flash";
export const MODEL_FAST = "gemini-3.5-flash-lite";

type Part =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export class GeminiError extends Error {
  status: number;
  /** Safe, friendly text to show the user. */
  userMessage?: string;
  /** The HTTP status Gemini itself answered with (if the error came from Gemini). */
  upstream?: number;
  constructor(message: string, status = 502, userMessage?: string) {
    super(message);
    this.status = status;
    this.userMessage = userMessage;
  }
}

function explain(status: number, body: string): { status: number; user: string } {
  const b = body.toLowerCase();
  if (b.includes("api key") || b.includes("api_key") || status === 401 || status === 403)
    return { status: 401, user: "The Gemini API key is invalid or not allowed. Check GEMINI_API_KEY and restart the server." };
  if (status === 402 || b.includes("credits") || b.includes("billing"))
    return { status: 402, user: "The Gemini API key is out of credits. Add billing or credits in Google AI Studio, or use another key." };
  if (status === 429 || b.includes("quota") || b.includes("resource_exhausted"))
    return { status: 429, user: "The AI is busy or the free quota ran out. Wait a minute and try again." };
  if (status === 404) return { status: 502, user: "This Gemini model is not available for your key." };
  return { status: 502, user: "The AI service had a hiccup. Please try again." };
}

/** Reads an env var, tolerating a BOM (Notepad), quotes or stray spaces. */
function readEnv(wanted: string): string | undefined {
  const name = Object.keys(process.env).find((k) => k.replace(/^\uFEFF/, "").trim() === wanted);
  const raw = name ? process.env[name] : undefined;
  const v = raw?.trim().replace(/^["']|["']$/g, "").trim();
  return v && v !== "your-gemini-key-here" ? v : undefined;
}

/**
 * The keys to try, in order: GEMINI_API_KEY first, then the optional GEMINI_API_KEY_BACKUP
 * (a second key, ideally from a different Google project or billing account).
 */
export function readKeys(): { label: "primary" | "backup"; key: string }[] {
  const out: { label: "primary" | "backup"; key: string }[] = [];
  const a = readEnv("GEMINI_API_KEY");
  const b = readEnv("GEMINI_API_KEY_BACKUP");
  if (a) out.push({ label: "primary", key: a });
  if (b && b !== a) out.push({ label: "backup", key: b });
  return out;
}

const otherModel = (m: string) => (m === MODEL_SMART ? MODEL_FAST : MODEL_SMART);

/** Calls Gemini and returns parsed JSON. An unreadable answer is retried once before giving up. */
export async function geminiJSON<T>(opts: Opts): Promise<T> {
  try {
    return await geminiOnce<T>(opts);
  } catch (e) {
    if (e instanceof GeminiError && /unreadable/i.test(e.message)) return geminiOnce<T>(opts);
    throw e;
  }
}

type Opts = {
  model: string;
  system: string;
  user: string;
  imageDataUrl?: string;
  temperature?: number;
  signal?: AbortSignal;
};

/** Problems that another key or another model might get around. Bad requests (400) and cancellations are not retried. */
const worthSwitching = (status: number) => [401, 402, 403, 404, 429, 500, 502, 503, 504].includes(status);

/**
 * Asks Gemini, and if that fails for a reason that is about the account or the service
 * (no credits, quota, busy, model unavailable), tries the next option:
 *   1. the requested model on the primary key
 *   2. the other model on the primary key
 *   3. the requested model on the backup key (if GEMINI_API_KEY_BACKUP is set)
 *   4. the other model on the backup key
 * The first answer that works is used. The error shown is the first one if everything fails.
 */
async function geminiOnce<T>(opts: Opts): Promise<T> {
  const keys = readKeys();
  if (!keys.length)
    throw new GeminiError("Server is missing GEMINI_API_KEY", 500, "No Gemini API key found. Set GEMINI_API_KEY in .env.local (or in Vercel), then restart the server.");

  const plan = keys.flatMap((k) => [
    { ...k, model: opts.model },
    { ...k, model: otherModel(opts.model) },
  ]);
  let first: unknown;
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    try {
      const raw = await callGemini(step.key, step.model, opts, plan.length > 1);
      if (i > 0) console.warn(`[gemini] used ${step.label} key with ${step.model} (first choice failed)`);
      return parseJSON<T>(raw);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      first ??= e;
      const switchable = e instanceof GeminiError ? (e.upstream === undefined ? false : worthSwitching(e.upstream)) : true; // network errors are switchable
      if (!switchable || i === plan.length - 1) throw first;
    }
  }
  throw first;
}

async function callGemini(key: string, model: string, opts: Opts, hasFallback: boolean): Promise<string> {
  const content: Part[] = [{ type: "text", text: opts.user }];
  if (opts.imageDataUrl) content.push({ type: "image_url", image_url: { url: opts.imageDataUrl } });
  const body = JSON.stringify({
    model,
    temperature: opts.temperature ?? 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content },
    ],
  });
  const call = () =>
    fetch(ENDPOINT, {
      method: "POST",
      signal: opts.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body,
    });

  // Retry short outages (busy, server errors, dropped connections). With a fallback ready, retry once; otherwise twice.
  // Never retry bad keys or empty credits: those will not fix themselves.
  const tries = hasFallback ? 2 : 3;
  let res: Response | null = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      res = await call();
      if (![429, 500, 502, 503, 504].includes(res.status) || attempt === tries - 1) break;
      const text = await res.clone().text().catch(() => "");
      if (/credits|billing|api key|quota/i.test(text)) break;
    } catch (e) {
      if ((e as Error)?.name === "AbortError" || attempt === tries - 1) throw e;
    }
    await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
  }
  if (!res) throw new GeminiError("no response", 502, "The AI service had a hiccup. Please try again.");

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const why = explain(res.status, text);
    const err = new GeminiError(`Gemini ${res.status}: ${text.slice(0, 300)}`, why.status, why.user);
    err.upstream = res.status;
    throw err;
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

function parseJSON<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as T;
      } catch {}
    }
    throw new GeminiError("AI returned an unreadable answer", 502, "Nimbus got a garbled answer. Please try again.");
  }
}

// Validates a base64 JPEG/PNG/WebP data URL and its size (~2.5 MB max).
export function checkImage(dataUrl: unknown): string {
  if (typeof dataUrl !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) {
    throw new GeminiError("A photo is required", 400, "Please take or pick a photo first.");
  }
  if (dataUrl.length > 3_500_000) throw new GeminiError("Photo is too large", 413, "That photo is too big. Try another one.");
  return dataUrl;
}

export const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Hindi", "Tamil", "Telugu", "Chinese (Simplified)", "Japanese", "Korean", "Arabic"];

/** One prompt line asking for answers in the user's language (English if unknown). */
export function languageLine(lang: unknown): string {
  const l = LANGUAGES.includes(String(lang)) ? String(lang) : "English";
  return l === "English" ? "" : `Write every text value in ${l}. Keep JSON keys in English.`;
}

export type Box = [number, number, number, number]; // ymin, xmin, ymax, xmax (0-1000)

// Confidence may come back as 0-1 or 0-100; normalize to 0-100.
export function cleanConf(v: unknown): number {
  let n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n > 0 && n <= 1) n *= 100;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function cleanBox(b: unknown): Box | null {
  while (Array.isArray(b) && b.length === 1 && Array.isArray(b[0])) b = b[0];
  if (!Array.isArray(b) || b.length !== 4) return null;
  const n = b.map((v) => Math.max(0, Math.min(1000, Number(v))));
  if (n.some((v) => Number.isNaN(v))) return null;
  const [y0, x0, y1, x1] = n;
  if (y1 - y0 < 5 || x1 - x0 < 5) return null;
  return [y0, x0, y1, x1];
}
