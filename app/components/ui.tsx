"use client";
import gsap from "gsap";
import { ReactNode, useEffect, useRef, useState } from "react";
import { haptic, sfx } from "@/lib/client/audio";

// ---------- Squishy button ----------
export function Btn({
  children,
  onClick,
  variant = "",
  className = "",
  style,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "" | "sun" | "mint" | "violet" | "white";
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  return (
    <button
      className={`btn3d ${variant} ${className}`}
      style={style}
      disabled={disabled}
      onClick={(e) => {
        sfx("tap");
        haptic(10);
        const el = e.currentTarget;
        gsap.fromTo(el, { scale: 0.94 }, { scale: 1, duration: 0.5, ease: "elastic.out(1.2,0.4)" });
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

export function IconBtn({ children, onClick, label, className = "" }: { children: ReactNode; onClick?: () => void; label: string; className?: string }) {
  return (
    <button
      aria-label={label}
      className={`icon-btn ${className}`}
      onClick={() => {
        sfx("tap");
        haptic(8);
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

// ---------- Bottom sheet ----------
export function Sheet({ open, onClose, children, tall }: { open: boolean; onClose: () => void; children: ReactNode; tall?: boolean }) {
  const [mounted, setMounted] = useState(open);
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);

  if (open && !mounted) setMounted(true); // mount before animating in

  useEffect(() => {
    if (!mounted || !panel.current) return;
    if (open) {
      gsap.fromTo(panel.current, { yPercent: 100 }, { yPercent: 0, duration: 0.5, ease: "back.out(1.2)" });
      gsap.fromTo(backdrop.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    } else {
      gsap.to(backdrop.current, { opacity: 0, duration: 0.25 });
      gsap.to(panel.current, { yPercent: 100, duration: 0.3, ease: "power2.in", onComplete: () => setMounted(false) });
    }
  }, [open, mounted]);

  if (!mounted) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div ref={backdrop} className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div
        ref={panel}
        className="card absolute bottom-0 left-0 right-0 flex flex-col rounded-b-none border-b-0"
        style={{ maxHeight: tall ? "92dvh" : "85dvh", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-slate-300" />
        <div className="no-scrollbar overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ---------- Toasts ----------
type ToastItem = { id: number; text: string; action?: { label: string; fn: () => void } };
let pushToast: ((t: Omit<ToastItem, "id">) => void) | null = null;
export function toast(text: string, action?: ToastItem["action"]) {
  pushToast?.({ text, action });
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    pushToast = (t) => {
      const id = Date.now() + Math.random();
      setItems((s) => [...s.slice(-2), { ...t, id }]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), t.action ? 5000 : 2600);
    };
    return () => {
      pushToast = null;
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[90] flex flex-col items-center gap-2 px-4" style={{ bottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
      {items.map((t) => (
        <ToastView key={t.id} item={t} onDone={() => setItems((s) => s.filter((x) => x.id !== t.id))} />
      ))}
    </div>
  );
}

function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    gsap.fromTo(ref.current, { y: 40, opacity: 0, scale: 0.8 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2)" });
  }, []);
  return (
    <div ref={ref} className="card pointer-events-auto flex items-center gap-3 px-4 py-2.5 text-sm font-bold">
      <span>{item.text}</span>
      {item.action && (
        <button
          className="rounded-xl bg-[var(--sun)] px-3 py-1 text-[var(--ink)]"
          onClick={() => {
            item.action!.fn();
            onDone();
          }}
        >
          {item.action.label}
        </button>
      )}
    </div>
  );
}

// ---------- Confetti ----------
const CONFETTI_COLORS = ["#ff6fae", "#ffd23f", "#34d399", "#38bdf8", "#8b5cf6", "#fff"];
export function confetti(originY = 0.4, count = 60) {
  const layer = document.createElement("div");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:95;overflow:hidden";
  document.body.appendChild(layer);
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("i");
    const size = 6 + Math.random() * 8;
    p.style.cssText = `position:absolute;left:${w / 2}px;top:${h * originY}px;width:${size}px;height:${size * (Math.random() > 0.5 ? 1 : 0.45)}px;background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};border-radius:${Math.random() > 0.6 ? "50%" : "2px"}`;
    layer.appendChild(p);
    const angle = Math.random() * Math.PI * 2;
    const power = 120 + Math.random() * 260;
    gsap.to(p, {
      x: Math.cos(angle) * power,
      y: Math.sin(angle) * power - 120,
      rotation: Math.random() * 720 - 360,
      duration: 0.7,
      ease: "power3.out",
    });
    gsap.to(p, { y: `+=${h * 0.6}`, opacity: 0, delay: 0.6, duration: 1.4, ease: "power1.in" });
  }
  setTimeout(() => layer.remove(), 2400);
}

// ---------- Count up ----------
export function CountUp({ to, prefix = "" }: { to: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obj = { v: 0 };
    const tw = gsap.to(obj, {
      v: to,
      duration: 1.1,
      ease: "power2.out",
      onUpdate: () => {
        if (ref.current) ref.current.textContent = `${prefix}${Math.round(obj.v)}`;
      },
    });
    return () => {
      tw.kill();
    };
  }, [to, prefix]);
  return <span ref={ref}>{prefix}0</span>;
}
