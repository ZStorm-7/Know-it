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
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export async function geminiJSON<T>(opts: {
  model: string;
  system: string;
  user: string;
  imageDataUrl?: string;
  temperature?: number;
  signal?: AbortSignal;
}): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("Server is missing GEMINI_API_KEY", 500);

  const content: Part[] = [{ type: "text", text: opts.user }];
  if (opts.imageDataUrl) {
    content.push({ type: "image_url", image_url: { url: opts.imageDataUrl } });
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    signal: opts.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: opts.temperature ?? 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GeminiError(`Gemini ${res.status}: ${text.slice(0, 300)}`, res.status === 429 ? 429 : 502);
  }
  const data = await res.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? "";
  return parseJSON<T>(raw);
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
    throw new GeminiError("AI returned an unreadable answer");
  }
}

// Validates a base64 JPEG/PNG/WebP data URL and its size (~2.5 MB max).
export function checkImage(dataUrl: unknown): string {
  if (typeof dataUrl !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) {
    throw new GeminiError("A photo is required", 400);
  }
  if (dataUrl.length > 3_500_000) throw new GeminiError("Photo is too large", 413);
  return dataUrl;
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
