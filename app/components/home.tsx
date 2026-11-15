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
  "Your curiosity is basically a superpower. Let's go find something amazing!",
  "You ask great questions. The world is lucky to have you poking around in it.",
  "Your brain is extra sparkly today. Let's feed it a fact or two!",
  "You notice things other people miss. That's a real gift.",
  "You make learning look fun. Ready for a mini adventure?",
  "Kindness and curiosity? You've got both. Let's explore!",
  "You have the eyes of an explorer. What will you discover today?",
  "Every great inventor started just like you: wondering about stuff.",
];

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
        <p className="mt-3 text-center text-[clamp(0.95rem,4vw,1.15rem)] font-bold opacity-95">Learn something real instead of scrolling.</p>
      </div>

      {/* Nimbus + compliment */}
      <div data-in className="flex flex-1 flex-col justify-center" style={{ minHeight: 0 }}>
        <div className="bubble mx-auto w-full max-w-md px-5 py-4" style={{ minHeight: "4.6rem" }}>
          {compliment ? (
            <p ref={textRef} className="text-[clamp(1rem,4.2vw,1.2rem)] font-bold leading-snug">
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
        <div className="mt-3 flex items-center gap-2 pl-3">
          <Nimbus size={74} className="bob" />
          <span className="text-sm font-extrabold opacity-90">Nimbus</span>
        </div>
      </div>

      {/* main buttons */}
      <div className="mx-auto flex w-full max-w-md flex-col" style={{ gap: "clamp(10px, 1.8dvh, 18px)" }}>
        <div data-in>
          <Btn variant="sun" className="text-[clamp(1.25rem,5.5vw,1.6rem)]" style={{ height: "clamp(60px, 9.5dvh, 84px)" }} onClick={() => go("facts")}>
            <Camera size={28} strokeWidth={2.8} /> Facts
          </Btn>
        </div>
        <div data-in>
          <Btn className="text-[clamp(1.25rem,5.5vw,1.6rem)]" style={{ height: "clamp(60px, 9.5dvh, 84px)" }} onClick={() => go("hunt")}>
            <Search size={28} strokeWidth={2.8} /> Hunt Mode
          </Btn>
        </div>
        <div data-in>
          <Btn variant="violet" className="text-[clamp(1.1rem,4.8vw,1.35rem)]" style={{ height: "clamp(52px, 7.5dvh, 68px)" }} onClick={() => go("board")}>
            <Pushpin size={22} /> Bulletin Board
          </Btn>
        </div>
      </div>

      <div data-in className="mt-3 text-center text-[0.72rem] font-bold opacity-80">Built with Claude Code · AI by Gemini</div>
    </div>
  );
}
