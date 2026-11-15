"use client";
import gsap from "gsap";
import { Flame } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { sfx } from "@/lib/client/audio";
import { getPrevVisit, setPendingNote } from "@/lib/client/nav";
import { getState, liveStreak, update } from "@/lib/client/store";
import { useNav } from "./app";
import { Nimbus, RankBadge } from "./art";
import { Btn } from "./ui";

let shown = false; // once per app launch

function agoText(then: number) {
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 2) return "a moment ago";
  if (mins < 60) return `${mins} minutes ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

/** Shown when a returning player opens the app: what Nimbus remembers about them. */
export function WelcomeBack() {
  const { go } = useNav();
  const prev = getPrevVisit();
  const [open, setOpen] = useState(false);
  const [rank, setRank] = useState<{ now: number; before: number | null } | null>(null);
  const card = useRef<HTMLDivElement>(null);

  const st = getState();
  const returning = prev > 0 && (st.notes.length > 0 || st.xp > 0 || !!st.profile);

  useEffect(() => {
    if (!returning || shown) return;
    let alive = true;
    // mark as shown only once it really opens, so a repeated mount effect does not cancel it
    const t = setTimeout(() => {
      shown = true;
      setOpen(true);
      sfx("pop", 1.1);
    }, 1400);
    if (st.profile) {
      api
        .leaderboard(st.profile.name, 1)
        .then((d) => {
          if (alive && d.me) {
            setRank({ now: d.me.rank, before: st.lastRank });
            update((s) => ({ ...s, lastRank: d.me!.rank }));
          }
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open && card.current) gsap.fromTo(card.current, { y: 60, opacity: 0, scale: 0.88 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.8)" });
  }, [open]);

  if (!open) return null;

  const streak = liveStreak(st.streak);
  const today = new Date();
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const doneToday = st.streak.last === key;
  const streakLine =
    streak > 0 && doneToday
      ? `Your ${streak}-day streak is safe for today.`
      : streak > 0
        ? `Your ${streak}-day streak is waiting. Snap or find one thing today to keep it!`
        : st.streak.best > 0
          ? `Your streak ended at ${st.streak.best} days. Start a fresh one today!`
          : "Snap or find one thing today to start a streak.";
  const last = [...st.notes].sort((a, b) => b.createdAt - a.createdAt)[0];
  const moved = rank && rank.before !== null && rank.before !== rank.now ? rank.before - rank.now : 0;

  const close = () => {
    gsap.to(card.current, { y: 40, opacity: 0, scale: 0.9, duration: 0.25, onComplete: () => setOpen(false) });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/45 p-5" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }} onClick={close}>
      <div ref={card} className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <Nimbus size={96} mood="happy" className="bob shrink-0" />
          <div className="min-w-0">
            <div className="font-display text-xl leading-tight break-words">Welcome back{st.profile ? `, ${st.profile.name}` : ""}!</div>
            <div className="text-sm font-bold text-[var(--ink-soft)]">Last visit {agoText(prev)}</div>
          </div>
        </div>
        <ul className="mt-3 flex flex-col gap-2.5 text-[0.98rem] font-bold">
          <li className="flex items-start gap-2.5">
            <Flame size={22} strokeWidth={2.6} color="#fb923c" fill={streak ? "#fb923c" : "none"} className="mt-0.5 shrink-0" />
            <span>{streakLine}</span>
          </li>
          {last && (
            <li>
              Last time you met <span className="font-hand text-2xl font-bold">{last.title}</span> ({last.object}).
              {" "}You have {st.notes.length} {st.notes.length === 1 ? "note" : "notes"} on your board.
            </li>
          )}
          {rank && (
            <li className="flex items-center gap-2.5">
              <RankBadge rank={rank.now} size={34} />
              <span>
                You are #{rank.now} on the Hunt leaderboard
                {moved > 0 ? `, up ${moved} ${moved === 1 ? "place" : "places"} since last time!` : moved < 0 ? `. Someone passed you, time to win it back!` : "."}
              </span>
            </li>
          )}
        </ul>
        <div className="mt-4 flex gap-3">
          {last && (
            <Btn
              variant="white"
              className="h-14"
              onClick={() => {
                setPendingNote(last.id);
                setOpen(false);
                go("board");
              }}
            >
              Open last note
            </Btn>
          )}
          <Btn variant="mint" className="h-14" onClick={close}>
            Let&apos;s go
          </Btn>
        </div>
      </div>
    </div>
  );
}
