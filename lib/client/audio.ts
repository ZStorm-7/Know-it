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

// ---------- phone music ----------
// On phones the music is a normal <audio> element, not decoded Web Audio buffers:
//  - decoding all four tracks needs about 200 MB of memory, which phones can't spare, so playback failed;
//  - an <audio> element keeps playing when an iPhone's silent switch is on;
//  - one element that is unlocked by the first tap can then switch tracks freely.
// Computers keep the crossfading Web Audio version below.
const onPhone = () => getState().settings.device !== "desktop";
export const isIOS = () =>
  typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

let el: HTMLAudioElement | null = null;
let wanted: Track | null = null;
let fadeRaf = 0;

function musicEl() {
  if (!el) {
    el = new Audio();
    el.loop = true;
    el.preload = "auto";
    el.setAttribute("playsinline", "");
  }
  return el;
}

function setElVolume(a: HTMLAudioElement, v: number) {
  try {
    a.volume = Math.max(0, Math.min(1, v)); // iPhones ignore this; people use the volume buttons there
  } catch {}
}

function phoneVolume() {
  return getState().settings.music;
}

function fadeTo(a: HTMLAudioElement, target: number, ms: number, done?: () => void) {
  cancelAnimationFrame(fadeRaf);
  const from = a.volume;
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / ms);
    setElVolume(a, from + (target - from) * k);
    if (k < 1) fadeRaf = requestAnimationFrame(step);
    else done?.();
  };
  fadeRaf = requestAnimationFrame(step);
}

function phonePlay(track: Track) {
  const a = musicEl();
  wanted = track;
  const vol = phoneVolume();
  if (vol <= 0) {
    a.pause();
    return;
  }
  const url = `/music/${track}.mp3`;
  const start = () => {
    if (!a.src.endsWith(url)) a.src = url;
    a.loop = true;
    setElVolume(a, 0);
    a.play()
      .then(() => fadeTo(a, vol, 700))
      .catch(() => setElVolume(a, vol)); // blocked until the next tap; the tap handler below retries
  };
  if (a.src && !a.paused && !a.src.endsWith(url)) fadeTo(a, 0, 250, start);
  else start();
}

let gestureHooked = false;
function hookGestures() {
  if (gestureHooked) return;
  gestureHooked = true;
  // after a call, a lock screen or a blocked start, the next tap brings sound back
  const wake = () => {
    if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});
    if (onPhone() && el && wanted && el.paused && phoneVolume() > 0) el.play().then(() => setElVolume(el!, phoneVolume())).catch(() => {});
  };
  document.addEventListener("pointerdown", wake, { passive: true });
  document.addEventListener("touchend", wake, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!onPhone() || !el) return;
    if (document.hidden) el.pause();
    else if (wanted && phoneVolume() > 0) el.play().catch(() => {});
  });
}

/** Must be called from a user gesture (the splash "Tap to start"). */
export function unlockAudio() {
  hookGestures();
  try {
    // iOS 16.4+: let sound play even when the silent switch is on
    const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (s && onPhone()) s.type = "playback";
  } catch {}
  const c = ac();
  if (c.state === "suspended") c.resume().catch(() => {});
  if (onPhone()) {
    // start the first track right inside the tap, so the phone lets us keep playing later
    wanted = "home";
    const a = musicEl();
    if (a.src.endsWith("/music/home.mp3") && !a.paused) return; // already playing (it started early): do not restart it
    a.src = "/music/home.mp3";
    setElVolume(a, 0);
    a.play()
      .then(() => fadeTo(a, phoneVolume(), 900))
      .catch(() => {});
  }
}

let armed = false;
/**
 * Start the music as early as the browser allows, before "Tap to start".
 * Browsers only allow sound after a touch, so this tries right away, and otherwise starts the music
 * on the very first touch, click or key press anywhere (for example while the opening animation plays).
 */
export function armEarlyMusic() {
  if (armed || typeof window === "undefined") return;
  armed = true;
  if (phoneVolume() <= 0) return;

  if (onPhone()) {
    // some browsers allow it straight away (for example Android Chrome on a site people use often)
    wanted = "home";
    const a = musicEl();
    a.src = "/music/home.mp3";
    setElVolume(a, 0);
    a.play()
      .then(() => fadeTo(a, phoneVolume(), 1200))
      .catch(() => {});
  }

  const events = ["pointerup", "touchend", "click", "keydown"] as const;
  const first = () => {
    events.forEach((e) => document.removeEventListener(e, first));
    unlockAudio();
    if (!onPhone()) {
      preloadMusic();
      playMusic("home");
    }
  };
  events.forEach((e) => document.addEventListener(e, first, { passive: true }));
}

export function setMusicVolume(v: number) {
  if (onPhone()) {
    if (!el) return;
    if (v <= 0) el.pause();
    else {
      setElVolume(el, v);
      if (el.paused && wanted) el.play().catch(() => {});
    }
    return;
  }
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
  if (onPhone()) return; // phones stream one track at a time
  (["home", "facts", "hunt", "board"] as Track[]).forEach((t) => loadTrack(t).catch(() => {}));
}

export async function playMusic(track: Track) {
  if (typeof window === "undefined") return;
  if (onPhone()) {
    if (wanted === track && el && !el.paused) return;
    phonePlay(track);
    return;
  }
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
