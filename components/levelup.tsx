"use client";
import gsap from "gsap";
import { useEffect, useRef } from "react";
import { haptic, sfx } from "@/lib/client/audio";
import { Nimbus, Sparkle } from "./art";
import { confetti } from "./ui";

/** Full-screen "level up" celebration. It shows over every screen, then fades away on its own. */
export function LevelUpOverlay({ level, name, onDone }: { level: number; name: string; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current!;
    sfx("levelup");
    haptic([30, 50, 30, 50, 80]);
    const tl = gsap.timeline({ onComplete: onDone });
    tl.fromTo(el.querySelector("[data-bg]"), { opacity: 0 }, { opacity: 1, duration: 0.3 })
      .fromTo(el.querySelector("[data-rays]"), { scale: 0.2, opacity: 0, rotation: -40 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.9, ease: "back.out(1.4)" }, 0.05)
      .fromTo(el.querySelector("[data-nimbus]"), { y: 120, scale: 0.4, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.7, ease: "elastic.out(1, 0.55)" }, 0.15)
      .fromTo(el.querySelector("[data-badge]"), { scale: 0, rotation: -25 }, { scale: 1, rotation: 0, duration: 0.8, ease: "elastic.out(1, 0.5)" }, 0.3)
      .fromTo(el.querySelectorAll("[data-text]"), { y: 40, opacity: 0, scale: 0.8 }, { y: 0, opacity: 1, scale: 1, duration: 0.55, stagger: 0.12, ease: "back.out(2)" }, 0.5)
      .call(() => confetti(0.42, 90), [], 0.4)
      .call(() => confetti(0.5, 60), [], 1.1);
    gsap.to(el.querySelector("[data-rays]"), { rotation: "+=360", duration: 14, ease: "none", repeat: -1 });
    gsap.fromTo(
      el.querySelectorAll("[data-spark]"),
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.5, stagger: { each: 0.08, from: "random" }, ease: "back.out(3)", delay: 0.5, repeat: -1, yoyo: true, repeatDelay: 0.2 },
    );
    tl.to({}, { duration: 2.2 }).to(el, { opacity: 0, scale: 1.04, duration: 0.45, ease: "power2.in" });
    return () => {
      tl.kill();
      gsap.killTweensOf(el.querySelectorAll("*"));
    };
    // run once per level-up
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sparks = [
    { l: "12%", t: "22%", s: 26 }, { l: "82%", t: "18%", s: 30 }, { l: "20%", t: "70%", s: 22 },
    { l: "78%", t: "66%", s: 28 }, { l: "50%", t: "9%", s: 22 }, { l: "8%", t: "46%", s: 18 }, { l: "90%", t: "44%", s: 20 },
  ];

  return (
    <div ref={root} role="status" aria-live="polite" className="fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-hidden" onClick={onDone}>
      <div data-bg className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 42%, rgba(255,214,102,0.95) 0%, rgba(255,111,174,0.9) 38%, rgba(109,40,217,0.92) 100%)" }} />
      <svg data-rays className="absolute h-[150vmax] w-[150vmax]" viewBox="-100 -100 200 200" aria-hidden>
        {Array.from({ length: 16 }, (_, i) => (
          <path key={i} d="M0 0 L-9 -100 L9 -100 Z" fill="rgba(255,255,255,0.16)" transform={`rotate(${i * 22.5})`} />
        ))}
      </svg>
      {sparks.map((p, i) => (
        <span key={i} data-spark className="absolute" style={{ left: p.l, top: p.t }}>
          <Sparkle size={p.s} color={i % 2 ? "#ffffff" : "#fde68a"} />
        </span>
      ))}
      <div data-nimbus className="levelup-nimbus relative">
        <Nimbus size={170} mood="wow" />
      </div>
      <div data-badge className="levelup-badge relative -mt-3 grid h-28 w-28 place-items-center rounded-full border-[5px] border-[var(--ink)] bg-[var(--sun)] shadow-2xl">
        <div className="text-center leading-none text-[var(--ink)]">
          <div className="text-xs font-extrabold tracking-widest">LEVEL</div>
          <div className="font-display text-5xl">{level}</div>
        </div>
      </div>
      <h2 data-text className="font-display mt-4 text-center text-[clamp(2.6rem,13vw,4.2rem)] leading-none text-white" style={{ textShadow: "0 4px 0 #6d28d9, 0 8px 16px rgba(0,0,0,0.3)", WebkitTextStroke: "2px #1e293b", paintOrder: "stroke fill" }}>
        Level Up!
      </h2>
      <p data-text className="mt-2 px-6 text-center text-xl font-extrabold text-white" style={{ textShadow: "0 2px 6px rgba(0,0,0,0.4)" }}>
        You are now a {name}
      </p>
      <p data-text className="mt-3 text-sm font-bold text-white/85">
        Tap to continue
      </p>
    </div>
  );
}
