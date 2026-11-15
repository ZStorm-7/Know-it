"use client";
import { useState } from "react";
import type { Box } from "@/lib/client/store";

export type Outline = { box: Box; label?: string; color?: string; selectable?: boolean };

/**
 * Photo with animated outlines drawn around detected objects (boxes are 0-1000).
 * The frame always matches the photo's aspect ratio so outlines line up exactly.
 */
export function PhotoBox({
  src,
  outlines = [],
  onSelect,
  maxHeight = "46dvh",
  className = "",
  rounded = 24,
}: {
  src: string;
  outlines?: Outline[];
  onSelect?: (i: number) => void;
  maxHeight?: string;
  className?: string;
  rounded?: number;
}) {
  const [ratio, setRatio] = useState(3 / 4);
  return (
    <div
      className={`relative mx-auto overflow-hidden border-[3px] border-[var(--ink)] bg-slate-800 ${className}`}
      style={{ borderRadius: rounded, aspectRatio: String(ratio), width: `min(100%, calc(${maxHeight} * ${ratio}))` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Your photo"
        className="block h-full w-full object-cover"
        draggable={false}
        onLoad={(e) => {
          const im = e.currentTarget;
          if (im.naturalWidth && im.naturalHeight) setRatio(im.naturalWidth / im.naturalHeight);
        }}
      />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        {outlines.map((o, i) => {
          const [y0, x0, y1, x1] = o.box;
          const pad = 10;
          const r = {
            x: Math.max(2, x0 - pad),
            y: Math.max(2, y0 - pad),
            width: Math.min(996, x1 + pad) - Math.max(2, x0 - pad),
            height: Math.min(996, y1 + pad) - Math.max(2, y0 - pad),
          };
          const delay = `${i * 0.15}s`;
          return (
            <g key={i}>
              <rect {...r} rx={24} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={9} vectorEffect="non-scaling-stroke" pathLength={1} className="outline-draw" style={{ animationDelay: delay }} />
              <rect
                {...r}
                rx={24}
                fill="none"
                stroke={o.color ?? "#ffd23f"}
                strokeWidth={5}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pathLength={1}
                className="outline-live"
                style={{ animationDelay: `${delay}, ${0.9 + i * 0.15}s` }}
              />
            </g>
          );
        })}
      </svg>
      {outlines.map((o, i) => {
        const [y0, x0, y1, x1] = o.box;
        return (
          <div key={i}>
            {o.selectable && (
              <button
                aria-label={`Choose ${o.label ?? "object"}`}
                className="absolute rounded-2xl active:bg-white/20"
                style={{ left: `${x0 / 10}%`, top: `${y0 / 10}%`, width: `${(x1 - x0) / 10}%`, height: `${(y1 - y0) / 10}%` }}
                onClick={() => onSelect?.(i)}
              />
            )}
            {o.label && (
              <div
                className="pointer-events-none absolute rounded-full border-2 border-[var(--ink)] px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-[var(--ink)] shadow"
                style={{
                  left: `${Math.min(x0 / 10, 62)}%`,
                  top: y0 > 90 ? `calc(${y0 / 10}% - 28px)` : `calc(${y1 / 10}% + 4px)`,
                  background: o.color ?? "#ffd23f",
                }}
              >
                {o.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
