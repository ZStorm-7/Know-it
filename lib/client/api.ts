"use client";
import { getState, type Box } from "./store";

export class ApiError extends Error {}

async function post<T>(url: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiError("You're offline. Connect to the internet to talk to Nimbus. Your board still works offline.");
  }
  const send = () =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, lang: getState().settings.language }),
      signal,
    });
  let res: Response;
  try {
    res = await send();
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    await new Promise((r) => setTimeout(r, 800)); // one retry for a dropped connection
    try {
      res = await send();
    } catch (e2) {
      if ((e2 as Error)?.name === "AbortError") throw e2;
      throw new ApiError("Can't reach the server. Check your internet connection and try again.");
    }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "Something went wrong. Please try again.");
  return data as T;
}

export type Detected = { name: string; box: Box; confidence: number };

export const api = {
  detect: (image: string, signal?: AbortSignal) =>
    post<{ hasPerson: boolean; objects: Detected[] }>("/api/detect", { image }, signal),
  facts: (
    body: { image: string; target: string; avoid: string[]; style: string; typed?: boolean },
    signal?: AbortSignal,
  ) =>
    post<{
      object: string;
      title: string;
      category: string;
      facts: string[];
      quiz: { question: string; options: string[]; answer: number } | null;
      confidence: number;
    }>("/api/facts", body, signal),
  challenge: (round: number, used: string[], signal?: AbortSignal) =>
    post<{ challenge: string }>("/api/hunt/challenge", { round, used }, signal),
  check: (image: string, challenge: string, signal?: AbortSignal, target?: { name: string; box: Box }, level?: number) =>
    post<{ match: boolean; object: string; box: Box | null; comment: string; wow: string; confidence: number }>(
      "/api/hunt/check",
      { image, challenge, target, level },
      signal,
    ),
  compliment: (signal?: AbortSignal) => post<{ compliment: string }>("/api/compliment", {}, signal),
  register: (name: string, password: string, signal?: AbortSignal) =>
    post<{ name: string; token: string; hasPassword: boolean; mode: string }>("/api/leaderboard/register", { name, password }, signal),
  login: (name: string, password: string, signal?: AbortSignal) =>
    post<{ name: string; token: string; hasPassword: boolean; rank: number | null; score: number }>("/api/leaderboard/login", { name, password }, signal),
  submitScore: (name: string, token: string, score: number, signal?: AbortSignal) =>
    post<{ rank: number; score: number }>("/api/leaderboard/score", { name, token, score }, signal),
  changePassword: (name: string, token: string, oldPassword: string, newPassword: string, signal?: AbortSignal) =>
    post<{ token: string; hasPassword: boolean }>("/api/leaderboard/password", { name, token, oldPassword, newPassword }, signal),
  deleteAccount: (name: string, token: string, password: string, signal?: AbortSignal) =>
    post<{ ok: boolean }>("/api/leaderboard/delete", { name, token, password }, signal),
  logout: (name: string, token: string) => post<{ ok: boolean }>("/api/leaderboard/logout", { name, token }).catch(() => null),
  leaderboard: async (name?: string, limit = 20): Promise<BoardData> => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (name) q.set("name", name);
    const res = await fetch(`/api/leaderboard?${q}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || "The leaderboard is unavailable right now.");
    return data as BoardData;
  },
};

export type BoardEntry = { rank: number; name: string; score: number };
export type BoardData = { mode: string; entries: BoardEntry[]; me: { rank: number; score: number } | null };
