"use client";
import gsap from "gsap";
import { Camera as CameraIcon, Home as HomeIcon, StickyNote } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, ApiError, Detected } from "@/lib/client/api";
import { sfx } from "@/lib/client/audio";
import { shrinkDataUrl } from "@/lib/client/image";
import { setPendingNote } from "@/lib/client/nav";
import { ANALYZE_LINES, shuffle, shuffleQuiz } from "@/lib/client/random";
import { addNote, addXp, Box, getState, objectKey, patchNote, recordActivity, rememberFacts, saveNoteDetail, update, useStore } from "@/lib/client/store";
import { useNav } from "./app";
import { categoryColor, clampTitle, CloudLoader, Nimbus, NOTE_COLORS, noteFontSize, Pushpin } from "./art";
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
  category: string;
  /** Set when this result corrects an existing note, so the note is updated instead of a new one added. */
  noteId?: string;
};

type Target = { name: string; box: Box | null; confidence: number };

type Phase =
  | { k: "camera" }
  | { k: "loading"; photo: string }
  | { k: "choose"; photo: string; objects: Detected[] }
  | { k: "result"; r: Result }
  | { k: "error"; msg: string };


function area(b: Box) {
  return (b[2] - b[0]) * (b[3] - b[1]);
}

/** Pick automatically when the AI is clearly sure which object the user means. */
export function autoPick(objects: Detected[]): Detected | null {
  if (objects.length === 0) return null;
  const [a, b] = objects;
  if (!b) return a.confidence >= 60 ? a : null;
  if (a.confidence >= 80 && area(a.box) >= 3 * area(b.box)) return a;
  return null; // not sure which one you mean (or what it is): ask
}

