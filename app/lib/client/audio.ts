"use client";
// Sound effects are synthesized with Web Audio (no files, no licensing).
// Music loops per screen with a crossfade at the loop point.
import { getState } from "./store";

let ctx: AudioContext | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;

function ac() {
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new C();
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.6;
    sfxGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = getState().settings.music;
    musicGain.connect(ctx.destination);
    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend();
      else ctx.resume();
    });
  }
  return ctx;
}

/** Must be called from a user gesture (the splash "Tap to start"). */
export function unlockAudio() {
  const c = ac();
  if (c.state === "suspended") c.resume();
}

export function setMusicVolume(v: number) {
  if (musicGain && ctx) musicGain.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
}

export function haptic(pattern: number | number[] = 12) {
  if (!getState().settings.haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

// ---------- SFX ----------
function tone(opts: {
  type?: OscillatorType;
  from: number;
  to?: number;
  dur: number;
  vol?: number;
  delay?: number;
}) {
  const c = ac();
  const t = c.currentTime + (opts.delay ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(opts.from, t);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.4, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  o.connect(g).connect(sfxGain!);
  o.start(t);
  o.stop(t + opts.dur + 0.05);
}

function noise(opts: { dur: number; vol?: number; from?: number; to?: number; delay?: number; q?: number }) {
  const c = ac();
  const t = c.currentTime + (opts.delay ?? 0);
  const len = Math.floor(c.sampleRate * opts.dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = opts.q ?? 1;
  f.frequency.setValueAtTime(opts.from ?? 800, t);
  if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.3, t + opts.dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  src.connect(f).connect(g).connect(sfxGain!);
  src.start(t);
}

export type Sfx =
  | "tap"
  | "pop"
  | "whoosh"
  | "shutter"
  | "chime"
  | "buzz"
  | "thunk"
  | "tick"
  | "levelup"
  | "boing"
  | "lift";

export function sfx(name: Sfx, pitch = 1) {
  if (typeof window === "undefined" || !getState().settings.sfx) return;
  try {
    switch (name) {
      case "tap":
        tone({ from: 700 * pitch, to: 500 * pitch, dur: 0.06, vol: 0.2 });
        break;
      case "pop":
        tone({ from: 520 * pitch, to: 1100 * pitch, dur: 0.09, vol: 0.35 });
        tone({ type: "triangle", from: 1400 * pitch, to: 900 * pitch, dur: 0.05, vol: 0.12, delay: 0.02 });
        break;
      case "whoosh":
        noise({ dur: 0.7, vol: 0.35, from: 300, to: 2400, q: 0.8 });
        break;
      case "shutter":
        noise({ dur: 0.05, vol: 0.5, from: 3000, q: 0.5 });
        noise({ dur: 0.07, vol: 0.4, from: 1800, q: 0.5, delay: 0.07 });
        break;
      case "chime":
        [523, 659, 784, 1047].forEach((f, i) => tone({ type: "triangle", from: f, dur: 0.35, vol: 0.25, delay: i * 0.08 }));
        break;
      case "buzz":
        tone({ type: "square", from: 220, to: 110, dur: 0.35, vol: 0.12 });
        break;
      case "thunk":
        tone({ from: 160, to: 55, dur: 0.18, vol: 0.6 });
        noise({ dur: 0.05, vol: 0.25, from: 1200, q: 2 });
        break;
      case "tick":
        tone({ type: "square", from: 1800, dur: 0.03, vol: 0.08 });
        break;
      case "levelup":
        [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: "triangle", from: f, dur: 0.25, vol: 0.22, delay: i * 0.07 }));
        break;
      case "boing":
        tone({ from: 180, to: 520, dur: 0.25, vol: 0.3 });
        break;
      case "lift":
        tone({ from: 400, to: 800, dur: 0.12, vol: 0.18 });
        break;
    }
  } catch {}
}

// ---------- Music ----------
export type Track = "home" | "facts" | "hunt" | "board";
const buffers = new Map<Track, Promise<AudioBuffer>>();
let current: { track: Track; gen: number; gain: GainNode; sources: AudioBufferSourceNode[]; timer?: number } | null = null;
let gen = 0;
const XFADE = 2;

function loadTrack(t: Track) {
  if (!buffers.has(t)) {
    buffers.set(
      t,
      fetch(`/music/${t}.mp3`)
        .then((r) => r.arrayBuffer())
        .then((b) => ac().decodeAudioData(b)),
    );
  }
  return buffers.get(t)!;
}

export function preloadMusic() {
  (["home", "facts", "hunt", "board"] as Track[]).forEach((t) => loadTrack(t).catch(() => {}));
}

export async function playMusic(track: Track) {
  if (typeof window === "undefined") return;
  if (current?.track === track) return;
  const c = ac();
  const myGen = ++gen;

  // fade out the old track
  if (current) {
    const old = current;
    clearTimeout(old.timer);
    old.gain.gain.cancelScheduledValues(c.currentTime);
    old.gain.gain.setValueAtTime(old.gain.gain.value, c.currentTime);
    old.gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.8);
    setTimeout(() => old.sources.forEach((s) => s.stop()), 900);
    current = null;
  }

  let buf: AudioBuffer;
  try {
    buf = await loadTrack(track);
  } catch {
    return;
  }
  if (myGen !== gen) return;

  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(musicGain!);
  gain.gain.linearRampToValueAtTime(1, c.currentTime + 1);
  const entry = { track, gen: myGen, gain, sources: [] as AudioBufferSourceNode[], timer: undefined as number | undefined };
  current = entry;

  // Each "voice" plays the whole track; the next one starts XFADE seconds before the end.
  const startVoice = (at: number) => {
    if (current !== entry) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    const vg = c.createGain();
    vg.gain.setValueAtTime(0, at);
    vg.gain.linearRampToValueAtTime(1, at + XFADE);
    vg.gain.setValueAtTime(1, at + buf.duration - XFADE);
    vg.gain.linearRampToValueAtTime(0, at + buf.duration);
    src.connect(vg).connect(gain);
    src.start(at);
    entry.sources.push(src);
    if (entry.sources.length > 3) entry.sources.shift();
    const nextAt = at + buf.duration - XFADE;
    entry.timer = window.setTimeout(() => startVoice(nextAt), Math.max(0, (nextAt - c.currentTime - 1) * 1000));
  };
  startVoice(c.currentTime + 0.05);
}
