"use client";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { sfx } from "@/lib/client/audio";
import { chooseGuest, setProfile } from "@/lib/client/store";
import { useNav } from "./app";
import { CloudLoader, Nimbus, RankBadge } from "./art";
import { Btn, confetti, toast } from "./ui";

const PATTERN = /^[A-Za-z0-9_.-]{3,16}$/;

export function UsernameScreen() {
  const { go } = useNav();
  const root = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"new" | "signin">("new");
  const [code, setCode] = useState("");

  useEffect(() => {
    gsap.fromTo(root.current!.querySelectorAll("[data-in]"), { y: 40, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 0.65, stagger: 0.1, ease: "back.out(1.7)" });
  }, []);

  const valid = PATTERN.test(name);
  const hint =
    name.length === 0 ? "3 to 16 letters or numbers" : name.length < 3 ? "A little longer, 3 letters or more" : valid ? "Looks good! Nimbus will check it." : "Only letters, numbers, dot, dash and underscore";

  const submit = async () => {
    if (!valid || busy) return;
    if (mode === "signin" && code.trim().length < 20) {
      setError("Paste your full recovery code from the other phone (Settings, Account).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") {
        const r = await api.login(name, code.trim());
        setProfile({ name: r.name, token: r.token });
        sfx("chime");
        confetti(0.4, 70);
        toast(`Welcome back, ${r.name}!${r.rank ? ` You are #${r.rank} on the leaderboard.` : ""}`);
        go("home");
        return;
      }
      const r = await api.register(name);
      setProfile({ name: r.name, token: r.token });
      sfx("chime");
      confetti(0.4, 70);
      toast(`Welcome, ${r.name}!`);
      go("home");
    } catch (e) {
      sfx("buzz");
      setError(e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong. Please try again.");
      gsap.fromTo(root.current!.querySelector("input"), { x: -8 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.3)" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={root} className="no-scrollbar flex h-full flex-col items-center overflow-y-auto px-5" style={{ paddingTop: "max(20px, 3dvh)", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
      <div data-in>
        <Nimbus size={120} mood="happy" className="bob" />
      </div>
      <h2 data-in className="font-display mt-1 text-center text-[clamp(1.8rem,8vw,2.6rem)] leading-tight" style={{ textShadow: "0 3px 0 #8b5cf6" }}>
        {mode === "new" ? "Pick a username" : "Welcome back"}
      </h2>
      <p data-in className="mt-1 max-w-sm text-center text-sm font-bold opacity-95">
        {mode === "new"
          ? "It shows on the Hunt leaderboard. Nimbus checks every name to keep it friendly and one of a kind."
          : "Enter your username and the recovery code from Settings, Account on your other phone."}
      </p>

      <div data-in className="card mt-4 w-full max-w-sm p-4">
        <label htmlFor="uname" className="text-sm font-extrabold">
          Username
        </label>
        <input
          id="uname"
          value={name}
          maxLength={16}
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          placeholder="CloudHunter7"
          onChange={(e) => {
            setName(e.target.value.replace(/\s/g, ""));
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="mt-1 w-full rounded-xl border-[3px] border-[var(--ink)] bg-white px-3 py-3 text-xl font-extrabold text-[var(--ink)] outline-none focus:border-[var(--violet)]"
        />
        <div className={`mt-1.5 flex justify-between text-xs font-bold ${valid ? "text-[var(--mint-dark)]" : "text-[var(--ink-soft)]"}`}>
          <span>{mode === "signin" && valid ? "Now your recovery code" : hint}</span>
          <span>{name.length}/16</span>
        </div>
        {mode === "signin" && (
          <>
            <label htmlFor="rcode" className="mt-3 block text-sm font-extrabold">
              Recovery code
            </label>
            <input
              id="rcode"
              value={code}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              placeholder="paste it here"
              onChange={(e) => {
                setCode(e.target.value.replace(/\s/g, ""));
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="mt-1 w-full rounded-xl border-[3px] border-[var(--ink)] bg-white px-3 py-3 text-base font-bold text-[var(--ink)] outline-none focus:border-[var(--violet)]"
            />
          </>
        )}
        {error && (
          <div role="alert" className="mt-3 rounded-xl border-[2.5px] border-[var(--ink)] bg-orange-100 px-3 py-2 text-sm font-bold text-[var(--ink)]">
            {error}
          </div>
        )}
        <div className="mt-4">
          <Btn variant="mint" className="h-16 text-xl" disabled={!valid || busy} onClick={submit}>
            {busy ? (
              <>
                <span className="scale-[0.28]"><CloudLoader size={110} /></span>
                <span className="-ml-10">Nimbus is checking...</span>
              </>
            ) : (
              mode === "new" ? "Check my name" : "Sign in"
            )}
          </Btn>
        </div>
      </div>

      <div data-in className="mt-4 flex items-center gap-2 text-sm font-bold opacity-95">
        <RankBadge rank={1} size={30} /> <RankBadge rank={2} size={30} /> <RankBadge rank={3} size={30} />
        <span>Top Hunters get medals</span>
      </div>

      <button
        data-in
        className="mt-4 text-sm font-extrabold underline"
        onClick={() => {
          setMode(mode === "new" ? "signin" : "new");
          setError(null);
        }}
      >
        {mode === "new" ? "I already have an account" : "Make a new account instead"}
      </button>
      <button
        data-in
        className="mt-3 text-sm font-bold underline opacity-90"
        onClick={() => {
          chooseGuest();
          go("home");
        }}
      >
        Skip for now (play as guest)
      </button>
    </div>
  );
}
