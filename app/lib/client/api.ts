"use client";
import type { Box } from "./store";

export class ApiError extends Error {}

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "Something went wrong. Please try again.");
  return data as T;
}

export type Detected = { name: string; box: Box; confidence: number };

export const api = {
  detect: (image: string, signal?: AbortSignal) =>
    post<{ hasPerson: boolean; objects: Detected[] }>("/api/detect", { image }, signal),
  facts: (
    body: { image: string; target: string; avoid: string[]; style: string },
    signal?: AbortSignal,
  ) =>
    post<{
      object: string;
      title: string;
      facts: string[];
      quiz: { question: string; options: string[]; answer: number } | null;
      confidence: number;
    }>("/api/facts", body, signal),
  challenge: (round: number, used: string[], signal?: AbortSignal) =>
    post<{ challenge: string }>("/api/hunt/challenge", { round, used }, signal),
  check: (image: string, challenge: string, signal?: AbortSignal) =>
    post<{ match: boolean; object: string; box: Box | null; comment: string; confidence: number }>(
      "/api/hunt/check",
      { image, challenge },
      signal,
    ),
  compliment: (signal?: AbortSignal) => post<{ compliment: string }>("/api/compliment", {}, signal),
};
