"use client";
import gsap from "gsap";
import { Crosshair, Home as HomeIcon, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, Detected } from "@/lib/client/api";
import { pickChallenge } from "@/lib/client/challenges";
import { CHECK_LINES, shuffle } from "@/lib/client/random";
import { shrinkDataUrl } from "@/lib/client/image";
import { haptic, sfx } from "@/lib/client/audio";
import { addXp, Box, getState, recordActivity, setProfile, setSetting, update, useStore } from "@/lib/client/store";
import { useNav } from "./app";
import { CloudLoader, LifeCloud, Nimbus, RankBadge, Sparkle, TrophyIcon } from "./art";
import { Camera } from "./camera";
import { Choose } from "./facts";
import { Leaderboard, LeaderboardSheet } from "./leaderboard";
import { PhotoBox } from "./photo-box";
import { Btn, confetti, IconBtn, toast } from "./ui";

const MAX_LIVES = 3;

/**
 * Time shrinks 8% per level up to level 8 (60, 55, 51, 47, 43, 40, 37, 34), then 10% per level,
 * with a 10 s floor: ... 31, 27, 22, 18, 15, 13, 10. Deeper levels are also judged more strictly.
 */
export function timeFor(level: number) {
  const early = 60 * Math.pow(0.92, Math.min(level, 8) - 1);
  const late = level > 8 ? Math.pow(0.9, level - 8) : 1;
  return Math.max(10, Math.round(early * late));
}

// Mostly the hand-written bank (instant, never fails); sometimes the AI writes a fresh one for variety.
async function fetchChallenge(level: number, used: string[]): Promise<string> {
  const lang = getState().settings.language;
  if (lang !== "English" || Math.random() < 0.3) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const r = await api.challenge(level, used, ctrl.signal);
      clearTimeout(t);
      if (!used.includes(r.challenge)) return r.challenge;
    } catch {}
  }
  return pickChallenge(level, used);
}

// Theme: Elevate the Ordinary. Every find lifts an ordinary object into something remarkable.
export const TIERS = [
  { name: "Ordinary", from: 1, bg: "#e0f2fe", fg: "#0c4a6e", ring: "#38bdf8" },
  { name: "Remarkable", from: 4, bg: "#fbcfe8", fg: "#831843", ring: "#ff6fae" },
  { name: "Legendary", from: 8, bg: "#fde68a", fg: "#78350f", ring: "#f59e0b" },
  { name: "Mythic", from: 14, bg: "#ddd6fe", fg: "#4c1d95", ring: "#8b5cf6" },
] as const;

export function tierOf(level: number) {
  let t: (typeof TIERS)[number] = TIERS[0];
  for (const x of TIERS) if (level >= x.from) t = x;
  return t;
}

type Elevated = { object: string; wow: string; thumb: string };
type Feedback = { photo: string; match: boolean; object: string; box: Box | null; comment: string; wow?: string; timeout?: boolean };
type Phase = "intro" | "loading" | "play" | "checking" | "choosing" | "feedback" | "over";

