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
};

export type Note = {
  id: string;
  title: string;
  object: string;
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

export async function addNote(title: string, detail: NoteDetail, color?: number): Promise<Note> {
  const id = Math.random().toString(36).slice(2, 10);
  const { notes } = getState();
  const i = notes.length;
  const col = i % 3;
  const row = Math.floor(i / 3);
  const note: Note = {
    id,
    title,
    object: detail.object,
    x: col * 190 + (Math.random() * 24 - 12),
    y: row * 200 + (Math.random() * 24 - 12),
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