export function Facts() {
  const { go } = useNav();
  const tutorialDone = useStore((s) => s.tutorialDone);
  const [phase, setPhase] = useState<Phase>({ k: "camera" });
  const abort = useRef<AbortController | null>(null);
  const savedNote = useRef<string | undefined>(undefined);

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
      let det = await api.detect(photo, ctrl.signal);
      if (det.objects.length === 0) det = await api.detect(photo, ctrl.signal); // the AI sometimes misses: look once more
      if (det.objects.length === 0 && det.hasPerson) {
        // a person in the photo: Nimbus teaches general facts about humans (it never says who they are)
        await learn(photo, { name: "person", box: null, confidence: 85 }, ctrl);
        return;
      }
      if (det.objects.length === 0) {
        // nothing found: let the player tell Nimbus what it is
        sfx("boing");
        setPhase({ k: "choose", photo, objects: [] });
        return;
      }
      // people are fine too: if the AI saw a person but listed only things, add "person" as a choice
      if (det.hasPerson && !det.objects.some((o) => /person|people|hand|face|human/i.test(o.name))) {
        const personBox: Box = [40, 40, 960, 960];
        det = { ...det, objects: [...det.objects, { name: "person", box: personBox, confidence: 70 }].slice(0, 4) };
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

  const learn = async (photo: string, obj: Target, ctrl?: AbortController, typed = false, noteId?: string) => {
    if (!ctrl) {
      abort.current?.abort();
      ctrl = new AbortController();
      abort.current = ctrl;
    }
    setPhase({ k: "loading", photo });
    const key = objectKey(obj.name);
    const seen = getState().seenFacts[key] ?? [];
    try {
      const res = await api.facts({ image: photo, target: obj.name, avoid: seen, style: getState().settings.factStyle, typed }, ctrl.signal);
      if (!res.facts.length) throw new ApiError("Nimbus drew a blank. Try another photo!");
      rememberFacts(key, res.facts);
      setPhase({
        k: "result",
        r: {
          photo,
          box: obj.box,
          object: res.object || obj.name,
          title: clampTitle(res.title) || clampTitle(obj.name),
          facts: res.facts,
          quiz: res.quiz ? shuffleQuiz(res.quiz) : null,
          confidence: Math.round((res.confidence + obj.confidence) / 2),
          metBefore: seen.length > 0,
          category: res.category,
          noteId,
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
    <div className="bleed absolute inset-0">
      {(phase.k === "camera" || phase.k === "loading") && (
        <Camera onBack={() => go("home")} onCapture={analyze} disabled={phase.k !== "camera"} />
      )}
      {phase.k === "loading" && <Loading photo={phase.photo} onCancel={cancel} />}
      {phase.k === "choose" && (
        <Choose
          photo={phase.photo}
          objects={phase.objects}
          onPick={(o) => learn(phase.photo, o)}
          onTyped={(name) => learn(phase.photo, { name, box: null, confidence: 85 }, undefined, true)}
          onRetake={() => setPhase({ k: "camera" })}
        />
      )}
      {phase.k === "result" && (
        <ResultView
          key={phase.r.photo}
          r={phase.r}
          onAgain={() => setPhase({ k: "camera" })}
          onHome={() => go("home")}
          onSaved={(id) => {
            savedNote.current = id;
          }}
          onCorrect={(typed) => learn(phase.r.photo, { name: typed, box: null, confidence: 85 }, undefined, true, savedNote.current)}
          onBoard={(id) => {
            if (id) setPendingNote(id);
            go("board");
          }}
        />
      )}
      {phase.k === "error" && (
        <div className="absolute inset-0 z-30 flex overflow-y-auto bg-gradient-to-b from-sky-400/90 to-indigo-600/90 p-4">
          <div className="card m-auto w-full max-w-sm p-5 text-center">
            <Nimbus size={150} mood="sad" className="bob mx-auto" />
            <p className="mt-3 text-lg font-bold">{phase.msg}</p>
            <div className="mt-5 flex flex-col gap-3">
              <Btn variant="mint" className="h-[58px] text-lg" onClick={() => setPhase({ k: "camera" })}>
                Try again
              </Btn>
              <Btn variant="white" className="h-[50px]" onClick={() => go("home")}>
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
  { mood: "happy" as const, text: "Hi, I'm Nimbus! Show me something ordinary and I'll make it extraordinary. Instead of scrolling, snap any everyday object." },
  { mood: "wow" as const, text: "Point your camera at ONE object, then click the big white button." },
  { mood: "think" as const, text: "If I see a few things, I'll outline them. Just click the one you mean!" },
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
    <div className="absolute inset-0 z-40 flex flex-col justify-end overflow-y-auto bg-slate-950/55 p-5" style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
      <div ref={box} className="mx-auto w-full max-w-md">
        <div className="tutorial-nimbus mb-[-10px] ml-4 flex items-end gap-2">
          <Nimbus size={140} mood={step.mood} className="bob" />
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
            <Btn variant="white" className="h-[50px]" onClick={onDone}>
              Skip
            </Btn>
            <Btn variant="mint" className="h-[50px] text-lg" onClick={next}>
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
  // A new random order every time, so the lines never feel repeated.
  const [order] = useState(() => shuffle(ANALYZE_LINES));
  const [line, setLine] = useState(0);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    const t = setInterval(() => setLine((l) => (l + 1) % order.length), 1700);
    return () => clearInterval(t);
  }, [order.length]);
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
          {order[line]}
        </p>
        <button onClick={onCancel} className="glass rounded-full px-8 py-3 text-lg font-extrabold active:scale-95">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------- Choose object ----------
export function Choose({
  photo,
  objects,
  onPick,
  onRetake,
  prompt = "I see a few things! Click the one you want to learn about.",
  retakeLabel = "Retake photo",
  autoLabel,
  onAuto,
  onTyped,
}: {
  photo: string;
  objects: Detected[];
  onPick: (o: Detected) => void;
  onTyped?: (name: string) => void;
  onRetake: () => void;
  prompt?: string;
  retakeLabel?: string;
  autoLabel?: string;
  onAuto?: () => void;
}) {
  const colors = ["#ffd23f", "#ff6fae", "#34d399"];
  const root = useRef<HTMLDivElement>(null);
  const [typing, setTyping] = useState(objects.length === 0);
  const [typed, setTyped] = useState("");
  useEffect(() => {
    gsap.fromTo(root.current!.querySelectorAll("[data-in]"), { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.5, ease: "back.out(1.7)" });
  }, []);
  return (
    <div ref={root} className="absolute inset-0 z-30 flex flex-col items-center gap-4 overflow-y-auto px-5 pt-6" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
      <div data-in className="flex w-full max-w-md items-center gap-3">
        <div className="choose-nimbus shrink-0">
          <Nimbus size={110} mood="think" className="bob" />
        </div>
        <div className="bubble bubble-left flex-1 px-4 py-3 text-[1rem] font-bold">{objects.length === 0 ? "I couldn't spot it. Tell me what it is and I'll teach you about it!" : prompt}</div>
      </div>
      <div data-in className="w-full max-w-md">
        <PhotoBox
          src={photo}
          maxHeight="clamp(170px, 34dvh, 400px)"
          outlines={objects.map((o, i) => ({ box: o.box, label: o.name, color: colors[i % 3], selectable: true }))}
          onSelect={(i) => onPick(objects[i])}
        />
      </div>
      <div data-in className="flex w-full max-w-md flex-col gap-2.5">
        {objects.map((o, i) => (
          <Btn key={i} variant="white" className="h-[54px] py-3 text-lg capitalize" onClick={() => onPick(o)}>
            <span className="h-4 w-4 rounded-full border-2 border-[var(--ink)]" style={{ background: colors[i % 3] }} />
            {o.name}
          </Btn>
        ))}
        {onTyped && (
          <div>
            {!typing ? (
              <button className="min-h-[46px] w-full rounded-2xl border-[2.5px] border-[var(--ink)] bg-white/85 px-3 text-center text-[0.95rem] font-extrabold text-[var(--ink)] active:scale-[0.98]" onClick={() => setTyping(true)}>
                None of these? Tell Nimbus what it is
              </button>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (typed.trim()) onTyped(typed.trim().slice(0, 60));
                }}
              >
                <input
                  autoFocus
                  value={typed}
                  maxLength={60}
                  placeholder="What is it?"
                  onChange={(e) => setTyped(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border-[2.5px] border-[var(--ink)] bg-white px-3 py-2.5 text-lg font-bold text-[var(--ink)] outline-none"
                />
                <button type="submit" disabled={!typed.trim()} className="rounded-xl border-[2.5px] border-[var(--ink)] bg-[var(--sun)] px-4 font-extrabold text-[var(--ink)] disabled:opacity-50 active:scale-95">
                  Go
                </button>
              </form>
            )}
          </div>
        )}
        {onAuto && autoLabel && (
          <Btn variant="sun" className="h-[50px]" onClick={onAuto}>
            {autoLabel}
          </Btn>
        )}
        <button className="mx-auto mt-1 min-h-[44px] rounded-full bg-white/85 px-5 text-sm font-extrabold text-[var(--ink)] active:scale-95" onClick={onRetake}>
          {retakeLabel}
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

function ResultView({ r, onAgain, onHome, onBoard, onCorrect, onSaved }: { r: Result; onAgain: () => void; onHome: () => void; onBoard: (noteId: string | null) => void; onCorrect: (typed: string) => void; onSaved: (id: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const boardChip = useRef<HTMLButtonElement>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [stage, setStage] = useState<"reveal" | "pin" | "done">("reveal");
  const [xpGain, setXpGain] = useState(0);
  const [quizPick, setQuizPick] = useState<number | null>(null);
  const [noteColor] = useState(() => categoryColor(r.category));

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
        c.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, [], times[i]);
    });
    tl.call(() => {
      const gain = r.noteId ? 0 : r.facts.length * 5; // fixing a wrong guess earns no extra points
      setXpGain(gain);
      if (gain) {
        addXp(gain);
        const streak = recordActivity();
        if (streak && streak > 1) setTimeout(() => toast(`${streak}-day streak! Keep it going.`), 1800);
      }
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
        if (r.noteId) {
          // a correction: update the note that is already on the board
          const small = await shrinkDataUrl(r.photo, 640);
          await saveNoteDetail(r.noteId, { photo: small, box: r.box, facts: r.facts, confidence: r.confidence, object: r.object });
          patchNote(r.noteId, { title: r.title, suggested: r.title, object: r.object, category: r.category });
          setSavedId(r.noteId);
          onSaved(r.noteId);
          toast("Updated your note on the Bulletin Board");
          setStage("done");
          return;
        }
        const small = await shrinkDataUrl(r.photo, 640);
        const n = await addNote(r.title, { photo: small, box: r.box, facts: r.facts, confidence: r.confidence, object: r.object }, noteColor, r.category);
        setSavedId(n.id);
        onSaved(n.id);
      } catch {
        toast("Couldn't save to your board (storage full?)");
      }
    })();
    // onSaved is a new function each render; adding it here would save the note twice
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <button ref={boardChip} className="icon-btn" aria-label="Open my Bulletin Board" onClick={() => onBoard(savedId)}>
            <StickyNote size={24} strokeWidth={2.6} />
          </button>
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
          <div className="text-sm font-extrabold capitalize opacity-90">Ordinary: {r.object}</div>
          <div className="my-0.5 text-lg font-extrabold leading-none opacity-80" aria-hidden>↓ elevated ↓</div>
          <div className="font-hand text-[2.6rem] leading-none font-bold">{r.title}</div>
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

        {stage === "done" && <WrongObject current={r.object} onCorrect={onCorrect} />}

        <div className="mx-auto mt-6 max-w-md text-center text-[0.72rem] leading-snug opacity-80">
          AI confidence: about {r.confidence}%
          <br />
          This is AI, and some facts may be incorrect.
        </div>
      </div>

      {/* footer */}
      <div className="border-t-2 border-white/30 px-5 pt-3" style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex w-full max-w-md gap-3">
        <Btn variant="white" className="h-[58px] text-[1.05rem]" onClick={onHome}>
          <HomeIcon size={20} strokeWidth={2.8} /> Main Menu
        </Btn>
        <Btn variant="sun" className="h-[58px] text-[1.05rem]" onClick={onAgain}>
          <CameraIcon size={20} strokeWidth={2.8} /> Snap Again
        </Btn>
        </div>
      </div>

      {stage === "pin" && !r.noteId && <PinFly title={r.title} color={noteColor} target={boardChip} onDone={() => setStage("done")} />}
    </div>
  );
}

/** Small "that's not it" button under the quiz: type what the object really is and get new facts. */
function WrongObject({ current, onCorrect }: { current: string; onCorrect: (typed: string) => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  return (
    <div className="mx-auto mt-4 max-w-md text-center">
      {!open ? (
        <button className="min-h-[46px] rounded-full bg-white/85 px-5 text-sm font-extrabold text-[var(--ink)] active:scale-95" onClick={() => setOpen(true)}>
          Not a {current}? Tell Nimbus what it really is
        </button>
      ) : (
        <form
          className="card flex gap-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) onCorrect(typed.trim().slice(0, 60));
          }}
        >
          <input
            autoFocus
            value={typed}
            maxLength={60}
            placeholder="It's actually a..."
            onChange={(e) => setTyped(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border-[2.5px] border-[var(--ink)] bg-white px-3 py-2.5 text-lg font-bold text-[var(--ink)] outline-none"
          />
          <button type="submit" disabled={!typed.trim()} className="rounded-xl border-[2.5px] border-[var(--ink)] bg-[var(--sun)] px-4 font-extrabold text-[var(--ink)] disabled:opacity-50 active:scale-95">
            Fix it
          </button>
        </form>
      )}
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
      confetti(0.6, 40);
      addXp(15);
      toast("Correct! +15 brain points");
    } else {
      sfx("buzz");
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
            <button key={i} onClick={() => answer(i)} className={`flex items-center gap-3 rounded-2xl border-[2.5px] border-[var(--ink)] px-3 py-2.5 text-left font-bold transition active:scale-[0.97] ${state}`}>
              <span className="font-display grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-[var(--ink)] bg-white text-[var(--ink)]">{"ABC"[i]}</span>
              <span>{o}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Sticky-note placing animation ----------
function PinFly({ title, color, target, onDone }: { title: string; color: number; target: React.RefObject<HTMLElement | null>; onDone: () => void }) {
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
        <div className="sticky" style={{ background: NOTE_COLORS[color], width: 230, height: 230, fontSize: Math.round((noteFontSize(title.length) * 230) / 170) }}>
          {title}
        </div>
      </div>
      <div ref={label} className="mt-5 text-xl font-extrabold">
        Saving to your board...
      </div>
    </div>
  );
}