export function Hunt() {
  const { go } = useNav();
  const best = useStore((s) => s.huntBest);
  const startEasy = useStore((s) => s.settings.huntStart) === "easy";
  const offset = startEasy ? 0 : 2;
  const pickMode = useStore((s) => s.settings.huntPick);

  const [phase, setPhase] = useState<Phase>("intro");
  const [found, setFound] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [challenge, setChallenge] = useState("");
  const [total, setTotal] = useState(60);
  const [left, setLeft] = useState(60);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [checkingPhoto, setCheckingPhoto] = useState<string | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [elevated, setElevated] = useState<Elevated[]>([]);
  const [choose, setChoose] = useState<{ photo: string; objects: Detected[] } | null>(null);
  const [checkLine, setCheckLine] = useState(CHECK_LINES[0]);

  const used = useRef<string[]>([]);
  const prefetch = useRef<{ same?: Promise<string>; next?: Promise<string> }>({});
  const abort = useRef<AbortController | null>(null);
  const deadline = useRef(0);
  const lastTick = useRef(0);
  const state = useRef({ found: 0, lives: MAX_LIVES });
  const feedbackRef = useRef<Feedback | null>(null);
  const lastTier = useRef<string>("Ordinary");
  const pausedLeft = useRef(0);

  const level = found + 1 + offset;

  useEffect(() => () => abort.current?.abort(), []);

  const startRound = useCallback(
    async (lvl: number, source?: Promise<string>) => {
      setPhase("loading");
      const c = await (source ?? fetchChallenge(lvl, used.current));
      used.current.push(c);
      const secs = timeFor(lvl);
      setChallenge(c);
      setTotal(secs);
      setLeft(secs);
      deadline.current = performance.now() + secs * 1000;
      lastTick.current = secs;
      setPhase("play");
      sfx("boing");
      const tier = tierOf(lvl);
      if (tier.name !== lastTier.current) {
        lastTier.current = tier.name;
        setTimeout(() => {
          sfx("levelup");
          confetti(0.3, 70);
          toast(`Tier up! Now hunting: ${tier.name}`);
        }, 350);
      }
      // prefetch both possible next challenges (after a hit: harder, after a miss: same level)
      prefetch.current = { same: fetchChallenge(lvl, [...used.current]), next: fetchChallenge(lvl + 1, [...used.current]) };
    },
    [],
  );

  const begin = () => {
    used.current = [];
    state.current = { found: 0, lives: MAX_LIVES };
    setFound(0);
    setLives(MAX_LIVES);
    setNewBest(false);
    setFeedback(null);
    setElevated([]);
    lastTier.current = tierOf(1 + offset).name;
    startRound(1 + offset);
  };

  const finish = useCallback(() => {
    const score = state.current.found;
    if (score > getState().huntBest) {
      update((s) => ({ ...s, huntBest: score }));
      setNewBest(true);
      setTimeout(() => {
        sfx("levelup");
        confetti(0.35, 90);
      }, 400);
    }
    setPhase("over");
  }, []);

  const afterFeedback = useCallback(() => {
    const { found: f, lives: l } = state.current;
    if (l <= 0) {
      finish();
      return;
    }
    const lastWasHit = feedbackRef.current?.match;
    const src = lastWasHit ? prefetch.current.next : prefetch.current.same;
    startRound(f + 1 + offset, src);
  }, [finish, startRound, offset]);

  const showFeedback = (fb: Feedback) => {
    feedbackRef.current = fb;
    setFeedback(fb);
    setPhase("feedback");
  };

  // timer (paused while checking)
  useEffect(() => {
    if (phase !== "play") return;
    let raf = 0;
    const loop = () => {
      const ms = deadline.current - performance.now();
      const secs = Math.max(0, ms / 1000);
      setLeft(secs);
      const whole = Math.ceil(secs);
      if (whole !== lastTick.current) {
        lastTick.current = whole;
        if (whole <= 5 && whole > 0) {
          sfx("tick");
          haptic(5);
        }
      }
      if (ms <= 0) {
        state.current.lives -= 1;
        setLives(state.current.lives);
        sfx("buzz");
        haptic([40, 40, 40]);
        showFeedback({ photo: "", match: false, object: "", box: null, comment: "Time's up! The clouds blew it away.", timeout: true });
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Give the player back the time they had when they snapped, minus nothing.
  const resume = () => {
    deadline.current = performance.now() + pausedLeft.current;
    setPhase("play");
  };

  const runCheck = async (photo: string, target?: Detected) => {
    setCheckingPhoto(photo);
    setCheckLine(shuffle(CHECK_LINES)[0]);
    setPhase("checking");
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const r = await api.check(photo, challenge, ctrl.signal, target ? { name: target.name, box: target.box } : undefined, level);
      if (r.match) {
        state.current.found += 1;
        setFound(state.current.found);
        addXp(10);
        const streak = recordActivity();
        if (streak && streak > 1) toast(`${streak}-day streak!`);
        if (r.wow) {
          shrinkDataUrl(photo, 160)
            .catch(() => "")
            .then((thumb) => setElevated((list) => [...list, { object: r.object, wow: r.wow, thumb }]));
        }
        sfx("chime");
        haptic([20, 40, 20]);
        confetti(0.35, 50);
      } else {
        state.current.lives -= 1;
        setLives(state.current.lives);
        sfx("buzz");
        haptic(80);
      }
      showFeedback({ photo, match: r.match, object: r.object, box: r.box, comment: r.comment, wow: r.wow });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      // AI or network trouble is not the player's fault: explain, then resume with the same time left
      sfx("buzz");
      toast(e instanceof Error && e.message ? e.message : "Couldn't check that photo. Try again!");
      resume();
    }
  };

  const onCapture = async (photo: string) => {
    if (phase !== "play") return;
    pausedLeft.current = Math.max(0, deadline.current - performance.now());
    if (!pickMode) return runCheck(photo);
    // "Pick my object" is on: find the objects first and let the player tap the one they mean.
    setCheckingPhoto(photo);
    setCheckLine("Finding the objects in your photo...");
    setPhase("checking");
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const det = await api.detect(photo, ctrl.signal);
      if (det.objects.length >= 2) {
        sfx("boing");
        setChoose({ photo, objects: det.objects });
        setPhase("choosing");
        return;
      }
      return runCheck(photo, det.objects[0]);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      sfx("buzz");
      toast(e instanceof Error && e.message ? e.message : "Couldn't look at that photo. Try again!");
      resume();
    }
  };

  // auto-continue after feedback
  useEffect(() => {
    if (phase !== "feedback") return;
    const t = setTimeout(afterFeedback, feedback?.wow ? 6500 : 2600);
    return () => clearTimeout(t);
  }, [phase, afterFeedback, feedback]);

  // Skipping costs one cloud, and is not allowed on your last one.
  const skip = () => {
    if (phase !== "play" || state.current.lives <= 1) return;
    state.current.lives -= 1;
    setLives(state.current.lives);
    sfx("buzz");
    haptic(40);
    toast("Skipped. One cloud floated away.");
    startRound(state.current.found + 1 + offset, prefetch.current.same);
  };

  const quit = () => {
    abort.current?.abort();
    go("home");
  };

  if (phase === "intro") return <Intro best={best} onStart={begin} onBack={quit} />;
  if (phase === "over") return <Over score={found} best={Math.max(best, found)} newBest={newBest} last={feedback} elevated={elevated} onAgain={begin} onHome={quit} onJoin={() => go("username")} />;

  const urgent = phase === "play" && left <= 5;

  return (
    <div className="absolute inset-0">
      <Camera
        confirm={false}
        onBack={quit}
        onCapture={onCapture}
        disabled={phase !== "play"}
        top={
          <div className="flex items-start gap-2">
            <ChallengeCard text={phase === "loading" ? "New challenge..." : challenge} level={level} />
            <TimerRing left={left} total={total} urgent={urgent} />
          </div>
        }
      />
      {/* lives + score */}
      <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center justify-between px-5" style={{ top: "calc(env(safe-area-inset-top) + 128px)" }}>
        <div className="glass flex gap-1.5 rounded-full px-3 py-1.5">
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <LifeCloud key={`${i}-${i < lives}`} filled={i < lives} size={30} />
          ))}
        </div>
        {phase === "play" && lives > 1 && (
          <button onClick={skip} className="glass pointer-events-auto rounded-full px-3 py-1.5 text-[0.8rem] font-extrabold whitespace-nowrap active:scale-95">
            Skip (-1 cloud)
          </button>
        )}
        <div className="glass rounded-full px-3.5 py-1.5 text-base font-extrabold whitespace-nowrap">Found: {found}</div>
      </div>

      {/* option: choose which object you are showing */}
      {(phase === "play" || phase === "loading") && (
        <button
          onClick={() => {
            sfx("tap");
            setSetting("huntPick", !pickMode);
            toast(pickMode ? "Nimbus will pick the object for you" : "You'll tap the object you want to show");
          }}
          aria-pressed={pickMode}
          className={`absolute right-5 z-10 flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-[0.8rem] font-extrabold whitespace-nowrap active:scale-95 ${pickMode ? "border-[var(--ink)] bg-[var(--sun)] text-[var(--ink)]" : "glass"}`}
          style={{ top: "calc(env(safe-area-inset-top) + 178px)" }}
        >
          <Crosshair size={16} strokeWidth={2.8} /> Pick my object: {pickMode ? "On" : "Off"}
        </button>
      )}

      {phase === "loading" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-sky-500/70">
          <CloudLoader size={130} />
          <p className="text-xl font-extrabold">Thinking of a challenge...</p>
        </div>
      )}

      {phase === "checking" && checkingPhoto && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-sky-600/80 px-6">
          <div className="relative w-[min(60vw,260px)] overflow-hidden rounded-[26px] border-[3px] border-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={checkingPhoto} alt="" className="block aspect-[3/4] w-full object-cover" />
            <div className="scanline" />
          </div>
          <CloudLoader size={110} />
          <p className="px-4 text-center text-xl font-extrabold">{checkLine}</p>
          <p className="text-sm font-bold opacity-90">Timer paused</p>
        </div>
      )}

      {phase === "choosing" && choose && (
        <div className="absolute inset-0 z-30 bg-gradient-to-b from-sky-400 to-indigo-600">
          <Choose
            photo={choose.photo}
            objects={choose.objects}
            prompt={`Which one answers "${challenge}"? Timer is paused.`}
            retakeLabel="Back to camera"
            autoLabel="Let Nimbus decide"
            onAuto={() => {
              setChoose(null);
              runCheck(choose.photo);
            }}
            onPick={(o) => {
              setChoose(null);
              runCheck(choose.photo, o);
            }}
            onRetake={() => {
              setChoose(null);
              resume();
            }}
          />
        </div>
      )}

      {phase === "feedback" && feedback && <FeedbackView fb={feedback} lives={lives} onContinue={afterFeedback} />}
    </div>
  );
}

