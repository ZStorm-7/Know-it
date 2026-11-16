"use client";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { sfx } from "@/lib/client/audio";
import { chooseGuest, setProfile, useStore } from "@/lib/client/store";
import { useNav } from "./app";
import { CloudLoader, Nimbus, RankBadge } from "./art";
import { PasswordField, passwordProblem } from "./password";
import { Btn, confetti, toast } from "./ui";

const PATTERN = /^[A-Za-z0-9_.-]{3,16}$/;

export function UsernameScreen() {
  const { go } = useNav();
  const profile = useStore((s) => s.profile);
  const root = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    gsap.fromTo(root.current!.querySelectorAll("[data-in]"), { y: 40, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 0.65, stagger: 0.08, ease: "back.out(1.7)" });
  }, []);

  // once an account exists (made or signed in), go to Home
  useEffect(() => {
    if (profile) go("home");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const create = mode === "create";
  const nameOk = PATTERN.test(name);
  const pwProblem = create ? passwordProblem(password, name) : password ? null : "x";
  const mismatch = create && confirm.length > 0 && confirm !== password;
  const ready = nameOk && !pwProblem && (!create || (confirm === password && confirm.length > 0));
  const nameHint = !name ? "3 to 16 letters or numbers" : name.length < 3 ? "A little longer, 3 letters or more" : nameOk ? "Looks good!" : "Only letters, numbers, dot, dash and underscore";

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = create ? await api.register(name, password) : await api.login(name, password);
      setProfile({ name: r.name, token: r.token, hasPassword: true });
      sfx("chime");
      confetti(0.4, 70);
      toast(create ? `Welcome, ${r.name}!` : `Welcome back, ${r.name}!`);
      go("home");
    } catch (e) {
      sfx("buzz");
      setError(e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong. Please try again.");
      gsap.fromTo(root.current!.querySelector("form"), { x: -8 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.3)" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={root} className="no-scrollbar flex h-full flex-col items-center overflow-y-auto px-5" style={{ paddingTop: "max(16px, 2.5dvh)", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
      <div data-in>
        <Nimbus size={110} mood="happy" className="bob" />
      </div>
      <h2 data-in className="font-display mt-1 text-center text-[clamp(1.8rem,8vw,2.5rem)] leading-tight" style={{ textShadow: "0 3px 0 #8b5cf6" }}>
        {create ? "Create your account" : "Welcome back"}
      </h2>
      <p data-in className="mt-1 max-w-sm text-center text-sm font-bold opacity-95">
        {create ? "Your username shows on the Hunt leaderboard. Nimbus checks every name to keep it friendly and one of a kind." : "Sign in to get your leaderboard spot back."}
      </p>

      <form
        data-in
        className="card mt-4 w-full max-w-sm p-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="uname" className="text-sm font-extrabold">
          Username
        </label>
        <input
          id="uname"
          value={name}
          maxLength={16}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          spellCheck={false}
          placeholder="CloudHunter7"
          onChange={(e) => {
            setName(e.target.value.replace(/\s/g, ""));
            setError(null);
          }}
          className="mt-1 w-full rounded-xl border-[3px] border-[var(--ink)] bg-white px-3 py-3 text-xl font-extrabold text-[var(--ink)] outline-none focus:border-[var(--violet)]"
        />
        {create && (
          <div className={`mt-1.5 flex justify-between text-xs font-bold ${nameOk ? "text-[var(--mint-dark)]" : "text-[var(--ink-soft)]"}`}>
            <span>{nameHint}</span>
            <span>{name.length}/16</span>
          </div>
        )}

        <PasswordField
          id="pw"
          label="Password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          onEnter={submit}
          autoComplete={create ? "new-password" : "current-password"}
          placeholder={create ? "At least 8 characters" : "Your password"}
          meter={create}
        />
        {create && password && pwProblem && <p className="mt-1 text-xs font-bold text-[var(--bad)]">{pwProblem}</p>}
        {create && (
          <>
            <PasswordField id="pw2" label="Type it again" value={confirm} onChange={setConfirm} onEnter={submit} autoComplete="new-password" placeholder="Same password" />
            {mismatch && <p className="mt-1 text-xs font-bold text-[var(--bad)]">The passwords don&apos;t match yet.</p>}
          </>
        )}

        {error && (
          <div role="alert" className="mt-3 rounded-xl border-[2.5px] border-[var(--ink)] bg-orange-100 px-3 py-2 text-sm font-bold text-[var(--ink)]">
            {error}
          </div>
        )}

        <div className="mt-4">
          <Btn variant="green" className="h-[58px] text-lg" disabled={!ready || busy} onClick={submit}>
            {busy ? (
              <>
                <span className="scale-[0.28]">
                  <CloudLoader size={110} />
                </span>
                <span className="-ml-10">{create ? "Nimbus is checking..." : "Signing in..."}</span>
              </>
            ) : create ? (
              "Create account"
            ) : (
              "Sign in"
            )}
          </Btn>
        </div>

        {!create && (
          <div className="mt-3 text-center">
            <button type="button" className="text-sm font-extrabold underline" onClick={() => setForgot((f) => !f)}>
              Forgot password?
            </button>
            {forgot && (
              <div className="mt-2 rounded-xl bg-slate-100 p-3 text-left text-sm font-bold text-[var(--ink)]">
                <p>
                  Know it doesn&apos;t collect emails, so we can&apos;t send a reset link. If you can&apos;t remember your password, you can make a new account with a different username.
                </p>
              </div>
            )}
          </div>
        )}
      </form>

      <div data-in className="mt-4 flex items-center gap-2 text-sm font-bold opacity-95">
        <RankBadge rank={1} size={28} /> <RankBadge rank={2} size={28} /> <RankBadge rank={3} size={28} />
        <span>Top Hunters get medals</span>
      </div>

      <div data-in className="mt-4 flex w-full max-w-sm flex-col gap-3">
        <Btn
          variant="white"
          className="h-[50px] text-lg"
          onClick={() => {
            setMode(create ? "signin" : "create");
            setError(null);
            setForgot(false);
            setConfirm("");
          }}
        >
          {create ? "I already have an account" : "Make a new account instead"}
        </Btn>
        <Btn
          variant="white"
          className="h-[50px] text-lg"
          onClick={() => {
            chooseGuest();
            go("home");
          }}
        >
          Skip for now (play as guest)
        </Btn>
      </div>
    </div>
  );
}
