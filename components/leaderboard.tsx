"use client";
import { useCallback, useEffect, useState } from "react";
import { api, BoardData } from "@/lib/client/api";
import { useStore } from "@/lib/client/store";
import { RankBadge } from "./art";
import { Sheet } from "./ui";

const ROW_TINT: Record<number, string> = {
  1: "linear-gradient(90deg, #fde68a, #fef3c7)",
  2: "linear-gradient(90deg, #e2e8f0, #f8fafc)",
  3: "linear-gradient(90deg, #fed7aa, #ffedd5)",
};

/** Ranked list of the best Hunt scores. Pass refreshKey to reload (for example after submitting a score). */
export function Leaderboard({ limit = 10, refreshKey = 0 }: { limit?: number; refreshKey?: number }) {
  const me = useStore((s) => s.profile?.name);
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  const load = useCallback(() => {
    setError(null);
    api
      .leaderboard(me, limit)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "The leaderboard is unavailable right now."));
  }, [me, limit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, refreshKey, tries]);

  if (error)
    return (
      <div className="card w-full max-w-sm p-4 text-center">
        <p className="font-bold">{error}</p>
        <button className="mt-2 rounded-xl bg-[var(--sun)] px-4 py-2 font-extrabold text-[var(--ink)]" onClick={() => setTries((t) => t + 1)}>
          Try again
        </button>
      </div>
    );
  if (!data)
    return (
      <div className="card w-full max-w-sm p-4" aria-busy>
        {[0, 1, 2].map((i) => (
          <div key={i} className="my-2 h-9 animate-pulse rounded-xl bg-slate-200/80" />
        ))}
      </div>
    );
  if (!data.entries.length)
    return <div className="card w-full max-w-sm p-4 text-center font-bold">No scores yet. Be the first to climb the board!</div>;

  const inList = me ? data.entries.some((e) => e.name.toLowerCase() === me.toLowerCase()) : false;
  return (
    <div className="w-full max-w-sm">
      <ol className="card overflow-hidden">
        {data.entries.slice(0, limit).map((e) => {
          const mine = !!me && e.name.toLowerCase() === me.toLowerCase();
          return (
            <li
              key={`${e.rank}-${e.name}`}
              className={`flex items-center gap-3 border-b-2 border-slate-200 px-3 py-2 last:border-b-0 dark:border-white/10 ${mine ? "outline-3 -outline-offset-3 outline-[var(--violet)]" : ""}`}
              style={e.rank <= 3 ? { background: ROW_TINT[e.rank], color: "#1e293b" } : undefined}
            >
              <span className="grid w-10 shrink-0 place-items-center">
                <RankBadge rank={e.rank} size={e.rank === 1 ? 42 : 38} />
              </span>
              <span className="min-w-0 flex-1 truncate font-extrabold">
                {e.name}
                {mine && <span className="ml-2 rounded-full bg-[var(--violet)] px-2 py-0.5 text-[0.65rem] font-extrabold text-white">YOU</span>}
              </span>
              <span className="font-display text-xl">{e.score}</span>
            </li>
          );
        })}
      </ol>
      {me && data.me && !inList && (
        <div className="card mt-2 flex items-center gap-3 px-3 py-2">
          <span className="grid w-10 shrink-0 place-items-center">
            <RankBadge rank={data.me.rank} />
          </span>
          <span className="min-w-0 flex-1 truncate font-extrabold">{me} (you)</span>
          <span className="font-display text-xl">{data.me.score}</span>
        </div>
      )}
      {data.mode === "memory" && (
        <p className="mt-2 text-center text-[0.7rem] font-bold opacity-80">Test mode: scores are not saved permanently yet.</p>
      )}
    </div>
  );
}

export function LeaderboardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="flex flex-col items-center px-5 pb-6 pt-2">
        <h2 className="font-display text-center text-3xl">Leaderboard</h2>
        <p className="mb-3 mt-1 text-center text-sm font-bold text-[var(--ink-soft)]">Best Hunt scores. Find more to climb!</p>
        {open && <Leaderboard limit={20} />}
      </div>
    </Sheet>
  );
}