function ChallengeCard({ text, level }: { text: string; level: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const tier = tierOf(level);
  useEffect(() => {
    gsap.fromTo(ref.current, { scale: 0.6, rotation: -6, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" });
  }, [text]);
  return (
    <div ref={ref} className="card min-w-0 flex-1 px-3.5 py-2.5">
      <div className="mb-0.5 flex items-center gap-2">
        <span className="rounded-full px-2 py-[1px] text-[0.68rem] font-extrabold tracking-wider uppercase" style={{ background: tier.bg, color: tier.fg, border: `2px solid ${tier.ring}` }}>
          {tier.name}
        </span>
        <span className="text-[0.7rem] font-extrabold text-[var(--ink-soft)]">Level {level}</span>
      </div>
      <div className="text-[1.08rem] leading-tight font-extrabold">{text}</div>
    </div>
  );
}

function TimerRing({ left, total, urgent }: { left: number; total: number; urgent: boolean }) {
  const p = Math.max(0, Math.min(1, left / total));
  const color = p > 0.5 ? "#34d399" : p > 0.2 ? "#ffd23f" : "#f43f5e";
  return (
    <div className={`relative grid h-[68px] w-[68px] shrink-0 place-items-center rounded-full border-[3px] border-[var(--ink)] bg-white ${urgent ? "ring-urgent" : ""}`}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="25" fill="none" stroke="#e2e8f0" strokeWidth="7" />
        <circle cx="32" cy="32" r="25" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} />
      </svg>
      <span className="font-display relative text-xl text-[var(--ink)]">{Math.ceil(left)}</span>
    </div>
  );
}

function FeedbackView({ fb, lives, onContinue }: { fb: Feedback; lives: number; onContinue: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    gsap.fromTo(ref.current, { y: 80, opacity: 0, scale: 0.85 }, { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.8)" });
  }, []);
  return (
    <button
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 px-6 ${fb.match ? "bg-emerald-500/85" : "bg-orange-500/85"}`}
      onClick={onContinue}
    >
      <div ref={ref} className="flex w-full max-w-sm flex-col items-center gap-4">
        <h2 className="font-display text-[2.6rem] leading-none" style={{ textShadow: "0 3px 0 rgba(0,0,0,0.25)" }}>
          {fb.match ? "Found it!" : fb.timeout ? "Time's up!" : "Not quite!"}
        </h2>
        {fb.photo ? (
          <PhotoBox src={fb.photo} maxHeight="38dvh" outlines={fb.box ? [{ box: fb.box, label: fb.object, color: fb.match ? "#86efac" : "#fdba74" }] : []} />
        ) : (
          <Nimbus size={160} mood="sad" className="bob" />
        )}
        <p className="text-center text-lg font-bold">{fb.comment}</p>
        {fb.match && fb.wow && (
          <div className="card w-full p-3.5 text-left">
            <div className="mb-1 flex items-center gap-1.5 text-[0.72rem] font-extrabold tracking-wider text-[var(--violet)] uppercase">
              <Sparkle size={16} color="#8b5cf6" /> Ordinary, elevated
            </div>
            <p className="text-[1.02rem] font-bold leading-snug">{fb.wow}</p>
          </div>
        )}
        {!fb.match && <p className="text-sm font-bold opacity-90">{lives > 0 ? `${lives} ${lives === 1 ? "cloud" : "clouds"} left` : "No clouds left!"}</p>}
        <p className="text-xs font-bold opacity-80">Tap to continue</p>
      </div>
    </button>
  );
}

function Intro({ best, onStart, onBack }: { best: number; onStart: () => void; onBack: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  useEffect(() => {
    gsap.fromTo(ref.current!.querySelectorAll("[data-in]"), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: "back.out(1.7)" });
  }, []);
  return (
    <div ref={ref} className="flex h-full flex-col px-5 pt-4" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
      <div data-in className="flex items-center gap-3">
        <IconBtn label="Back" onClick={onBack}>
          <HomeIcon size={22} strokeWidth={2.6} />
        </IconBtn>
        <h2 className="font-display flex-1 pr-[52px] text-center text-[2.2rem] leading-none" style={{ textShadow: "0 3px 0 #ff6fae" }}>
          Hunt
        </h2>
      </div>
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
       <div className="m-auto flex w-full flex-col items-center gap-4 py-3">
        <div data-in>
          <Nimbus size={140} mood="wow" className="bob" />
        </div>
        <div data-in className="card w-full max-w-md p-5">
          <ul className="flex flex-col gap-3 text-[1.02rem] font-bold">
            <li>Nimbus names an ordinary thing to find.</li>
            <li>Snap it before the timer runs out.</li>
            <li>Each find is elevated with a wow fact. Climb from Ordinary to Remarkable to Legendary, and if you dare, Mythic. It gets faster and stricter every level.</li>
            <li>
              <div>You have 3 clouds. Miss, and one floats away.</div>
              <div className="mt-2 flex gap-2">
                <LifeCloud filled size={34} />
                <LifeCloud filled size={34} />
                <LifeCloud filled size={34} />
              </div>
            </li>
          </ul>
        </div>
        <div data-in className="flex flex-wrap items-center justify-center gap-2">
          <div className="glass flex items-center gap-2 rounded-full px-4 py-2 font-extrabold">
            <TrophyIcon size={26} /> Best: {best}
          </div>
          <button className="glass flex items-center gap-2 rounded-full px-4 py-2 font-extrabold active:scale-95" onClick={() => setBoardOpen(true)}>
            <RankBadge rank={1} size={26} /> Leaderboard
          </button>
        </div>
        <div data-in className="flex w-full max-w-sm flex-col items-center gap-2">
          <Leaderboard limit={3} />
        </div>
       </div>
      </div>
      <div data-in className="mx-auto w-full max-w-md">
        <Btn className="text-2xl" style={{ height: "clamp(68px, 10dvh, 90px)" }} onClick={onStart}>
          Start hunting
        </Btn>
      </div>
      <LeaderboardSheet open={boardOpen} onClose={() => setBoardOpen(false)} />
    </div>
  );
}

function Over({ score, best, newBest, last, elevated, onAgain, onHome, onJoin }: { score: number; best: number; newBest: boolean; last: Feedback | null; elevated: Elevated[]; onAgain: () => void; onHome: () => void; onJoin: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const profile = useStore((st) => st.profile);
  const [rank, setRank] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);

  // send this run's score; the server keeps only each player's best
  useEffect(() => {
    if (!profile || score <= 0) return;
    let alive = true;
    api
      .submitScore(profile.name, profile.token, score)
      .then((r) => {
        if (!alive) return;
        setRank(r.rank);
        setRefresh((k) => k + 1);
        if (r.rank <= 3) toast(`You are #${r.rank} on the leaderboard!`);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof Error && /verify your username/i.test(e.message)) {
          setProfile(null);
          toast("Please choose your username again");
        } else toast(e instanceof Error ? e.message : "Couldn't update the leaderboard");
      });
    return () => {
      alive = false;
    };
  }, [profile, score]);
  useEffect(() => {
    gsap.fromTo(ref.current!.querySelectorAll("[data-in]"), { y: 50, opacity: 0, scale: 0.8 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, stagger: 0.1, ease: "back.out(1.8)" });
  }, []);
  return (
    <div ref={ref} className="no-scrollbar flex h-full flex-col items-center gap-4 overflow-y-auto px-5 pt-6" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
      <h2 data-in className="font-display text-[2.6rem] leading-none" style={{ textShadow: "0 3px 0 #8b5cf6" }}>
        Game Over
      </h2>
      <div data-in className="card flex w-full max-w-sm items-center justify-around p-4">
        <div className="text-center">
          <div className="text-sm font-bold text-[var(--ink-soft)]">Score</div>
          <div className="font-display text-5xl">{score}</div>
        </div>
        <TrophyIcon size={56} />
        <div className="text-center">
          <div className="text-sm font-bold text-[var(--ink-soft)]">Best</div>
          <div className="font-display text-5xl">{best}</div>
        </div>
      </div>
      {newBest && (
        <div data-in className="rounded-full bg-[var(--sun)] px-4 py-1.5 font-extrabold text-[var(--ink)]">
          New high score!
        </div>
      )}
      <div data-in className="flex w-full max-w-sm flex-col items-center gap-2">
        <h3 className="font-display flex items-center gap-2 text-2xl">
          <TrophyIcon size={26} /> Leaderboard
        </h3>
        {profile && rank ? (
          <p className="rounded-full bg-[var(--sun)] px-4 py-1 text-sm font-extrabold text-[var(--ink)]">
            You are ranked #{rank} with a best of {Math.max(best, score)}
          </p>
        ) : null}
        {!profile && (
          <Btn variant="sun" className="h-14" onClick={onJoin}>
            Pick a username to join
          </Btn>
        )}
        <Leaderboard limit={10} refreshKey={refresh} />
      </div>
      <div data-in className="w-full max-w-sm">
        <div className="mb-2 flex items-center justify-center gap-2 font-display text-xl">
          <Sparkle size={20} /> {elevated.length > 0 ? `You elevated ${elevated.length} ordinary ${elevated.length === 1 ? "thing" : "things"}` : "Nothing elevated yet"} <Sparkle size={20} />
        </div>
        {elevated.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {elevated.map((e, i) => (
              <li key={i} className="card flex gap-3 p-2.5">
                {e.thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.thumb} alt="" className="h-16 w-16 shrink-0 rounded-xl border-2 border-[var(--ink)] object-cover" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-extrabold capitalize">{e.object}</div>
                  <p className="text-[0.88rem] leading-snug font-semibold text-[var(--ink-soft)]">{e.wow}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-sm font-bold opacity-90">Find an everyday object and I&apos;ll show you why it&apos;s remarkable.</p>
        )}
      </div>
      {last?.photo && !last.match && (
        <div data-in className="w-full max-w-sm">
          <p className="mb-2 text-center text-sm font-bold opacity-90">What Nimbus saw last:</p>
          <PhotoBox src={last.photo} maxHeight="30dvh" outlines={last.box ? [{ box: last.box, label: last.object, color: "#fdba74" }] : []} />
        </div>
      )}
      <div className="flex-1" />
      <div data-in className="flex w-full max-w-md gap-3">
        <Btn variant="white" className="h-16 text-xl" onClick={onHome}>
          <HomeIcon size={20} strokeWidth={2.8} /> Main Menu
        </Btn>
        <Btn className="h-16 text-xl" onClick={onAgain}>
          <RotateCcw size={20} strokeWidth={2.8} /> Play Again
        </Btn>
      </div>
    </div>
  );
}
