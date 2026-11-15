"use client";
import gsap from "gsap";
import { Camera as CameraIcon, Home as HomeIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, ApiError, Detected } from "@/lib/client/api";
import { haptic, sfx } from "@/lib/client/audio";
import { shrinkDataUrl } from "@/lib/client/image";
import { addNote, addXp, Box, getState, NOTE_COLOR_COUNT, objectKey, rememberFacts, update, useStore } from "@/lib/client/store";
import { useNav } from "./app";
import { CloudLoader, Nimbus, NOTE_COLORS, Pushpin } from "./art";
import { Camera } from "./camera";
import { PhotoBox } from "./photo-box";
import { Btn, confetti, CountUp, IconBtn, toast } from "./ui";

type Result = {
  photo: string;
  box: Box | null;
  object: string;
  title: string;
  facts: string[];
  quiz: { question: string; options: string[]; answer: number } | null;
  confidence: number;
  metBefore: boolean;
};

type Phase =
  | { k: "camera" }
  | { k: "loading"; photo: string }
  | { k: "choose"; photo: string; objects: Detected[] }
  | { k: "result"; r: Result }
  | { k: "error"; msg: string };

const LINES = [
  "Asking the clouds...",
  "Flipping through the sky library...",
  "Polishing my fact goggles...",
  "Whispering to the object...",
  "Counting fun facts...",
  "Fluffing up my brain...",
];

function area(b: Box) {
  return (b[2] - b[0]) * (b[3] - b[1]);
}

/** Pick automatically when the AI is clearly sure which object the user means. */
function autoPick(objects: Detected[]): Detected | null {
  if (objects.length === 0) return null;
  const [a, b] = objects;
  if (!b) return a.confidence >= 45 ? a : null;
  if (a.confidence >= 70 && area(a.box) >= 2 * area(b.box)) return a;
  return null;
}

export function Facts() {
  const { go } = useNav();
  const tutorialDone = useStore((s) => s.tutorialDone);
  const [phase, setPhase] = useState<Phase>({ k: "camera" });
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const fail = (e: unknown) => {
    if ((e as Error)?.name === "AbortError") return;
    sfx("buzz");
    setPhase({ k: "error", msg: e instanceof ApiError ? e.message : "Nimbus lost the signal. Check your internet and try again." });
  };

  const analyze = async (photo: string) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setPhase({ k: "loading", photo });
    try {
      const det = await api.detect(photo, ctrl.signal);
      if (det.objects.length === 0) {
        sfx("buzz");
        setPhase({
          k: "error",
          msg: det.hasPerson
            ? "I only learn about objects, not people. Point me at a thing instead!"
            : "Hmm, I couldn't spot an object. Try getting closer with better light.",
        });
        return;
      }
      const pick = autoPick(det.objects);
      if (pick) await learn(photo, pick, ctrl);
      else {
        sfx("boing");
        setPhase({ k: "choose", photo, objects: det.objects });
      }
    } catch (e) {
      fail(e);
    }
  };

  const learn = async (photo: string, obj: Detected, ctrl?: AbortController) => {
    if (!ctrl) {
      abort.current?.abort();
      ctrl = new AbortController();
      abort.current = ctrl;
    }
    setPhase({ k: "loading", photo });
    const key = objectKey(obj.name);
    const seen = getState().seenFacts[key] ?? [];
    try {
      const res = await api.facts({ image: photo, target: obj.name, avoid: seen, style: getState().settings.factStyle }, ctrl.signal);
      if (!res.facts.length) throw new ApiError("Nimbus drew a blank. Try another photo!");
      rememberFacts(key, res.facts);
      setPhase({
        k: "result",
        r: {
          photo,
          box: obj.box,
          object: res.object || obj.name,
          title: res.title,
          facts: res.facts,
          quiz: res.quiz,
          confidence: Math.round((res.confidence + obj.confidence) / 2),
          metBefore: seen.length > 0,
        },
      });
    } catch (e) {
      fail(e);
    }
  };

  const cancel = () => {
    abort.current?.abort();
    sfx("tap");
    setPhase({ k: "camera" });
  };

  return (
    <div className="absolute inset-0">
      {(phase.k === "camera" || phase.k === "loading") && (
        <Camera onBack={() => go("home")} onCapture={analyze} disabled={phase.k !== "camera"} />
      )}
      {phase.k === "loading" && <Loading photo={phase.photo} onCancel={cancel} />}
      {phase.k === "choose" && (
        <Choose photo={phase.photo} objects={phase.objects} onPick={(o) => learn(phase.photo, o)} onRetake={() => setPhase({ k: "camera" })} />
      )}
      {phase.k === "result" && (
        <ResultView key={phase.r.photo} r={phase.r} onAgain={() => setPhase({ k: "camera" })} onHome={() => go("home")} />
      )}
      {phase.k === "error" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-b from-sky-400/90 to-indigo-600/90 p-6">
          <div className="card w-full max-w-sm p-6 text-center">
            <Nimbus size={110} mood="sad" className="bob mx-auto" />
            <p className="mt-3 text-lg font-bold">{phase.msg}</p>
            <div className="mt-5 flex flex-col gap-3">
              <Btn variant="mint" className="h-14 text-lg" onClick={() => setPhase({ k: "camera" })}>
                Try again
              </Btn>
              <Btn variant="white" className="h-12" onClick={() => go("home")}>
                Main Menu
              </Btn>
            </div>
          </div>
        </div>
      )}
      {!tutorialDone && <Tutorial onDone={() => update((s) => ({ ...s, tutorialDone: true }))} />}
    </div>
  );
}

