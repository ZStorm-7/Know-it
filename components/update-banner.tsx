"use client";
import { useEffect, useState } from "react";

/** Shows "A new version is ready" when a newer build is deployed, so nobody is stuck on an old copy. */
export function UpdateBanner() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const mine = process.env.NEXT_PUBLIC_BUILD_ID;
    let alive = true;
    const check = async () => {
      try {
        const r = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
        const d = (await r.json()) as { build?: string };
        if (alive && d.build && mine && d.build !== mine) setStale(true);
      } catch {}
    };
    check();
    const onVis = () => !document.hidden && check();
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(check, 5 * 60_000);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(t);
    };
  }, []);

  if (!stale) return null;

  const refresh = async () => {
    try {
      const regs = await navigator.serviceWorker?.getRegistrations();
      await Promise.all((regs ?? []).map((r) => r.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {}
    location.reload();
  };

  return (
    <div role="status" className="card fixed inset-x-4 z-[110] mx-auto flex max-w-sm items-center gap-3 p-3" style={{ top: "calc(env(safe-area-inset-top) + 10px)" }}>
      <p className="flex-1 text-sm font-extrabold">A new version of Know it is ready.</p>
      <button className="min-h-[44px] rounded-xl border-[2.5px] border-[var(--ink)] bg-[var(--sun)] px-4 font-extrabold text-[var(--ink)] active:scale-95" onClick={refresh}>
        Refresh
      </button>
    </div>
  );
}
