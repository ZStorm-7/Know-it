// Password hashing, sessions and password rules for leaderboard accounts.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import type { UserRecord } from "./board-store";

function scrypt(password: string, salt: string): Promise<Buffer> {
  return new Promise((res, rej) => scryptCb(password, salt, 64, (e, k) => (e ? rej(e) : res(k))));
}

export const sha = (t: string) => createHash("sha256").update(t).digest("hex");

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: (await scrypt(password, salt)).toString("hex") };
}

export async function checkPassword(password: string, rec: UserRecord): Promise<boolean> {
  if (!rec.hash || !rec.salt) return false;
  const got = await scrypt(password, rec.salt);
  const want = Buffer.from(rec.hash, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Adds a new sign-in session (one per phone, newest 6 kept) and returns the secret token for it. */
export function addSession(rec: UserRecord): string {
  const token = `${randomBytes(24).toString("hex")}`;
  rec.sessions = [...(rec.sessions ?? []), sha(token)].slice(-6);
  return token;
}

export function validSession(rec: UserRecord, token: string): boolean {
  if (!token) return false;
  if ((rec.sessions ?? []).includes(sha(token))) return true;
  return !!rec.token && rec.token === token; // accounts made before passwords existed
}

const COMMON = new Set(["password", "password1", "12345678", "123456789", "1234567890", "qwerty123", "iloveyou1", "abcd1234", "letmein123", "welcome123", "11111111", "00000000"]);

/** Returns a friendly problem with the password, or null if it is fine. */
export function passwordProblem(pw: string, name: string): string | null {
  if (pw.length < 8) return "Use at least 8 characters.";
  if (pw.length > 64) return "Keep it under 64 characters.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Mix letters and numbers.";
  if (pw.toLowerCase().includes(name.toLowerCase()) && name.length >= 3) return "Your password shouldn't contain your username.";
  if (COMMON.has(pw.toLowerCase())) return "That password is too easy to guess. Try something longer.";
  return null;
}

// Slow down password guessing: 6 wrong tries per name, then a 10 minute pause (per server instance).
const fails = new Map<string, { n: number; until: number }>();
export function lockedOut(key: string): boolean {
  const f = fails.get(key);
  return !!f && f.n >= 6 && Date.now() < f.until;
}
export function noteFail(key: string) {
  const f = fails.get(key);
  const n = !f || Date.now() > f.until ? 1 : f.n + 1;
  fails.set(key, { n, until: Date.now() + 10 * 60_000 });
  if (fails.size > 5000) fails.clear();
}
export function clearFails(key: string) {
  fails.delete(key);
}
