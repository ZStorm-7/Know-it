"use client";
import { useId } from "react";

// A soft, puffy cloud silhouette in a 120 x 80 box.
export const CLOUD_PATH =
  "M30 72 C14 72 6 60 10 49 C13 40 22 36 30 38 C31 24 44 14 58 17 C68 8 88 10 94 26 C108 26 117 38 114 51 C112 63 102 72 90 72 Z";

export function Nimbus({
  size = 96,
  mood = "happy",
  className = "",
}: {
  size?: number;
  mood?: "happy" | "think" | "wow" | "sad";
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const mouth =
    mood === "happy"
      ? "M52 55 Q60 63 68 55"
      : mood === "wow"
        ? "M56 56 a4 5 0 1 0 8 0 a4 5 0 1 0 -8 0"
        : mood === "sad"
          ? "M52 60 Q60 53 68 60"
          : "M53 57 L67 56";
  return (
    <svg
      width={size}
      height={(size * 80) / 120}
      viewBox="0 0 120 80"
      className={`nimbus ${className}`}
      aria-hidden
    >
      <defs>
        <linearGradient id={`ng${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dbeafe" />
        </linearGradient>
      </defs>
      <path d={CLOUD_PATH} transform="translate(0 4)" fill="rgba(30,41,99,0.18)" />
      <path d={CLOUD_PATH} fill={`url(#ng${id})`} stroke="#1e293b" strokeWidth="2.5" strokeLinejoin="round" />
      <g className="nimbus-eyes">
        <ellipse cx="50" cy="45" rx="3.6" ry="4.6" fill="#1e293b" />
        <ellipse cx="70" cy="45" rx="3.6" ry="4.6" fill="#1e293b" />
        <circle cx="51.2" cy="43.4" r="1.3" fill="#fff" />
        <circle cx="71.2" cy="43.4" r="1.3" fill="#fff" />
      </g>
      <ellipse cx="42" cy="53" rx="5" ry="3" fill="#fda4af" opacity="0.8" />
      <ellipse cx="78" cy="53" rx="5" ry="3" fill="#fda4af" opacity="0.8" />
      <path d={mouth} fill={mood === "wow" ? "#1e293b" : "none"} stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// Dribbble-inspired loader: a cloud outline that fills with a wavy liquid.
export function CloudLoader({ size = 140 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={(size * 80) / 120} viewBox="0 0 120 80" aria-hidden className="cloud-loader">
      <defs>
        <clipPath id={`cl${id}`}>
          <path d={CLOUD_PATH} />
        </clipPath>
      </defs>
      <g clipPath={`url(#cl${id})`}>
        <g className="cl-level">
          <g className="cl-bob">
          <path
            className="cl-wave cl-wave-back"
            d="M-120 40 Q-105 32 -90 40 T-60 40 T-30 40 T0 40 T30 40 T60 40 T90 40 T120 40 T150 40 T180 40 T210 40 T240 40 V120 H-120 Z"
            fill="rgba(255,255,255,0.55)"
          />
          <path
            className="cl-wave"
            d="M-120 42 Q-105 50 -90 42 T-60 42 T-30 42 T0 42 T30 42 T60 42 T90 42 T120 42 T150 42 T180 42 T210 42 T240 42 V120 H-120 Z"
            fill="#ffffff"
          />
          </g>
        </g>
      </g>
      <path d={CLOUD_PATH} fill="none" stroke="#fff" strokeWidth="3.5" strokeLinejoin="round" />
    </svg>
  );
}

export function Pushpin({ size = 34, className = "" }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 40 52" className={className} aria-hidden>
      <defs>
        <radialGradient id={`pp${id}`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#ff8a8a" />
          <stop offset="0.5" stopColor="#e11d48" />
          <stop offset="1" stopColor="#881337" />
        </radialGradient>
      </defs>
      <ellipse cx="22" cy="48" rx="8" ry="2.5" fill="rgba(0,0,0,0.25)" />
      <path d="M20 26 L21 47" stroke="#94a3b8" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="20" cy="27" rx="9" ry="3.5" fill="#9f1239" />
      <circle cx="20" cy="16" r="13" fill={`url(#pp${id})`} />
      <ellipse cx="15" cy="11" rx="4" ry="2.6" fill="#fff" opacity="0.7" />
    </svg>
  );
}

export function BrainIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        d="M24 9 C20 5 12 6 11 12 C5 13 4 21 8 24 C4 28 7 36 13 36 C14 42 22 43 24 39 C26 43 34 42 35 36 C41 36 44 28 40 24 C44 21 43 13 37 12 C36 6 28 5 24 9 Z"
        fill="#f9a8d4"
        stroke="#831843"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M24 10 V38 M15 17 Q19 19 18 23 M13 28 Q18 27 19 31 M33 17 Q29 19 30 23 M35 28 Q30 27 29 31"
        fill="none"
        stroke="#831843"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx="16" cy="14" rx="3" ry="1.8" fill="#fff" opacity="0.6" />
    </svg>
  );
}

export function LifeCloud({ filled, size = 30 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={(size * 80) / 120} viewBox="0 0 120 80" aria-hidden className={filled ? "" : "life-lost"}>
      <path
        d={CLOUD_PATH}
        fill={filled ? "#ffffff" : "rgba(255,255,255,0.15)"}
        stroke={filled ? "#1e293b" : "rgba(255,255,255,0.5)"}
        strokeWidth="5"
        strokeDasharray={filled ? undefined : "8 8"}
      />
    </svg>
  );
}

export function TrophyIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path d="M14 8 H34 V18 C34 26 29 30 24 30 C19 30 14 26 14 18 Z" fill="#fcd34d" stroke="#92400e" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M14 12 H8 C8 20 12 22 15 22 M34 12 H40 C40 20 36 22 33 22" fill="none" stroke="#92400e" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M21 30 H27 V36 H21 Z" fill="#fbbf24" stroke="#92400e" strokeWidth="2.4" />
      <rect x="15" y="36" width="18" height="6" rx="2" fill="#f59e0b" stroke="#92400e" strokeWidth="2.4" />
      <path d="M19 12 Q19 20 23 23" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function Sparkle({ size = 18, color = "#fde68a", className = "" }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 1 C13 8 16 11 23 12 C16 13 13 16 12 23 C11 16 8 13 1 12 C8 11 11 8 12 1 Z" fill={color} />
    </svg>
  );
}

export const NOTE_COLORS = ["#fde047", "#f9a8d4", "#86efac", "#7dd3fc", "#fdba74"];
