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
  const ink = "#1e293b";
  return (
    <svg width={size} height={(size * 80) / 120} viewBox="0 0 120 80" className={`nimbus ${className}`} aria-hidden shapeRendering="geometricPrecision">
      <defs>
        <linearGradient id={`nb${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#f3f9ff" />
          <stop offset="1" stopColor="#c9e1fb" />
        </linearGradient>
        <radialGradient id={`ch${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fb7185" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fb7185" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`cp${id}`}>
          <path d={CLOUD_PATH} />
        </clipPath>
      </defs>

      {/* soft ground shadow */}
      <ellipse cx="60" cy="76.5" rx="34" ry="2.8" fill="rgba(30,41,99,0.2)" />

      {/* body */}
      <path d={CLOUD_PATH} fill={`url(#nb${id})`} stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />
      <g clipPath={`url(#cp${id})`}>
        {/* gentle shading along the bottom and the right side */}
        <path d="M0 62 Q60 88 120 58 V90 H0 Z" fill="rgba(110,160,230,0.28)" />
        <path d="M100 20 Q124 36 112 66 L120 80 V10 Z" fill="rgba(110,160,230,0.12)" />
      </g>
      {/* glossy highlights on the puffs */}
      <path d="M17 47 C19 42.5 23 40.2 27.5 40.8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.95" />
      <path d="M40 24 C43.5 19.5 49 18 54 19.6" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.95" />
      <path d="M72 17 C76 14 81 13.8 85 15.6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity="0.85" />

      {/* eyebrows */}
      <g fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round">
        {mood === "wow" && (
          <>
            <path d="M44.5 36 Q50 32.5 55.5 36" />
            <path d="M64.5 36 Q70 32.5 75.5 36" />
          </>
        )}
        {mood === "think" && (
          <>
            <path d="M44.5 38.5 Q50 36.5 55.5 38" />
            <path d="M64.5 35 Q70 31.5 75.5 34.5" />
          </>
        )}
        {mood === "sad" && (
          <>
            <path d="M44.5 38.5 L55 35.5" />
            <path d="M65 35.5 L75.5 38.5" />
          </>
        )}
      </g>

      {/* eyes with two highlights */}
      <g className="nimbus-eyes">
        <ellipse cx="50" cy="45" rx="4" ry="5.4" fill="#0f172a" />
        <ellipse cx="70" cy="45" rx="4" ry="5.4" fill="#0f172a" />
        <circle cx="51.5" cy="42.6" r="1.7" fill="#fff" />
        <circle cx="71.5" cy="42.6" r="1.7" fill="#fff" />
        <circle cx="48.8" cy="47.6" r="0.8" fill="#fff" opacity="0.9" />
        <circle cx="68.8" cy="47.6" r="0.8" fill="#fff" opacity="0.9" />
      </g>

      {/* rosy cheeks */}
      <ellipse cx="40" cy="54" rx="6.5" ry="4" fill={`url(#ch${id})`} />
      <ellipse cx="80" cy="54" rx="6.5" ry="4" fill={`url(#ch${id})`} />

      {/* mouth */}
      {mood === "happy" && (
        <>
          <path d="M52.5 54.2 Q60 65 67.5 54.2 Z" fill="#1e293b" stroke={ink} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M56 59.6 Q60 63.4 64 59.6 Q60 57.4 56 59.6 Z" fill="#fb7185" />
        </>
      )}
      {mood === "wow" && (
        <>
          <ellipse cx="60" cy="58.5" rx="4.2" ry="5.4" fill="#1e293b" stroke={ink} strokeWidth="1.6" />
          <ellipse cx="60" cy="61.2" rx="2.6" ry="2" fill="#fb7185" />
        </>
      )}
      {mood === "sad" && <path d="M52.5 61 Q60 53.5 67.5 61" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />}
      {mood === "think" && <path d="M54 58.5 Q58.5 56.5 66.5 58" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />}
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

/** Max characters on a sticky note title. */
export const NOTE_MAX_CHARS = 24;

/** Font size (px) for a sticky-note title on a 170px note; shrinks as the title gets longer. */
export function noteFontSize(len: number): number {
  if (len <= 8) return 44;
  if (len <= 12) return 38;
  if (len <= 16) return 33;
  if (len <= 20) return 29;
  return 26;
}

/** Trim a title to the limit without cutting a word in half when possible. */
export function clampTitle(t: string): string {
  const clean = t.replace(/\s+/g, " ").trim();
  if (clean.length <= NOTE_MAX_CHARS) return clean;
  const cut = clean.slice(0, NOTE_MAX_CHARS);
  const sp = cut.lastIndexOf(" ");
  return (sp > 8 ? cut.slice(0, sp) : cut).trim();
}

/** Sticky-note color index (into NOTE_COLORS) for each object category. */
const CATEGORY_COLOR: Record<string, number> = { kitchen: 4, clothing: 1, nature: 2, tech: 3, toys: 0, stationery: 0, furniture: 4 };
export function categoryColor(category?: string): number {
  return category && category in CATEGORY_COLOR ? CATEGORY_COLOR[category] : Math.floor(Math.random() * NOTE_COLORS.length);
}

/** Gold crown for 1st, silver medal for 2nd, bronze medal for 3rd, a numbered circle after that. */
export function RankBadge({ rank, size = 36 }: { rank: number; size?: number }) {
  if (rank === 1) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-label="First place" role="img">
        <path d="M6 36 L4 14 L15 24 L24 8 L33 24 L44 14 L42 36 Z" fill="#fbbf24" stroke="#92400e" strokeWidth="2.6" strokeLinejoin="round" />
        <rect x="6" y="36" width="36" height="7" rx="2.5" fill="#f59e0b" stroke="#92400e" strokeWidth="2.6" />
        <circle cx="24" cy="21" r="3.2" fill="#ef4444" stroke="#92400e" strokeWidth="1.6" />
        <path d="M12 30 L15 24 M36 30 L33 24" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      </svg>
    );
  }
  if (rank === 2 || rank === 3) {
    const silver = rank === 2;
    const main = silver ? "#cbd5e1" : "#d97706";
    const dark = silver ? "#475569" : "#78350f";
    const ribbon = silver ? "#60a5fa" : "#f87171";
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-label={silver ? "Second place" : "Third place"} role="img">
        <path d="M13 3 L21 20 L27 17 L19 3 Z" fill={ribbon} stroke={dark} strokeWidth="2" strokeLinejoin="round" />
        <path d="M35 3 L27 20 L21 17 L29 3 Z" fill={ribbon} stroke={dark} strokeWidth="2" strokeLinejoin="round" opacity="0.9" />
        <circle cx="24" cy="30" r="14" fill={main} stroke={dark} strokeWidth="2.6" />
        <circle cx="24" cy="30" r="9" fill="none" stroke={dark} strokeWidth="1.8" opacity="0.55" />
        <text x="24" y="35.5" textAnchor="middle" fontSize="15" fontWeight="800" fill={dark} fontFamily="var(--font-shrikhand), cursive">
          {rank}
        </text>
      </svg>
    );
  }
  return (
    <span
      className="font-display grid shrink-0 place-items-center rounded-full border-[2.5px] border-[var(--ink)] bg-white text-[var(--ink)]"
      style={{ width: size - 4, height: size - 4, fontSize: size * 0.42 }}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}
