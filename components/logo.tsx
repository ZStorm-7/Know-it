"use client";
import gsap from "gsap";
import { useEffect, useRef } from "react";

export function Logo({ size = "clamp(4.2rem, 22vw, 7rem)", animate = true }: { size?: string; animate?: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!animate || !ref.current) return;
    const letters = ref.current.querySelectorAll("span[data-l]");
    gsap.fromTo(
      letters,
      { y: -60, scale: 0.3, opacity: 0, rotation: () => gsap.utils.random(-30, 30) },
      { y: 0, scale: 1, opacity: 1, rotation: 0, duration: 0.9, ease: "elastic.out(1, 0.45)", stagger: 0.07 },
    );
  }, [animate]);
  const word = "Curio";
  return (
    <h1
      ref={ref}
      className="font-display select-none text-center leading-none tracking-wide text-white"
      style={{
        fontSize: size,
        textShadow: "0 3px 0 #ff6fae, 0 6px 0 #8b5cf6, 0 12px 18px rgba(30,27,75,0.35)",
        WebkitTextStroke: "2px #1e293b",
        paintOrder: "stroke fill",
      }}
      aria-label={word}
    >
      {word.split("").map((ch, i) =>
        ch === " " ? (
          <span key={i} className="inline-block w-[0.28em]" />
        ) : (
          <span key={i} data-l className="logo-letter inline-block" style={{ animationDelay: `${i * 0.12}s` }}>
            {ch}
          </span>
        ),
      )}
    </h1>
  );
}
