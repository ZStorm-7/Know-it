// Leaderboard storage.
// Uses Upstash Redis (free, added from Vercel: Storage -> Upstash Redis) when its REST env vars exist.
// Without them it falls back to memory: fine for local testing, but NOT shared or durable on Vercel.

const URL = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
export const storageMode: "redis" | "memory" = URL && TOKEN ? "redis" : "memory";

export type UserRecord = { name: string; token: string; at: number };

// ---------- memory fallback ----------
const memUsers = new Map<string, UserRecord>();
const memScores = new Map<string, number>();

async function redis(cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const j = (await res.json()) as { result?: unknown; error?: string };
  if (j.error) throw new Error(`redis: ${j.error}`);
  return j.result;
}

/** Lowercase, and ignore . - _ so "Sam_1" and "sam1" count as the same name. */
export function nameKey(name: string) {
  return name.toLowerCase().replace(/[._-]/g, "");
}

export async function getUser(key: string): Promise<UserRecord | null> {
  if (storageMode === "memory") return memUsers.get(key) ?? null;
  const raw = (await redis(["HGET", "users", key])) as string | null;
  return raw ? (JSON.parse(raw) as UserRecord) : null;
}

/** Atomically claims a name. Returns false if someone already has it. */
export async function claimName(key: string, rec: UserRecord): Promise<boolean> {
  if (storageMode === "memory") {
    if (memUsers.has(key)) return false;
    memUsers.set(key, rec);
    return true;
  }
  return (await redis(["HSETNX", "users", key, JSON.stringify(rec)])) === 1;
}

/** Keeps only the player's best score. */
export async function setBest(key: string, score: number): Promise<void> {
  if (storageMode === "memory") {
    memScores.set(key, Math.max(memScores.get(key) ?? 0, score));
    return;
  }
  await redis(["ZADD", "scores", "GT", score, key]);
}

async function scoreOf(key: string): Promise<number | null> {
  if (storageMode === "memory") return memScores.get(key) ?? null;
  const s = (await redis(["ZSCORE", "scores", key])) as string | null;
  return s === null ? null : Number(s);
}

/** Competition ranking: players with the same score share a rank. */
async function rankFor(score: number): Promise<number> {
  if (storageMode === "memory") return 1 + [...memScores.values()].filter((v) => v > score).length;
  const higher = (await redis(["ZCOUNT", "scores", `(${score}`, "+inf"])) as number;
  return higher + 1;
}

export type Entry = { rank: number; name: string; score: number };

export async function topEntries(limit: number): Promise<Entry[]> {
  let pairs: [string, number][];
  if (storageMode === "memory") {
    pairs = [...memScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  } else {
    const flat = (await redis(["ZREVRANGE", "scores", 0, limit - 1, "WITHSCORES"])) as string[];
    pairs = [];
    for (let i = 0; i < flat.length; i += 2) pairs.push([flat[i], Number(flat[i + 1])]);
  }
  if (!pairs.length) return [];
  let names: (string | null)[];
  if (storageMode === "memory") names = pairs.map(([k]) => memUsers.get(k)?.name ?? null);
  else {
    const raw = (await redis(["HMGET", "users", ...pairs.map(([k]) => k)])) as (string | null)[];
    names = raw.map((r) => (r ? (JSON.parse(r) as UserRecord).name : null));
  }
  const out: Entry[] = [];
  for (let i = 0; i < pairs.length; i++) {
    const name = names[i];
    if (!name) continue;
    out.push({ rank: await rankFor(pairs[i][1]), name, score: pairs[i][1] });
  }
  return out;
}

export async function myEntry(key: string): Promise<{ rank: number; score: number } | null> {
  const score = await scoreOf(key);
  if (score === null) return null;
  return { rank: await rankFor(score), score };
}
