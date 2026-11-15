"use client";
import { useSyncExternalStore } from "react";
import { del, get, set } from "idb-keyval";

export type Box = [number, number, number, number];

export type Settings = {
  theme: "system" | "light" | "dark";
  music: number; // 0..1
  sfx: boolean;
  haptics: boolean;
  reduceMotion: boolean;
  textSize: "s" | "m" | "l";
  factStyle: "kid" | "normal" | "nerdy";
  huntStart: "easy" | "normal";
  language: string;
  contrast: boolean;
  huntPick: boolean;
  /** "" until the player picks Phone or Computer on first launch. */
  device: "" | "phone" | "desktop";
};

export type Note = {
  id: string;
  title: string;
  /** The AI's original name, so a renamed note can be reverted. */
  suggested?: string;
  object: string;
  category?: string;
  x: number;
  y: number;
  rot: number;
  color: number;
  createdAt: number;
  fresh?: boolean;
};

export type NoteDetail = {
  photo: string;
  box: Box | null;
  facts: string[];
  confidence: number;
  object: string;
};

export type State = {
  xp: number;
  huntBest: number;
  tutorialDone: boolean;
  boardHintDone: boolean;
  cameraExplained: boolean;
  settings: Settings;
  notes: Note[];
  seenFacts: Record<string, string[]>;
  streak: { count: number; best: number; last: string };
  /** Leaderboard account. token proves the name is yours. */
  profile: { name: string; token: string } | null;
  /** True if the player chose to skip the username step. */
  guest: boolean;
  leaderboard: { name: string; score: number; at: number }[];
};

const KEY = "knowit:v1";

export const DEFAULT_SETTINGS: Settings = {
  theme: "light",
  music: 0.35,
  sfx: true,
  haptics: true,
  reduceMotion: false,
  textSize: "m",
  factStyle: "normal",
  huntStart: "easy",
  language: "English",
  contrast: false,
  huntPick: false,
  device: "",
};

const DEFAULT: State = {
  xp: 0,
  huntBest: 0,
  tutorialDone: false,
  boardHintDone: false,
  cameraExplained: false,
  settings: DEFAULT_SETTINGS,
  notes: [],
  seenFacts: {},
  streak: { count: 0, best: 0, last: "" },
  profile: null,
  guest: false,
  leaderboard: [],
};

let state: State = DEFAULT;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...DEFAULT, ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } };
      // v2: light mode became the default; switch existing installs once
      if (!parsed.lightDefault) state = { ...state, settings: { ...state.settings, theme: "light" } };
    }
  } catch {}
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, lightDefault: true }));
  } catch {}
}

export function getState(): State {
  load();
  return state;
}

export function update(fn: (s: State) => State) {
  load();
  state = fn(state);
  save();
  listeners.forEach((l) => l());
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => select(getState()),
    () => select(DEFAULT),
  );
}

export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
  update((s) => ({ ...s, settings: { ...s.settings, [k]: v } }));
}

export function addXp(n: number) {
  update((s) => ({ ...s, xp: s.xp + n }));
}

export function resetProgress() {
  const ids = getState().notes.map((n) => n.id);
  ids.forEach((id) => del(`note:${id}`).catch(() => {}));
  update((s) => ({ ...DEFAULT, settings: s.settings, tutorialDone: s.tutorialDone, cameraExplained: s.cameraExplained }));
}

// ---------- Levels ----------
export const LEVELS = [
  { xp: 0, name: "Curious Cloud" },
  { xp: 60, name: "Drizzle Thinker" },
  { xp: 150, name: "Bright Breeze" },
  { xp: 300, name: "Rainbow Reader" },
  { xp: 500, name: "Storm Scholar" },
  { xp: 800, name: "Thunder Genius" },
  { xp: 1200, name: "Sky Sage" },
];

export function levelInfo(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1];
  const progress = next ? (xp - cur.xp) / (next.xp - cur.xp) : 1;
  return { level: i + 1, name: cur.name, progress, next: next?.xp ?? null };
}

// ---------- Facts memory ----------
export function objectKey(name: string) {
  const words = name.toLowerCase().replace(/[^a-z\s]/g, "").trim().split(/\s+/).filter(Boolean);
  return words.slice(-2).join(" ") || "thing";
}

