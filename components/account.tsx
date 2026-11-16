"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { sfx } from "@/lib/client/audio";
import { signInWithGoogle, signOutCloud, syncNow, useCloud } from "@/lib/client/cloud";
import { setProfile, signOut, useStore } from "@/lib/client/store";
import { useNav } from "./app";
import { RankBadge } from "./art";
import { PasswordField, passwordProblem } from "./password";
import { Btn, toast } from "./ui";

type Panel = null | "password" | "delete";

/** Account area for Settings: who you are, your rank, change password, sign out and delete. */
export function AccountSection({ onClose }: { onClose: () => void }) {
  const { go } = useNav();
  const profile = useStore((s) => s.profile);
  const best = useStore((s) => s.huntBest);
  const notes = useStore((s) => s.notes.length);
  const [rank, setRank] = useState<number | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [delPw, setDelPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    let alive = true;
    api
      .leaderboard(profile.name, 1)
      .then((d) => alive && setRank(d.me?.rank ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [profile]);

  if (!profile) {
    return (
      <div className="rounded-2xl border-[2.5px] border-[var(--ink)] p-4">
        <div className="font-extrabold">Guest</div>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Create an account to join the Hunt leaderboard, or sign in if you already have one.</p>
        <div className="mt-3">
          <Btn
            variant="sun"
            className="h-[50px]"
            onClick={() => {
              onClose();
              go("username");
            }}
          >
            Create account or sign in
          </Btn>
        </div>
      </div>
    );
  }

  const hasPassword = profile.hasPassword === true;
  const reset = () => {
    setPanel(null);
    setOldPw("");
    setNewPw("");
    setNewPw2("");
    setDelPw("");
    setError(null);
  };

  const savePassword = async () => {
    const problem = passwordProblem(newPw, profile.name);
    if (problem) return setError(problem);
    if (newPw !== newPw2) return setError("The new passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      const r = await api.changePassword(profile.name, profile.token, oldPw, newPw);
      setProfile({ name: profile.name, token: r.token, hasPassword: true });
      sfx("chime");
      toast(hasPassword ? "Password changed. Other devices were signed out." : "Password added. Your account is protected.");
      reset();
    } catch (e) {
      sfx("buzz");
      setError(e instanceof Error ? e.message : "Couldn't change the password.");
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(profile.name, profile.token, delPw);
      setProfile(null);
      toast("Account deleted. Your username is free again.");
      reset();
    } catch (e) {
      sfx("buzz");
      setError(e instanceof Error ? e.message : "Couldn't delete the account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border-[2.5px] border-[var(--ink)] p-4">
      <div className="flex items-center gap-3">
        {rank ? <RankBadge rank={rank} size={44} /> : null}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-extrabold">{profile.name}</div>
          <div className="text-sm font-bold text-[var(--ink-soft)]">
            {rank ? `Rank #${rank} · ` : ""}Best Hunt: {best} · {notes} {notes === 1 ? "note" : "notes"}
          </div>
        </div>
      </div>

      {!hasPassword && panel !== "password" && (
        <div className="mt-3 rounded-xl border-2 border-[var(--ink)] bg-orange-100 p-3 text-sm font-bold text-[var(--ink)]">
          This account has no password yet. Add one so only you can sign in as {profile.name}.
        </div>
      )}

      {panel === null && (
        <div className="mt-3 flex flex-col gap-2.5">
          <Btn variant="white" className="h-[50px]" onClick={() => setPanel("password")}>
            {hasPassword ? "Change password" : "Add a password"}
          </Btn>
          <div className="flex gap-3">
            <Btn
              variant="white"
              className="h-[50px]"
              onClick={() => {
                api.logout(profile.name, profile.token);
                signOut();
                sfx("whoosh");
                toast("Signed out. Your notes stay on this computer.");
              }}
            >
              Sign out
            </Btn>
            <Btn variant="white" className="h-[50px]" onClick={() => setPanel("delete")}>
              Delete account
            </Btn>
          </div>
        </div>
      )}

      {panel === "password" && (
        <form
          className="mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            savePassword();
          }}
        >
          {/* browsers use this hidden field to offer to save the password for the right account */}
          <input type="text" name="username" autoComplete="username" value={profile.name} readOnly hidden />
          {hasPassword && <PasswordField label="Current password" value={oldPw} onChange={setOldPw} autoComplete="current-password" placeholder="Your current password" />}
          <PasswordField label="New password" value={newPw} onChange={setNewPw} autoComplete="new-password" meter />
          <PasswordField label="Type the new one again" value={newPw2} onChange={setNewPw2} onEnter={savePassword} autoComplete="new-password" placeholder="Same password" />
          {hasPassword && <p className="mt-2 text-xs text-[var(--ink-soft)]">Changing your password signs you out on your other phones.</p>}
          {error && (
            <p role="alert" className="mt-2 rounded-xl border-2 border-[var(--ink)] bg-orange-100 px-3 py-2 text-sm font-bold text-[var(--ink)]">
              {error}
            </p>
          )}
          <div className="mt-3 flex gap-3">
            <Btn variant="white" className="h-[50px]" onClick={reset}>
              Cancel
            </Btn>
            <Btn variant="green" className="h-[50px]" disabled={busy || !newPw || !newPw2 || (hasPassword && !oldPw)} onClick={savePassword}>
              {busy ? "Saving..." : "Save password"}
            </Btn>
          </div>
        </form>
      )}

      {panel === "delete" && (
        <div className="mt-2">
          <p className="text-sm font-bold">This removes {profile.name} and its leaderboard score for good, and frees the name. Your notes stay on this computer.</p>
          {hasPassword && <PasswordField label="Enter your password to confirm" value={delPw} onChange={setDelPw} onEnter={removeAccount} autoComplete="current-password" placeholder="Your password" />}
          {error && (
            <p role="alert" className="mt-2 rounded-xl border-2 border-[var(--ink)] bg-orange-100 px-3 py-2 text-sm font-bold text-[var(--ink)]">
              {error}
            </p>
          )}
          <div className="mt-3 flex gap-3">
            <Btn variant="white" className="h-[50px]" onClick={reset}>
              Cancel
            </Btn>
            <Btn variant="red" className="h-[50px]" disabled={busy || (hasPassword && !delPw)} onClick={removeAccount}>
              {busy ? "Deleting..." : "Delete for good"}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function ago(t?: number) {
  if (!t) return "never";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s} seconds ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} ${m === 1 ? "minute" : "minutes"} ago` : `${Math.round(m / 60)} hours ago`;
}

/** Google sign-in and cloud sync: notes, XP, streak and settings follow you to any computer. */
export function CloudSection() {
  const c = useCloud();
  const signedIn = c.status === "syncing" || c.status === "synced" || (c.status === "error" && !!c.email);
  return (
    <div className="mt-3 rounded-2xl border-[2.5px] border-[var(--ink)] p-4">
      <div className="text-lg font-extrabold">Cloud sync</div>
      {!signedIn ? (
        <>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Sign in with Google to keep your notes, photos, XP and streak safe, and bring them to any computer.
          </p>
          <div className="mt-3">
            <Btn variant="sun" className="h-[50px]" disabled={c.status === "syncing"} onClick={() => signInWithGoogle()}>
              {c.status === "syncing" ? "Signing in..." : "Sign in with Google"}
            </Btn>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm font-bold">
            Signed in as <span className="break-all">{c.email ?? "your Google account"}</span>
          </p>
          <p className="text-sm text-[var(--ink-soft)]">
            {c.status === "syncing" ? "Syncing..." : c.status === "error" ? "Last sync had a problem." : `Last synced ${ago(c.lastSync)}.`} Changes save automatically.
          </p>
          <div className="mt-3 flex gap-3">
            <Btn variant="white" className="h-[50px]" disabled={c.status === "syncing"} onClick={() => syncNow()}>
              Sync now
            </Btn>
            <Btn
              variant="white"
              className="h-[50px]"
              onClick={() => {
                signOutCloud();
                toast("Signed out of cloud sync. Your data stays on this computer.");
              }}
            >
              Sign out
            </Btn>
          </div>
        </>
      )}
      {c.error && (
        <p role="alert" className="mt-3 rounded-xl border-2 border-[var(--ink)] bg-orange-100 px-3 py-2 text-sm font-bold text-[var(--ink)]">
          {c.error}
        </p>
      )}
    </div>
  );
}
