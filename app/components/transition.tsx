"use client";
import gsap from "gsap";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { sfx } from "@/lib/client/audio";

export type TransitionHandle = { run: (onCovered: () => void, reduce: boolean) => Promise<void> };

const EDGE = 110; // px of puffy edge above and below the solid part

function Curtain({ color, size, className }: { color: string; size: number; className: string }) {
  const puff = `radial-gradient(circle at 50% 100%, ${color} 62%, transparent 63%)`;
  const puffDown = `radial-gradient(circle at 50% 0%, ${color} 62%, transparent 63%)`;
  return (
    <div className={`absolute left-0 right-0 ${className}`} style={{ top: 0, height: `calc(100% + ${EDGE * 2}px)` }}>
      <div style={{ height: EDGE, background: puff, backgroundSize: `${size}px ${EDGE}px`, backgroundRepeat: "repeat-x", backgroundPosition: "bottom" }} />
      <div style={{ height: `calc(100% - ${EDGE * 2}px)`, background: color }} />
      <div style={{ height: EDGE, background: puffDown, backgroundSize: `${size * 1.2}px ${EDGE}px`, backgroundRepeat: "repeat-x", backgroundPosition: "top" }} />
    </div>
  );
}

export const CloudTransition = forwardRef<TransitionHandle>(function CloudTransition(_, ref) {
  const root = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    run(onCovered, reduce) {
      const el = root.current!;
      const layers = el.querySelectorAll<HTMLElement>("[data-layer]");
      return new Promise<void>((resolve) => {
        if (reduce) {
          gsap.timeline({ onComplete: resolve })
            .set(el, { display: "block" })
            .set(layers, { yPercent: 0, y: -EDGE })
            .fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2 })
            .call(onCovered)
            .to(el, { opacity: 0, duration: 0.25, delay: 0.1 })
            .set(el, { display: "none", opacity: 1 });
          return;
        }
        sfx("whoosh");
        const h = window.innerHeight;
        gsap.timeline({ onComplete: resolve })
          .set(el, { display: "block", opacity: 1 })
          .set(layers, { y: h + EDGE })
          .to(layers, { y: -EDGE, duration: 0.6, ease: "power2.in", stagger: 0.07 })
          .call(onCovered)
          .to({}, { duration: 0.15 })
          .call(() => sfx("whoosh"))
          .to(layers, { y: -(h + EDGE * 3), duration: 0.75, ease: "power2.out", stagger: { each: 0.07, from: "end" } })
          .set(el, { display: "none" });
      });
    },
  }));

  return (
    <div ref={root} className="pointer-events-auto fixed inset-0 z-[100] hidden overflow-hidden" aria-hidden>
      <div data-layer className="absolute inset-0"><Curtain color="#bae6fd" size={140} className="" /></div>
      <div data-layer className="absolute inset-0"><Curtain color="#e0f2fe" size={180} className="" /></div>
      <div data-layer className="absolute inset-0"><Curtain color="#ffffff" size={230} className="" /></div>
    </div>
  );
});
