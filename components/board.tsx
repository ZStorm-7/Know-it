"use client";
import gsap from "gsap";
import { Check, Home as HomeIcon, Maximize, Minus, Pencil, Plus, Share2, Trash2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { sfx } from "@/lib/client/audio";
import { clearPendingNote, peekPendingNote } from "@/lib/client/nav";
import { shareNote } from "@/lib/client/share";
import {
  getNoteDetail,
  getState,
  Note,
  NoteDetail,
  patchNote,
  purgeNoteDetail,
  removeNote,
  restoreNote,
  update,
  useStore,
} from "@/lib/client/store";
import { useNav } from "./app";
import { Nimbus, NOTE_COLORS, NOTE_MAX_CHARS, noteFontSize, Pushpin } from "./art";
import { PhotoBox } from "./photo-box";
import { Btn, IconBtn, Sheet, toast } from "./ui";

const NOTE = 170;
// cork grain tiles and offsets (must match .cork in globals.css)
const TILES = [22, 34, 58];
const OFFS = [[0, 0], [10, 14], [26, 6]];
const MIN_Z = 0.35;
const MAX_Z = 2.6;
const LONG_PRESS = 380;

type View = { x: number; y: number; s: number };
type Ptr = { x: number; y: number };

export function Board() {
  const { go } = useNav();
  const notes = useStore((s) => s.notes);
  const hintDone = useStore((s) => s.boardHintDone);
  const root = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const trash = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ x: 0, y: 0, s: 1 });
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // What is on screen right now. Notes AND the cork texture follow it, so the whole board pans and zooms.
  const shown = useRef<View>({ x: 0, y: 0, s: 1 });
  const paint = () => {
    const v = shown.current;
    if (world.current) gsap.set(world.current, { x: v.x, y: v.y, scale: v.s });
    const el = root.current;
    if (el) {
      el.style.backgroundSize = TILES.map((t) => `${t * v.s}px ${t * v.s}px`).join(", ");
      el.style.backgroundPosition = OFFS.map(([ox, oy]) => `${v.x + ox * v.s}px ${v.y + oy * v.s}px`).join(", ");
    }
  };
  const apply = (animate = false) => {
    const v = view.current;
    gsap.killTweensOf(shown.current);
    if (animate) {
      gsap.to(shown.current, { x: v.x, y: v.y, s: v.s, duration: 0.5, ease: "power3.out", onUpdate: paint });
    } else {
      shown.current = { ...v };
      paint();
    }
  };

  const fit = useCallback((animate = true) => {
    const el = root.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const list = getState().notes;
    if (!list.length) {
      view.current = { x: w / 2 - NOTE / 2, y: h / 2 - NOTE / 2, s: 1 };
    } else {
      const minX = Math.min(...list.map((n) => n.x)) - 40;
      const minY = Math.min(...list.map((n) => n.y)) - 60;
      const maxX = Math.max(...list.map((n) => n.x)) + NOTE + 40;
      const maxY = Math.max(...list.map((n) => n.y)) + NOTE + 40;
      const s = Math.max(MIN_Z, Math.min(1.3, (w - 32) / (maxX - minX), (h - 200) / (maxY - minY)));
      view.current = { s, x: w / 2 - ((minX + maxX) / 2) * s, y: h / 2 + 10 - ((minY + maxY) / 2) * s };
    }
    apply(animate);
  // apply only touches refs, so the first-render closure is always correct
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    fit(false);
  }, [fit]);

  // arriving from Facts: open the note you just made after the pin lands
  useEffect(() => {
    const id = peekPendingNote();
    if (!id) return;
    const t = setTimeout(() => {
      setOpenId(id);
      clearPendingNote();
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  // pin-drop animation for newly added notes
  useEffect(() => {
    const fresh = getState().notes.filter((n) => n.fresh);
    if (!fresh.length) return;
    const tl = gsap.timeline({ delay: 0.9 });
    fresh.forEach((n, i) => {
      const el = world.current?.querySelector(`[data-note="${n.id}"]`);
      if (!el) return;
      const pin = el.querySelector("[data-pin]");
      tl.fromTo(el, { y: -80, scale: 1.4, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.6)" }, i * 0.35);
      tl.fromTo(pin, { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "bounce.out" }, i * 0.35 + 0.35);
      tl.call(() => {
        sfx("thunk");
      }, [], i * 0.35 + 0.45);
    });
    tl.call(() => fresh.forEach((n) => patchNote(n.id, { fresh: false })));
    return () => {
      tl.kill();
    };
  }, []);

  // ---------- gestures ----------
  const g = useRef({
    pointers: new Map<number, Ptr>(),
    mode: "none" as "none" | "pan" | "pinch" | "press" | "drag",
    start: { x: 0, y: 0 },
    startView: { x: 0, y: 0, s: 1 } as View,
    pinchDist: 1,
    pinchMid: { x: 0, y: 0 },
    noteId: "",
    noteStart: { x: 0, y: 0 },
    noteEl: null as HTMLElement | null,
    timer: 0,
    lastTap: { t: 0, x: 0, y: 0 },
    overTrash: false,
  });

  const local = (e: { clientX: number; clientY: number }) => {
    const r = root.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const startPan = (p: Ptr) => {
    const s = g.current;
    s.mode = "pan";
    s.start = p;
    s.startView = { ...view.current };
  };

  const startPinch = () => {
    const s = g.current;
    const [a, b] = [...s.pointers.values()];
    s.mode = "pinch";
    s.pinchDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    s.pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    s.startView = { ...view.current };
  };

  const zoomAt = (mid: Ptr, scale: number, from: View) => {
    const s = Math.max(MIN_Z, Math.min(MAX_Z, scale));
    const wx = (mid.x - from.x) / from.s;
    const wy = (mid.y - from.y) / from.s;
    return { s, x: mid.x - wx * s, y: mid.y - wy * s };
  };

  const onDown = (e: React.PointerEvent) => {
    const s = g.current;
    root.current!.setPointerCapture(e.pointerId);
    const p = local(e);
    s.pointers.set(e.pointerId, p);
    if (s.pointers.size === 2) {
      clearTimeout(s.timer);
      if (s.mode === "drag") return; // keep dragging with first finger
      startPinch();
      return;
    }
    if (s.pointers.size > 2) return;
    const noteEl = (e.target as HTMLElement).closest<HTMLElement>("[data-note]");
    if (noteEl) {
      const id = noteEl.dataset.note!;
      const n = getState().notes.find((x) => x.id === id);
      if (!n) return;
      s.mode = "press";
      s.start = p;
      s.noteId = id;
      s.noteEl = noteEl;
      s.noteStart = { x: n.x, y: n.y };
      gsap.to(noteEl, { scale: 0.96, duration: 0.15 });
      s.timer = window.setTimeout(() => {
        if (s.mode !== "press") return;
        s.mode = "drag";
        setDragging(true);
        sfx("lift");
        noteEl.style.zIndex = "50";
        gsap.to(noteEl, { scale: 1.12, rotation: n.rot + 6, filter: "drop-shadow(0 18px 18px rgba(0,0,0,0.35))", duration: 0.25, ease: "back.out(2)" });
      }, LONG_PRESS);
    } else {
      startPan(p);
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s.pointers.has(e.pointerId)) return;
    const p = local(e);
    s.pointers.set(e.pointerId, p);

    if (s.mode === "pinch" && s.pointers.size >= 2) {
      const [a, b] = [...s.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const z = zoomAt(s.pinchMid, s.startView.s * (dist / s.pinchDist), s.startView);
      view.current = { s: z.s, x: z.x + (mid.x - s.pinchMid.x), y: z.y + (mid.y - s.pinchMid.y) };
      apply();
    } else if (s.mode === "pan") {
      view.current = { ...s.startView, x: s.startView.x + p.x - s.start.x, y: s.startView.y + p.y - s.start.y };
      apply();
    } else if (s.mode === "press") {
      if (Math.hypot(p.x - s.start.x, p.y - s.start.y) > 8) {
        clearTimeout(s.timer);
        if (s.noteEl) gsap.to(s.noteEl, { scale: 1, duration: 0.2 });
        startPan(p);
      }
    } else if (s.mode === "drag" && s.noteEl) {
      const v = view.current;
      const nx = s.noteStart.x + (p.x - s.start.x) / v.s;
      const ny = s.noteStart.y + (p.y - s.start.y) / v.s;
      s.noteEl.style.left = `${nx}px`;
      s.noteEl.style.top = `${ny}px`;
      const t = trash.current?.getBoundingClientRect();
      const over = !!t && e.clientY > t.top - 20 && e.clientX > t.left - 30 && e.clientX < t.right + 30;
      if (over !== s.overTrash) {
        s.overTrash = over;
        if (trash.current) gsap.to(trash.current, { scale: over ? 1.25 : 1, duration: 0.2, ease: "back.out(2)" });
        
      }
    }
  };

  const onUp = (e: React.PointerEvent) => {
    const s = g.current;
    s.pointers.delete(e.pointerId);
    clearTimeout(s.timer);
    const p = local(e);

    if (s.mode === "press" && s.noteEl) {
      gsap.to(s.noteEl, { scale: 1, duration: 0.4, ease: "elastic.out(1,0.4)" });
      sfx("pop", 1.1);
      setOpenId(s.noteId);
      s.mode = "none";
    } else if (s.mode === "drag" && s.noteEl) {
      const el = s.noteEl;
      const id = s.noteId;
      const n = getState().notes.find((x) => x.id === id);
      setDragging(false);
      if (s.overTrash) {
        gsap.to(el, {
          scale: 0,
          rotation: 90,
          opacity: 0,
          duration: 0.3,
          ease: "power2.in",
          onComplete: () => unpin(id),
        });
      } else if (n) {
        const nx = parseFloat(el.style.left);
        const ny = parseFloat(el.style.top);
        el.style.zIndex = "";
        gsap.to(el, { scale: 1, rotation: n.rot, filter: "none", duration: 0.45, ease: "elastic.out(1,0.5)" });
        sfx("thunk");
        patchNote(id, { x: nx, y: ny });
      }
      s.overTrash = false;
      if (trash.current) gsap.to(trash.current, { scale: 1, duration: 0.2 });
      s.mode = "none";
    } else if (s.mode === "pan" && s.pointers.size === 0) {
      // double-click on empty cork toggles zoom
      const moved = Math.hypot(p.x - s.start.x, p.y - s.start.y);
      if (moved < 6) {
        const now = e.timeStamp;
        const lt = s.lastTap;
        if (now - lt.t < 300 && Math.hypot(p.x - lt.x, p.y - lt.y) < 30) {
          if (view.current.s < 1.4) {
            view.current = zoomAt(p, 1.8, view.current);
            apply(true);
          } else fit(true);
          sfx("boing");
          s.lastTap = { t: 0, x: 0, y: 0 };
        } else s.lastTap = { t: now, x: p.x, y: p.y };
      }
      s.mode = "none";
    } else if (s.mode === "pinch") {
      if (s.pointers.size === 1) startPan([...s.pointers.values()][0]);
      else if (s.pointers.size === 0) s.mode = "none";
    }
  };

  const unpin = (id: string) => {
    const note = removeNote(id);
    setOpenId(null);
    sfx("whoosh");
    if (!note) return;
    toast("Note unpinned", {
      label: "Undo",
      fn: () => {
        restoreNote(note);
        sfx("thunk");
      },
    });
    setTimeout(() => {
      if (!getState().notes.some((n) => n.id === id)) purgeNoteDetail(id);
    }, 6500);
  };

  const zoomBtn = (factor: number) => {
    const el = root.current!;
    view.current = zoomAt({ x: el.clientWidth / 2, y: el.clientHeight / 2 }, view.current.s * factor, view.current);
    apply(true);
  };

  return (
    <div className="bleed absolute inset-0 flex flex-col">
      {/* toolbar */}
      <div className="relative z-20 flex items-center gap-3 px-4 pb-3 pt-4" style={{ background: "linear-gradient(180deg, rgba(15,23,42,0.35), transparent)" }}>
        <IconBtn label="Main menu" onClick={() => go("home")}>
          <HomeIcon size={22} strokeWidth={2.6} />
        </IconBtn>
        <h2 className="font-display min-w-0 flex-1 text-center text-[clamp(1.15rem,6.2vw,1.7rem)] leading-none whitespace-nowrap" style={{ textShadow: "0 3px 0 #8b5cf6" }}>
          Bulletin Board
        </h2>
        <IconBtn label="Fit all notes" onClick={() => fit(true)}>
          <Maximize size={20} strokeWidth={2.8} />
        </IconBtn>
      </div>

      {/* board */}
      <div
        ref={root}
        className="cork absolute inset-0 overflow-hidden"
        style={{ touchAction: "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={(e) => {
          view.current = zoomAt(local(e), view.current.s * (e.deltaY > 0 ? 0.9 : 1.1), view.current);
          apply();
        }}
      >
        <div ref={world} className="absolute left-0 top-0 origin-top-left" style={{ width: 1, height: 1 }}>
          {notes.map((n) => (
            <StickyNote key={n.id} note={n} />
          ))}
        </div>
      </div>

      {notes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <Nimbus size={170} mood="think" className="bob" />
          <div className="card pointer-events-auto max-w-xs p-5">
            <p className="text-lg font-bold">Your board is empty!</p>
            <p className="mt-1 text-[var(--ink-soft)]">Snap an object in Facts and its sticky note will land here.</p>
            <Btn variant="sun" className="mt-4 h-[50px] text-lg" onClick={() => go("facts")}>
              Go to Facts
            </Btn>
          </div>
        </div>
      )}

      {/* zoom buttons */}
      <div className="absolute right-4 z-20 flex flex-col gap-2" style={{ bottom: "max(24px, env(safe-area-inset-bottom))" }}>
        <IconBtn label="Zoom in" onClick={() => zoomBtn(1.25)}>
          <Plus size={22} strokeWidth={3} />
        </IconBtn>
        <IconBtn label="Zoom out" onClick={() => zoomBtn(0.8)}>
          <Minus size={22} strokeWidth={3} />
        </IconBtn>
      </div>

      {/* trash zone */}
      <div
        className="pointer-events-none absolute inset-x-0 z-20 flex justify-center transition-all duration-300"
        style={{ bottom: dragging ? "max(28px, env(safe-area-inset-bottom))" : -120, opacity: dragging ? 1 : 0 }}
      >
        <div ref={trash} className="flex items-center gap-2 rounded-full border-[3px] border-[var(--ink)] bg-rose-500 px-6 py-3 font-extrabold shadow-xl">
          <Trash2 size={22} strokeWidth={2.8} /> Drop here to unpin
        </div>
      </div>

      {!hintDone && notes.length > 0 && (
        <div className="absolute inset-x-4 z-30 mx-auto max-w-sm" style={{ top: "calc(env(safe-area-inset-top) + 84px)" }}>
          <div className="card flex items-center gap-3 p-3.5">
            <p className="flex-1 text-sm font-bold leading-snug">Click a note to open it. Drag to move it. Scroll to zoom.</p>
            <button
              className="rounded-xl bg-[var(--sun)] px-3 py-2 font-extrabold text-[var(--ink)]"
              onClick={() => update((s) => ({ ...s, boardHintDone: true }))}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <NoteSheet id={openId} onClose={() => setOpenId(null)} onUnpin={unpin} />
    </div>
  );
}

function StickyNote({ note }: { note: Note }) {
  const fontSize = noteFontSize(note.title.length);
  return (
    <div
      data-note={note.id}
      className="absolute"
      style={{ left: note.x, top: note.y, transform: `rotate(${note.rot}deg)`, opacity: note.fresh ? 0 : 1 }}
    >
      <div data-pin className="absolute left-1/2 top-[-16px] z-10 -translate-x-1/2">
        <Pushpin size={30} />
      </div>
      <div className="sticky" style={{ background: NOTE_COLORS[note.color % NOTE_COLORS.length], width: NOTE, height: NOTE, fontSize, lineHeight: 1.02 }}>
        {note.title}
      </div>
    </div>
  );
}

function NoteSheet({ id, onClose, onUnpin }: { id: string | null; onClose: () => void; onUnpin: (id: string) => void }) {
  const note = useStore((s) => s.notes.find((n) => n.id === id));
  const [loaded, setLoaded] = useState<{ id: string; detail: NoteDetail | null } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const shown = note ?? null;
  const detail = loaded && loaded.id === id ? loaded.detail : null;
  const editing = !!id && editingId === id;

  useEffect(() => {
    if (!id) return;
    let alive = true;
    getNoteDetail(id).then((d) => alive && setLoaded({ id, detail: d ?? null }));
    return () => {
      alive = false;
    };
  }, [id]);

  const startEdit = () => {
    if (!note) return;
    setName(note.title);
    setEditingId(note.id);
  };

  const save = () => {
    const t = name.trim().slice(0, 40);
    if (t && note) {
      patchNote(note.id, { title: t });
      sfx("pop", 1.2);
    }
    setEditingId(null);
  };

  return (
    <Sheet open={!!id && !!shown} onClose={onClose} tall>
      {shown && (
        <div className="px-5 pb-6 pt-3">
          {detail?.photo ? (
            <PhotoBox src={detail.photo} maxHeight="34dvh" outlines={detail.box ? [{ box: detail.box, label: detail.object }] : []} />
          ) : (
            <div className="mx-auto grid h-40 place-items-center text-[var(--ink-soft)]">Loading photo...</div>
          )}

          <div className="mt-4 flex items-center gap-2">
            {editing ? (
              <>
                <input
                  autoFocus
                  value={name}
                  maxLength={NOTE_MAX_CHARS}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                  className="font-hand min-w-0 flex-1 rounded-xl border-[2.5px] border-[var(--ink)] bg-white px-3 py-1 text-[2rem] font-bold text-[var(--ink)] outline-none"
                />
                <button aria-label="Save name" className="icon-btn" onClick={save}>
                  <Check size={22} strokeWidth={3} />
                </button>
              </>
            ) : (
              <>
                <button className="font-hand min-w-0 flex-1 text-left text-[2.3rem] leading-none font-bold" onClick={startEdit}>
                  {shown.title}
                </button>
                <button aria-label="Rename" className="icon-btn" onClick={startEdit}>
                  <Pencil size={20} strokeWidth={2.6} />
                </button>
              </>
            )}
          </div>
          {editing && (
            <div className="mt-1 text-right text-xs font-bold text-[var(--ink-soft)]">
              {name.length}/{NOTE_MAX_CHARS} characters
            </div>
          )}
          {shown.suggested && shown.title !== shown.suggested && (
            <button
              className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border-2 border-[var(--ink)] bg-[var(--sun)] px-3 py-1 text-sm font-extrabold text-[var(--ink)] active:scale-95"
              onClick={() => {
                patchNote(shown.id, { title: shown.suggested });
                setEditingId(null);
                sfx("pop", 1.2);
                toast("Back to the suggested name");
              }}
            >
              <Undo2 size={15} strokeWidth={3} />
              <span className="truncate">Revert to suggested: {shown.suggested}</span>
            </button>
          )}
          <div className="mt-1 text-sm font-bold capitalize text-[var(--ink-soft)]">{shown.object}</div>

          <ol className="mt-4 flex flex-col gap-2.5">
            {(detail?.facts ?? []).map((f, i) => (
              <li key={i} className="flex gap-3 rounded-2xl border-[2.5px] border-[var(--ink)] p-3">
                <span
                  className="font-display grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-[var(--ink)] text-[var(--ink)]"
                  style={{ background: NOTE_COLORS[i % NOTE_COLORS.length] }}
                >
                  {i + 1}
                </span>
                <p className="font-semibold leading-snug">{f}</p>
              </li>
            ))}
          </ol>

          {detail && (
            <p className="mt-4 text-center text-[0.72rem] text-[var(--ink-soft)]">
              AI confidence: about {detail.confidence}% · This is AI, and some facts may be incorrect.
            </p>
          )}

          <div className="mt-4 flex gap-3">
            <Btn variant="white" className="h-[50px]" onClick={() => note && onUnpin(note.id)}>
              <Trash2 size={18} strokeWidth={2.8} /> Unpin
            </Btn>
            <Btn
              variant="sun"
              className="h-[50px]"
              disabled={!detail}
              onClick={async () => {
                if (!note || !detail) return;
                try {
                  const r = await shareNote(note, detail);
                  if (r === "downloaded") toast("Share card saved to your downloads");
                } catch {
                  toast("Couldn't make the share card");
                }
              }}
            >
              <Share2 size={18} strokeWidth={2.8} /> Share
            </Btn>
            <Btn variant="mint" className="h-[50px]" onClick={onClose}>
              Done
            </Btn>
          </div>
        </div>
      )}
    </Sheet>
  );
}