export function rememberFacts(key: string, facts: string[]) {
  update((s) => ({
    ...s,
    seenFacts: { ...s.seenFacts, [key]: [...(s.seenFacts[key] ?? []), ...facts].slice(-60) },
  }));
}

// ---------- Notes (metadata in localStorage, photos in IndexedDB) ----------
export const NOTE_COLOR_COUNT = 5;

export async function addNote(title: string, detail: NoteDetail, color?: number, category?: string): Promise<Note> {
  const id = Math.random().toString(36).slice(2, 10);
  const { notes } = getState();
  const i = notes.length;
  const col = i % 3;
  const row = Math.floor(i / 3);
  const note: Note = {
    id,
    title,
    suggested: title,
    object: detail.object,
    category,
    x: col * 215 + (Math.random() * 24 - 12),
    y: row * 235 + (Math.random() * 24 - 12),
    rot: Math.random() * 10 - 5,
    color: color ?? Math.floor(Math.random() * NOTE_COLOR_COUNT),
    createdAt: Date.now(),
    fresh: true,
  };
  await set(`note:${id}`, detail);
  update((s) => ({ ...s, notes: [...s.notes, note] }));
  return note;
}

export function getNoteDetail(id: string) {
  return get<NoteDetail>(`note:${id}`);
}

export function patchNote(id: string, patch: Partial<Note>) {
  update((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
}

export function removeNote(id: string): Note | undefined {
  const note = getState().notes.find((n) => n.id === id);
  update((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));
  return note;
}

export function restoreNote(note: Note) {
  update((s) => ({ ...s, notes: [...s.notes, note] }));
}

export function purgeNoteDetail(id: string) {
  del(`note:${id}`).catch(() => {});
}

// ---------- Streaks ----------
// A streak counts days in a row with at least one Facts snap or Hunt find, by the phone's local date.
function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Records activity today. Returns the new streak count if it went up, otherwise null. */
export function recordActivity(): number | null {
  const today = dayKey(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = dayKey(y);
  const cur = getState().streak;
  if (cur.last === today) return null;
  const count = cur.last === yesterday ? cur.count + 1 : 1;
  update((s) => ({ ...s, streak: { count, best: Math.max(s.streak.best, count), last: today } }));
  return count;
}

/** The streak to show: it resets to 0 once a whole day is missed. */
export function liveStreak(st: State["streak"]): number {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return st.last === dayKey(new Date()) || st.last === dayKey(y) ? st.count : 0;
}

// ---------- Room leaderboard (on this device, pass the phone) ----------
export function addLeader(name: string, score: number) {
  const entry = { name: name.trim().slice(0, 16) || "Player", score, at: Date.now() };
  update((s) => ({
    ...s,
    leaderboard: [...s.leaderboard, entry].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, 10),
  }));
}

// ---------- Backup and restore ----------
export async function exportBackup(): Promise<Blob> {
  const st = getState();
  const details: Record<string, NoteDetail> = {};
  for (const n of st.notes) {
    const d = await getNoteDetail(n.id).catch(() => undefined);
    if (d) details[n.id] = d;
  }
  return new Blob([JSON.stringify({ app: "curio", version: 1, savedAt: new Date().toISOString(), state: st, details })], {
    type: "application/json",
  });
}

export async function importBackup(file: File): Promise<number> {
  const data = JSON.parse(await file.text());
  if (data?.app !== "curio" || !data.state || !Array.isArray(data.state.notes)) throw new Error("This is not a Curio backup file.");
  for (const [id, d] of Object.entries(data.details ?? {})) await set(`note:${id}`, d);
  const incoming = data.state as State;
  update(() => ({ ...DEFAULT, ...incoming, settings: { ...DEFAULT_SETTINGS, ...incoming.settings } }));
  return incoming.notes.length;
}

// ---------- Leaderboard account ----------
export function setProfile(p: { name: string; token: string } | null) {
  update((s) => ({ ...s, profile: p, guest: p ? false : s.guest }));
}
export function chooseGuest() {
  update((s) => ({ ...s, guest: true }));
}
/** First-launch check: has the player picked a username (or chosen to skip)? */
export function needsUsername(): boolean {
  const s = getState();
  return !s.profile && !s.guest;
}
