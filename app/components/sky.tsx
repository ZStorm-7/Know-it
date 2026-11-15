"use client";
import { useMemo } from "react";
import { CLOUD_PATH } from "./art";

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
  const drifts = [
    { top: "8%", w: 150, dur: 46, delay: -10, op: 0.9 },
    { top: "22%", w: 90, dur: 34, delay: -26, op: 0.6 },
    { top: "58%", w: 200, dur: 60, delay: -40, op: 0.5 },
    { top: "78%", w: 120, dur: 40, delay: -5, op: 0.7 },
  ];
  return (
    <div className="sky" aria-hidden>
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
