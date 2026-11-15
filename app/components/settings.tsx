"use client";
import { ReactNode, useState } from "react";
import { sfx } from "@/lib/client/audio";
import { resetProgress, setSetting, Settings, update, useStore } from "@/lib/client/store";
import { Btn, Sheet, toast } from "./ui";

function Row({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="font-extrabold">{label}</div>
        {sub && <div className="text-xs text-[var(--ink-soft)]">{sub}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle ${on ? "on" : ""}`}
      onClick={() => {
        onChange(!on);
        sfx("tap", on ? 0.8 : 1.2);
      }}
    />
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => (
        <button
          key={v}
          className={value === v ? "on" : ""}
          onClick={() => {
            onChange(v);
            sfx("tap");
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore((st) => st.settings);
  const [confirmReset, setConfirmReset] = useState(false);
  const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => setSetting(k, v);

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="px-5 pb-6 pt-2">
        <h2 className="font-display mb-1 text-center text-3xl">Settings</h2>

        <div className="divide-y-2 divide-slate-200 dark:divide-white/10">
          <Row label="Theme">
            <Seg value={s.theme} options={[["light", "Light"], ["dark", "Dark"], ["system", "Auto"]]} onChange={set("theme")} />
          </Row>
          <Row label="Music volume">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.music}
              onChange={(e) => setSetting("music", Number(e.target.value))}
              className="w-36 accent-[var(--pink)]"
              aria-label="Music volume"
            />
          </Row>
          <Row label="Sound effects">
            <Toggle on={s.sfx} onChange={set("sfx")} label="Sound effects" />
          </Row>
          <Row label="Vibration" sub="Android phones only">
            <Toggle on={s.haptics} onChange={set("haptics")} label="Vibration" />
          </Row>
          <Row label="Reduce motion" sub="Simpler transitions">
            <Toggle on={s.reduceMotion} onChange={set("reduceMotion")} label="Reduce motion" />
          </Row>
          <Row label="Text size">
            <Seg value={s.textSize} options={[["s", "S"], ["m", "M"], ["l", "L"]]} onChange={set("textSize")} />
          </Row>
          <Row label="Fact style">
            <Seg value={s.factStyle} options={[["kid", "Kid"], ["normal", "Normal"], ["nerdy", "Nerdy"]]} onChange={set("factStyle")} />
          </Row>
          <Row label="Hunt start" sub="Normal starts harder">
            <Seg value={s.huntStart} options={[["easy", "Easy"], ["normal", "Normal"]]} onChange={set("huntStart")} />
          </Row>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <Btn
            variant="white"
            className="h-12"
            onClick={() => {
              update((st) => ({ ...st, tutorialDone: false, boardHintDone: false }));
              toast("The tutorial will play next time you open Facts");
            }}
          >
            Replay tutorial
          </Btn>
          {!confirmReset ? (
            <Btn variant="white" className="h-12" onClick={() => setConfirmReset(true)}>
              Reset progress
            </Btn>
          ) : (
            <Btn
              className="h-12"
              onClick={() => {
                resetProgress();
                setConfirmReset(false);
                toast("Progress reset. Fresh start!");
              }}
            >
              Tap again to erase notes, XP and high score
            </Btn>
          )}
        </div>

        <div className="mt-6 rounded-2xl bg-slate-100 p-4 text-xs leading-relaxed text-[var(--ink-soft)] dark:bg-white/5">
          <div className="mb-1 font-extrabold text-[var(--card-ink)]">Credits</div>
          Built with Claude Code · AI by Gemini (facts can be wrong).
          <br />
          Music via Storyblocks (Joyful Ride, Upbeat Cheerful Optimistic Jazz, Comedy Background Detective, Jolly Stomping Rhythm).
          <br />
          Fonts: Shrikhand, Sour Gummy and Caveat (SIL Open Font License).
          <br />
          Photos are sent to the AI only to analyze them. Your board stays on this phone.
        </div>
      </div>
    </Sheet>
  );
}
