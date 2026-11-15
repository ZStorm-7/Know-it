"use client";
import { Award, Lock } from "lucide-react";
import { levelInfo, liveStreak, useStore } from "@/lib/client/store";
import { Sheet } from "./ui";

type Badge = { id: string; name: string; goal: number; have: number; hint: string };

export function CollectionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notes = useStore((s) => s.notes);
  const best = useStore((s) => s.huntBest);
  const streak = useStore((s) => s.streak);
  const xp = useStore((s) => s.xp);

  const count = (c: string) => notes.filter((n) => n.category === c).length;
  const badges: Badge[] = [
    { id: "first", name: "First Pin", goal: 1, have: notes.length, hint: "Pin your first note" },
    { id: "ten", name: "Ten Pins", goal: 10, have: notes.length, hint: "Pin 10 notes" },
    { id: "kitchen", name: "Kitchen Explorer", goal: 3, have: count("kitchen"), hint: "3 kitchen objects" },
    { id: "stationery", name: "Desk Detective", goal: 3, have: count("stationery"), hint: "3 desk or school objects" },
    { id: "nature", name: "Nature Scout", goal: 3, have: count("nature"), hint: "3 things from nature" },
    { id: "tech", name: "Tech Tinkerer", goal: 3, have: count("tech"), hint: "3 gadgets" },
    { id: "toys", name: "Toy Collector", goal: 3, have: count("toys"), hint: "3 toys or games" },
    { id: "clothing", name: "Wardrobe Wizard", goal: 3, have: count("clothing"), hint: "3 clothing items" },
    { id: "furniture", name: "Furniture Finder", goal: 3, have: count("furniture"), hint: "3 pieces of furniture" },
    { id: "hunter", name: "Hunter", goal: 5, have: best, hint: "Find 5 in one Hunt" },
    { id: "streak3", name: "Streak Star", goal: 3, have: streak.best, hint: "A 3-day streak" },
    { id: "streak7", name: "Week Warrior", goal: 7, have: streak.best, hint: "A 7-day streak" },
  ];
  const earned = badges.filter((b) => b.have >= b.goal).length;
  const lvl = levelInfo(xp);

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="px-5 pb-6 pt-2">
        <h2 className="font-display text-center text-3xl">Collection</h2>
        <p className="mt-1 text-center text-sm font-bold text-[var(--ink-soft)]">
          {earned} of {badges.length} badges · Level {lvl.level} {lvl.name} · {liveStreak(streak)}-day streak
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-3">
          {badges.map((b) => {
            const done = b.have >= b.goal;
            return (
              <li key={b.id} className={`rounded-2xl border-[2.5px] border-[var(--ink)] p-3 ${done ? "bg-[var(--sun)] text-[var(--ink)]" : "opacity-75"}`}>
                <div className="flex items-center gap-2">
                  {done ? <Award size={26} strokeWidth={2.6} /> : <Lock size={22} strokeWidth={2.6} />}
                  <span className="text-[0.95rem] leading-tight font-extrabold">{b.name}</span>
                </div>
                <div className="mt-1 text-xs font-bold opacity-80">{done ? "Earned!" : b.hint}</div>
                {!done && (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-300">
                    <div className="h-full rounded-full bg-[var(--violet)]" style={{ width: `${Math.min(100, (b.have / b.goal) * 100)}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