// ---------- Tutorial ----------
const STEPS = [
  { mood: "happy" as const, text: "Hi, I'm Nimbus! In Facts, you snap any everyday object and I'll tell you its secrets." },
  { mood: "wow" as const, text: "Point your camera at ONE object, then tap the big white button." },
  { mood: "think" as const, text: "If I see a few things, I'll outline them. Just tap the one you mean!" },
  { mood: "happy" as const, text: "Every object you learn about becomes a sticky note on your Bulletin Board. Ready?" },
];

function Tutorial({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLParagraphElement>(null);
  const step = STEPS[i];

  useEffect(() => {
    gsap.fromTo(box.current, { y: 60, opacity: 0, scale: 0.85 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.8)" });
  }, []);

  useEffect(() => {
    if (!text.current) return;
    const chars = text.current.querySelectorAll("span");
    gsap.fromTo(chars, { opacity: 0 }, { opacity: 1, duration: 0.01, stagger: 0.018 });
    sfx("pop", 1 + i * 0.1);
  }, [i]);

  const next = () => {
    if (i < STEPS.length - 1) setI(i + 1);
    else {
      gsap.to(box.current, { y: 80, opacity: 0, scale: 0.8, duration: 0.3, ease: "power2.in", onComplete: onDone });
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-slate-950/55 p-5" style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
      <div ref={box} className="mx-auto w-full max-w-md">
        <div className="mb-[-10px] ml-4 flex items-end gap-2">
          <Nimbus size={96} mood={step.mood} className="bob" />
        </div>
        <div className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-xl">How it works</span>
            <span className="text-sm font-bold text-[var(--ink-soft)]">
              {i + 1} / {STEPS.length}
            </span>
          </div>
          <p ref={text} className="min-h-[4.5rem] text-[1.08rem] font-bold leading-snug">
            {step.text.split("").map((c, j) => (
              <span key={`${i}-${j}`}>{c}</span>
            ))}
          </p>
          <div className="mt-4 flex gap-3">
            <Btn variant="white" className="h-12" onClick={onDone}>
              Skip
            </Btn>
            <Btn variant="mint" className="h-12 text-lg" onClick={next}>
              {i < STEPS.length - 1 ? "Next" : "Let's go!"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Loading ----------
function Loading({ photo, onCancel }: { photo: string; onCancel: () => void }) {
  const [line, setLine] = useState(0);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    const t = setInterval(() => setLine((l) => (l + 1) % LINES.length), 1700);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    gsap.fromTo(lineRef.current, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "back.out(2)" });
  }, [line]);

  return (
    <div ref={root} className="absolute inset-0 z-30 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/70 via-sky-500/60 to-indigo-600/80" />
      <div className="relative flex h-full flex-col items-center justify-center gap-6 px-6">
        <div className="relative w-[min(70vw,300px)] overflow-hidden rounded-[28px] border-[3px] border-white shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="Your photo" className="block aspect-[3/4] w-full object-cover" />
          <div className="scanline" />
        </div>
        <CloudLoader size={130} />
        <p ref={lineRef} className="h-7 text-center text-xl font-extrabold">
          {LINES[line]}
        </p>
        <button onClick={onCancel} className="glass rounded-full px-8 py-3 text-lg font-extrabold active:scale-95">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------- Choose object ----------
function Choose({ photo, objects, onPick, onRetake }: { photo: string; objects: Detected[]; onPick: (o: Detected) => void; onRetake: () => void }) {
  const colors = ["#ffd23f", "#ff6fae", "#34d399"];
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    gsap.fromTo(root.current!.querySelectorAll("[data-in]"), { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.5, ease: "back.out(1.7)" });
  }, []);
  return (
    <div ref={root} className="absolute inset-0 z-30 flex flex-col items-center gap-4 overflow-y-auto px-5 pt-6" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
      <div data-in className="flex w-full max-w-md items-center gap-3">
        <Nimbus size={80} mood="think" className="bob shrink-0" />
        <div className="bubble flex-1 px-4 py-3 text-[1rem] font-bold after:hidden">I see a few things! Tap the one you want to learn about.</div>
      </div>
      <div data-in className="w-full max-w-md">
        <PhotoBox
          src={photo}
          maxHeight="50dvh"
          outlines={objects.map((o, i) => ({ box: o.box, label: o.name, color: colors[i % 3], selectable: true }))}
          onSelect={(i) => onPick(objects[i])}
        />
      </div>
      <div data-in className="flex w-full max-w-md flex-col gap-2.5">
        {objects.map((o, i) => (
          <Btn key={i} variant="white" className="h-13 py-3 text-lg capitalize" onClick={() => onPick(o)}>
            <span className="h-4 w-4 rounded-full border-2 border-[var(--ink)]" style={{ background: colors[i % 3] }} />
            {o.name}
          </Btn>
        ))}
        <button className="mt-1 text-sm font-bold underline opacity-90" onClick={onRetake}>
          Retake photo
        </button>
      </div>
    </div>
  );
}

// ---------- Result ----------
/** Slow -> fast -> slow spacing for the fact reveal. */
function revealTimes(n: number, total: number) {
  const k = 0.75;
  return Array.from({ length: n }, (_, i) => {
    const u = n === 1 ? 0 : i / (n - 1);
    // derivative 1 + k*cos(2*pi*u): big gaps at the start and end, small gaps in the middle
    return total * (u + (k * Math.sin(2 * Math.PI * u)) / (2 * Math.PI));
  });
}

function ResultView({ r, onAgain, onHome }: { r: Result; onAgain: () => void; onHome: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const boardChip = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<"reveal" | "pin" | "done">("reveal");
  const [xpGain, setXpGain] = useState(0);
  const [quizPick, setQuizPick] = useState<number | null>(null);
  const [noteColor] = useState(() => Math.floor(Math.random() * NOTE_COLOR_COUNT));

  // reveal facts: slow -> fast -> slow, with rising pops
  useLayoutEffect(() => {
    const el = root.current!;
    const cards = el.querySelectorAll<HTMLElement>("[data-fact]");
    gsap.set(cards, { opacity: 0, y: 40, scale: 0.7, rotation: () => gsap.utils.random(-5, 5) });
    gsap.fromTo(el.querySelectorAll("[data-head]"), { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: "back.out(2)" });

    const n = cards.length;
    const total = 0.75 * n + 0.6;
    const times = revealTimes(n, total);
    const tl = gsap.timeline({ delay: 1.1 });
    cards.forEach((c, i) => {
      tl.to(c, { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.6, ease: "elastic.out(1, 0.55)" }, times[i]);
      tl.call(() => {
        sfx("pop", 1 + i * 0.07);
        haptic(8);
        c.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, [], times[i]);
    });
    tl.call(() => {
      const gain = r.facts.length * 5;
      setXpGain(gain);
      addXp(gain);
      sfx("chime");
      setStage("pin");
    }, [], "+=0.5");
    return () => {
      tl.kill();
    };
  }, [r]);

  // create the sticky note when pinning starts
  useEffect(() => {
    if (stage !== "pin") return;
    (async () => {
      try {
        const small = await shrinkDataUrl(r.photo, 640);
        await addNote(r.title, { photo: small, box: r.box, facts: r.facts, confidence: r.confidence, object: r.object }, noteColor);
      } catch {
        toast("Couldn't save to your board (storage full?)");
      }
    })();
  }, [stage, r, noteColor]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-gradient-to-b from-sky-400 via-sky-500 to-indigo-500 dark:from-indigo-800 dark:via-indigo-900 dark:to-slate-950">
      <div ref={root} className="no-scrollbar flex-1 overflow-y-auto px-5 pt-4" style={{ paddingBottom: 24 }}>
        {/* header */}
        <div data-head className="mb-3 flex items-center gap-3">
          <IconBtn label="Main menu" onClick={onHome}>
            <HomeIcon size={22} strokeWidth={2.6} />
          </IconBtn>
          <h2 className="font-display flex-1 text-center text-[2rem] leading-none" style={{ textShadow: "0 3px 0 #8b5cf6" }}>
            Facts
          </h2>
          <div ref={boardChip} className="icon-btn" aria-label="Bulletin board">
            <Pushpin size={24} />
          </div>
        </div>

        <div data-head className="mx-auto max-w-md">
          <PhotoBox src={r.photo} maxHeight="32dvh" outlines={r.box ? [{ box: r.box, label: r.object }] : []} />
        </div>

        <div data-head className="mx-auto mt-4 max-w-md text-center">
          {r.metBefore && (
            <div className="mb-2 inline-block rounded-full bg-[var(--sun)] px-3 py-1 text-sm font-extrabold text-[var(--ink)]">
              We&apos;ve met before! Here are new facts.
            </div>
          )}
          <div className="font-hand text-[2.6rem] leading-none font-bold">{r.title}</div>
          <div className="mt-1 text-sm font-bold capitalize opacity-85">{r.object}</div>
        </div>

        <ol className="mx-auto mt-4 flex max-w-md flex-col gap-3">
          {r.facts.map((f, i) => (
            <li key={i} data-fact className="card flex gap-3 p-3.5">
              <span
                className="font-display grid h-9 w-9 shrink-0 place-items-center rounded-xl border-[2.5px] border-[var(--ink)] text-lg text-[var(--ink)]"
                style={{ background: NOTE_COLORS[i % NOTE_COLORS.length] }}
              >
                {i + 1}
              </span>
              <p className="text-[1.02rem] font-semibold leading-snug">{f}</p>
            </li>
          ))}
        </ol>

        {stage !== "reveal" && (
          <div className="mx-auto mt-4 max-w-md">
            <XpChip gain={xpGain} />
          </div>
        )}

        {stage === "done" && r.quiz && <Quiz quiz={r.quiz} pick={quizPick} onPick={setQuizPick} />}

        <div className="mx-auto mt-6 max-w-md text-center text-[0.72rem] leading-snug opacity-80">
          AI confidence: ~{r.confidence}%
          <br />
          This is AI, and some facts may be incorrect.
        </div>
      </div>

      {/* footer */}
      <div className="flex gap-3 border-t-2 border-white/30 px-5 pt-3" style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}>
        <Btn variant="white" className="h-14 text-[1.05rem]" onClick={onHome}>
          <HomeIcon size={20} strokeWidth={2.8} /> Main Menu
        </Btn>
        <Btn variant="sun" className="h-14 text-[1.05rem]" onClick={onAgain}>
          <CameraIcon size={20} strokeWidth={2.8} /> Another Picture
        </Btn>
      </div>

      {stage === "pin" && <PinFly title={r.title} color={noteColor} target={boardChip} onDone={() => setStage("done")} />}
    </div>
  );
}

function XpChip({ gain }: { gain: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    gsap.fromTo(ref.current, { scale: 0, rotation: -10 }, { scale: 1, rotation: 0, duration: 0.7, ease: "elastic.out(1, 0.5)" });
  }, []);
  return (
    <div ref={ref} className="card mx-auto flex w-fit items-center gap-2 px-4 py-2 text-lg font-extrabold">
      <span className="text-[var(--violet)]">
        <CountUp to={gain} prefix="+" />
      </span>
      brain points
    </div>
  );
}

function Quiz({ quiz, pick, onPick }: { quiz: NonNullable<Result["quiz"]>; pick: number | null; onPick: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    gsap.fromTo(ref.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "back.out(1.7)" });
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);
  const answer = (i: number) => {
    if (pick !== null) return;
    onPick(i);
    if (i === quiz.answer) {
      sfx("chime");
      haptic([20, 40, 20]);
      confetti(0.6, 40);
      addXp(15);
      toast("Correct! +15 brain points");
    } else {
      sfx("buzz");
      haptic(60);
    }
  };
  return (
    <div ref={ref} className="card mx-auto mt-4 max-w-md p-4">
      <div className="font-display text-lg">Quick quiz</div>
      <p className="mt-1 font-bold">{quiz.question}</p>
      <div className="mt-3 flex flex-col gap-2">
        {quiz.options.map((o, i) => {
          const state = pick === null ? "" : i === quiz.answer ? "bg-[var(--mint)] text-white" : i === pick ? "bg-[var(--bad)] text-white" : "opacity-60";
          return (
            <button key={i} onClick={() => answer(i)} className={`rounded-2xl border-[2.5px] border-[var(--ink)] px-4 py-2.5 text-left font-bold transition active:scale-[0.97] ${state}`}>
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Sticky-note placing animation ----------
function PinFly({ title, color, target, onDone }: { title: string; color: number; target: React.RefObject<HTMLDivElement | null>; onDone: () => void }) {
  const note = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const n = note.current!;
    const t = target.current?.getBoundingClientRect();
    const r = n.getBoundingClientRect();
    const dx = t ? t.left + t.width / 2 - (r.left + r.width / 2) : 0;
    const dy = t ? t.top + t.height / 2 - (r.top + r.height / 2) : -300;
    const tl = gsap.timeline({ onComplete: onDone });
    tl.fromTo(n, { scale: 0, rotation: -25 }, { scale: 1, rotation: -4, duration: 0.6, ease: "back.out(1.8)" })
      .fromTo(label.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3 }, "-=0.2")
      .fromTo(pin.current, { y: -140, opacity: 0, scale: 1.6 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "bounce.out" })
      .call(() => {
        sfx("thunk");
        haptic(30);
      }, [], "-=0.32")
      .to(n, { rotation: 3, duration: 0.15, ease: "sine.inOut", yoyo: true, repeat: 3 }, "-=0.2")
      .to(label.current, { opacity: 0, duration: 0.2 }, "+=0.35")
      .to(n, { x: dx, y: dy, scale: 0.12, rotation: 25, duration: 0.65, ease: "power3.in" })
      .call(() => {
        if (target.current) gsap.fromTo(target.current, { scale: 1.35, rotation: -12 }, { scale: 1, rotation: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
        sfx("pop", 1.3);
        toast("Pinned to your Bulletin Board!");
      })
      .set(n, { opacity: 0 });
    return () => {
      tl.kill();
    };
  }, [target, onDone]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-900/30">
      <div ref={note} className="relative">
        <div ref={pin} className="absolute left-1/2 top-[-18px] z-10 -translate-x-1/2">
          <Pushpin size={38} />
        </div>
        <div className="sticky" style={{ background: NOTE_COLORS[color], width: 190, height: 190, fontSize: 34 }}>
          {title}
        </div>
      </div>
      <div ref={label} className="mt-5 text-xl font-extrabold">
        Saving to your board...
      </div>
    </div>
  );
}
