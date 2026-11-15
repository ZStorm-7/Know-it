"use client";
import gsap from "gsap";
import { Camera, Search, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { levelInfo, useStore } from "@/lib/client/store";
import { useNav } from "./app";
import { BrainIcon, Nimbus, Pushpin } from "./art";
import { Logo } from "./logo";
import { Btn, IconBtn } from "./ui";

const FALLBACK = [
  "Your curiosity is basically a superpower.",
  "You ask the kind of questions that make the world more interesting.",
  "Your brain is extra sparkly today.",
  "You notice things other people miss. That's a real gift.",
  "You make learning look easy and fun.",
  "Your kindness makes every room a little brighter.",
  "You have the eyes of a true explorer.",
  "Your sense of wonder is genuinely inspiring.",
]

let cachedCompliment: string | null = null;

export function Home() {
  const { go, openSettings } = useNav();
  const xp = useStore((s) => s.xp);
  const lvl = levelInfo(xp);
  const [compliment, setCompliment] = useState<string | null>(cachedCompliment);
  const root = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (cachedCompliment) return;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 6000);
    api
      .compliment(ctrl.signal)
      .then((r) => r.compliment)
      .catch(() => FALLBACK[Math.floor(Math.random() * FALLBACK.length)])
      .then((c) => {
        cachedCompliment = c;
        setCompliment(c);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      ctrl.abort();
    };
  }, []);

  // word-by-word reveal of the compliment
  useEffect(() => {
    if (!compliment || !textRef.current) return;
    const words = textRef.current.querySelectorAll("span");
    gsap.fromTo(words, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, ease: "power2.out" });
  }, [compliment]);

  // entrance animation
  useEffect(() => {
    const el = root.current!;
    gsap.fromTo(
      el.querySelectorAll("[data-in]"),
      { y: 40, opacity: 0, scale: 0.9 },
      { y: 0, opacity: 1, scale: 1, duration: 0.7, ease: "back.out(1.6)", stagger: 0.09, delay: 0.15 },
    );
  }, []);

  return (
    <div ref={root} className="relative flex h-full flex-col px-5" style={{ paddingTop: "max(14px, 2dvh)", paddingBottom: "max(12px, 1.5dvh)" }}>
      {/* top bar */}
      <div data-in className="flex items-center gap-3">
        <div className="glass flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-3 py-2">
          <BrainIcon size={30} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-sm font-extrabold">
              <span className="truncate">{lvl.name}</span>
              <span className="shrink-0 opacity-80">Lv {lvl.level}</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/30">
              <div className="h-full rounded-full bg-[var(--sun)] transition-[width] duration-700" style={{ width: `${Math.max(6, lvl.progress * 100)}%` }} />
            </div>
          </div>
        </div>
        <IconBtn label="Settings" onClick={openSettings}>
          <Settings size={22} strokeWidth={2.6} />
        </IconBtn>
      </div>

      {/* logo + motto */}
      <div data-in className="flex flex-col items-center" style={{ marginTop: "clamp(8px, 3dvh, 32px)" }}>
        <Logo />
        <p className="mt-3 text-center text-[clamp(0.95rem,4vw,1.15rem)] font-bold opacity-95">Learn something extraordinary about the ordinary.</p>
        <p className="glass mt-2 rounded-full px-3 py-1 text-center text-[clamp(0.72rem,3.2vw,0.85rem)] font-bold">Swap your next scroll for a snap.</p>
      </div>

      {/* Nimbus + compliment: the speech bubble comes out of Nimbus */}
      <div data-in className="flex flex-1 items-center justify-center" style={{ minHeight: 0 }}>
        <div className="flex w-full max-w-md items-start gap-3">
          <div className="flex shrink-0 flex-col items-center pt-1" style={{ width: "clamp(112px, 33vw, 150px)" }}>
            <Nimbus size={140} className="bob max-w-full" />
            <span className="mt-0.5 text-xs font-extrabold opacity-90">Nimbus</span>
          </div>
          <div className="bubble bubble-left min-w-0 flex-1 px-4 py-3.5" style={{ minHeight: "4.4rem" }}>
            {compliment ? (
              <p ref={textRef} className="text-[clamp(0.98rem,4.1vw,1.15rem)] font-bold leading-snug">
                {compliment.split(" ").map((w, i) => (
                  <span key={i} className="inline-block">
                    {w}&nbsp;
                  </span>
                ))}
              </p>
            ) : (
              <div className="typing flex h-8 items-center">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* main buttons */}
      <div className="mx-auto flex w-full max-w-md flex-col" style={{ gap: "clamp(10px, 1.8dvh, 18px)" }}>
        <div data-in>
          <Btn variant="sun" className="text-[clamp(1.35rem,6vw,1.75rem)]" style={{ height: "clamp(66px, 10.2dvh, 92px)" }} onClick={() => go("facts")}>
            <Camera size={28} strokeWidth={2.8} /> Facts
          </Btn>
        </div>
        <div data-in>
          <Btn className="text-[clamp(1.35rem,6vw,1.75rem)]" style={{ height: "clamp(66px, 10.2dvh, 92px)" }} onClick={() => go("hunt")}>
            <Search size={28} strokeWidth={2.8} /> Hunt Mode
          </Btn>
        </div>
        <div data-in>
          <Btn variant="violet" className="text-[clamp(1.2rem,5.2vw,1.5rem)]" style={{ height: "clamp(58px, 8.4dvh, 76px)" }} onClick={() => go("board")}>
            <Pushpin size={22} /> Bulletin Board
          </Btn>
        </div>
      </div>

      <div data-in className="mt-3 text-center text-[0.72rem] font-bold opacity-80">Built with Claude Code · AI by Gemini</div>
    </div>
  );
}
