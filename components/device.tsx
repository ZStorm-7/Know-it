"use client";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/client/audio";
import { needsUsername, setSetting } from "@/lib/client/store";
import { useNav } from "./app";
import { CLOUD_PATH, Nimbus } from "./art";

/** Animated phone: a finger taps, a ripple spreads, a little cloud floats on the screen. */
export function PhoneIllustration({ size = 150 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 170) / 120} viewBox="0 0 120 170" aria-hidden className="device-art">
      <rect x="14" y="8" width="92" height="154" rx="18" fill="#1e293b" />
      <rect x="20" y="20" width="80" height="130" rx="10" fill="url(#ph-screen)" />
      <defs>
        <linearGradient id="ph-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <rect x="46" y="12" width="28" height="5" rx="2.5" fill="#475569" />
      <g className="dv-bob" transform="translate(32 40) scale(0.46)">
        <path d={CLOUD_PATH} fill="#fff" stroke="#1e293b" strokeWidth="4" strokeLinejoin="round" />
      </g>
      <rect x="30" y="84" width="60" height="14" rx="7" fill="#ffd23f" stroke="#1e293b" strokeWidth="2" />
      <rect x="30" y="104" width="60" height="14" rx="7" fill="#ff6fae" stroke="#1e293b" strokeWidth="2" />
      <circle className="dv-ripple" cx="60" cy="91" r="6" fill="none" stroke="#fff" strokeWidth="3" />
      <g className="dv-tap">
        <circle cx="60" cy="96" r="7" fill="#fde68a" stroke="#1e293b" strokeWidth="2.5" />
      </g>
    </svg>
  );
}

/** Animated computer: the cursor glides across the window and clicks a button. */
export function DesktopIllustration({ size = 190 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 140) / 180} viewBox="0 0 180 140" aria-hidden className="device-art">
      <rect x="10" y="8" width="160" height="100" rx="10" fill="#1e293b" />
      <rect x="17" y="15" width="146" height="86" rx="5" fill="url(#dk-screen)" />
      <defs>
        <linearGradient id="dk-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <rect x="17" y="15" width="146" height="12" rx="5" fill="rgba(255,255,255,0.35)" />
      <circle cx="26" cy="21" r="2.5" fill="#fb7185" />
      <circle cx="34" cy="21" r="2.5" fill="#fde68a" />
      <circle cx="42" cy="21" r="2.5" fill="#86efac" />
      <g className="dv-bob" transform="translate(30 36) scale(0.4)">
        <path d={CLOUD_PATH} fill="#fff" stroke="#1e293b" strokeWidth="4" strokeLinejoin="round" />
      </g>
      <rect x="84" y="40" width="68" height="14" rx="7" fill="#ffd23f" stroke="#1e293b" strokeWidth="2" />
      <rect x="84" y="60" width="68" height="14" rx="7" fill="#ff6fae" stroke="#1e293b" strokeWidth="2" />
      <rect x="84" y="80" width="68" height="14" rx="7" fill="#34d399" stroke="#1e293b" strokeWidth="2" />
      <rect x="78" y="108" width="24" height="14" fill="#475569" />
      <rect x="56" y="122" width="68" height="8" rx="4" fill="#334155" />
      <g className="dv-cursor">
        <path d="M0 0 L0 15 L4 11.5 L7 18 L10 16.5 L7 10.5 L12.5 10.5 Z" fill="#fff" stroke="#1e293b" strokeWidth="1.6" strokeLinejoin="round" />
      </g>
      <circle className="dv-click" cx="118" cy="67" r="5" fill="none" stroke="#fff" strokeWidth="2.5" />
    </svg>
  );
}

export function DeviceScreen() {
  const { go } = useNav();
  const root = useRef<HTMLDivElement>(null);
  const [guess] = useState<"phone" | "desktop">(() =>
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches ? "phone" : "desktop",
  );

  useEffect(() => {
    gsap.fromTo(
      root.current!.querySelectorAll("[data-in]"),
      { y: 50, opacity: 0, scale: 0.9 },
      { y: 0, opacity: 1, scale: 1, duration: 0.7, stagger: 0.12, ease: "back.out(1.7)" },
    );
  }, []);

  const choose = (d: "phone" | "desktop") => {
    sfx("pop", d === "phone" ? 1.1 : 0.9);
    setSetting("device", d);
    go(needsUsername() ? "username" : "home");
  };

  const card = (d: "phone" | "desktop", title: string, text: string) => (
    <button
      key={d}
      data-in
      onClick={() => choose(d)}
      className="card relative flex w-full flex-col items-center gap-2 px-4 py-4 text-center transition active:scale-[0.97]"
      style={{ minHeight: "clamp(190px, 31dvh, 270px)" }}
    >
      {guess === d && (
        <span className="absolute -top-3 right-3 rounded-full border-2 border-[var(--ink)] bg-[var(--sun)] px-2.5 py-0.5 text-xs font-extrabold text-[var(--ink)]">
          Looks like you
        </span>
      )}
      <div className="flex flex-1 items-center justify-center">{d === "phone" ? <PhoneIllustration size={104} /> : <DesktopIllustration size={170} />}</div>
      <div className="font-display text-2xl">{title}</div>
      <div className="text-sm font-bold text-[var(--ink-soft)]">{text}</div>
    </button>
  );

  return (
    <div ref={root} className="no-scrollbar flex h-full flex-col items-center overflow-y-auto px-5" style={{ paddingTop: "max(20px, 3dvh)", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
      <div data-in className="flex items-center gap-3">
        <Nimbus size={96} mood="happy" className="bob" />
      </div>
      <h2 data-in className="font-display mt-1 text-center text-[clamp(1.7rem,7.5vw,2.4rem)] leading-tight" style={{ textShadow: "0 3px 0 #8b5cf6" }}>
        What are you using?
      </h2>
      <p data-in className="mt-1 mb-4 max-w-sm text-center text-sm font-bold opacity-95">
        Pick one so the buttons fit your screen. You can change it anytime in Settings.
      </p>
      <div className="m-auto grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {card("phone", "Phone or tablet", "Big touch buttons, one-hand layout, your camera app")}
        {card("desktop", "Computer", "Roomy layout, webcam or photo upload, mouse friendly")}
      </div>
    </div>
  );
}
