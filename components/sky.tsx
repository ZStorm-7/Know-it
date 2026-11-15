"use client";
import { useMemo } from "react";
import { CLOUD_PATH } from "./art";

/** One wavy line. A full wave is 120 units wide, so sliding the line by 120 loops with no seam. */
function wave(y: number, amp: number) {
  const seg = 60;
  let d = `M -240 ${y} Q ${-240 + seg / 2} ${y - amp} ${-240 + seg} ${y}`;
  for (let x = -240 + seg * 2; x <= 780; x += seg) d += ` T ${x} ${y}`;
  return d;
}

export function Sky({ clouds = true }: { clouds?: boolean }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        top: `${(i * 53) % 70}%`,
        delay: `${(i % 7) * 0.4}s`,
        size: i % 5 === 0 ? 4 : 2,
      })),
    [],
  );

  // squiggly lines that slowly slide and bob (replaces the old concentric circles)
  const lines = useMemo(
    () =>
      Array.from({ length: 15 }, (_, i) => ({
        y: 30 + i * 56,
        amp: 14 + ((i * 7) % 5) * 6,
        width: i % 4 === 0 ? 3.5 : 2.2,
        slide: 16 + ((i * 5) % 7) * 3,
        bob: 5 + ((i * 3) % 4) * 1.5,
        reverse: i % 2 === 1,
        delay: -(i * 1.7),
      })),
    [],
  );

  const drifts = [
    { top: "3%", w: 170, dur: 70, delay: -12, op: 0.95 },
    { top: "11%", w: 100, dur: 48, delay: -30, op: 0.8 },
    { top: "22%", w: 230, dur: 92, delay: -50, op: 0.85 },
    { top: "33%", w: 120, dur: 56, delay: -8, op: 0.75 },
    { top: "46%", w: 190, dur: 80, delay: -64, op: 0.7 },
    { top: "57%", w: 90, dur: 44, delay: -20, op: 0.8 },
    { top: "66%", w: 250, dur: 100, delay: -35, op: 0.8 },
    { top: "77%", w: 140, dur: 62, delay: -5, op: 0.85 },
    { top: "88%", w: 200, dur: 86, delay: -58, op: 0.9 },
  ];

  return (
    <div className="sky" aria-hidden>
      <svg className="squiggles" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
        {lines.map((l, i) => (
          <g key={i} className="sq-bob" style={{ animationDuration: `${l.bob}s`, animationDelay: `${l.delay}s` }}>
            <g className="sq-slide" style={{ animationDuration: `${l.slide}s`, animationDirection: l.reverse ? "reverse" : "normal", animationDelay: `${l.delay}s` }}>
              <path d={wave(l.y, l.amp)} fill="none" stroke="currentColor" strokeWidth={l.width} strokeLinecap="round" />
            </g>
          </g>
        ))}
      </svg>
      <div className="sky-stars">
        {stars.map((s, i) => (
          <i key={i} style={{ left: s.left, top: s.top, animationDelay: s.delay, width: s.size, height: s.size }} />
        ))}
      </div>
      {clouds &&
        drifts.map((d, i) => (
          <svg
            key={i}
            className="drift"
            width={d.w}
            height={(d.w * 80) / 120}
            viewBox="0 0 120 80"
            style={{ top: d.top, animationDuration: `${d.dur}s`, animationDelay: `${d.delay}s`, opacity: d.op }}
          >
            <path d={CLOUD_PATH} />
          </svg>
        ))}
    </div>
  );
}
