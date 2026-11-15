"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { sfx } from "@/lib/client/audio";
import { signInWithGoogle, signOutCloud, syncNow, useCloud } from "@/lib/client/cloud";
import { signOut, setProfile, useStore } from "@/lib/client/store";
import { useNav } from "./app";
import { RankBadge } from "./art";
import { Btn, toast } from "./ui";

/** Account area for Settings: who you are, your rank, a recovery code, sign out and delete. */
export function AccountSection({ onClose }: { onClose: () => void }) {
  const { go } = useNav();
  const profile = useStore((s) => s.profile);
  const best = useStore((s) => s.huntBest);
  const notes = useStore((s) => s.notes.length);
  const [rank, setRank] = useState<number | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
        <div className="mt-3 flex gap-3">
          <Btn
            variant="sun"
            className="h-14"
            onClick={() => {
              onClose();
              go("username");
            }}
          >
            Create or sign in
          </Btn>
        </div>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.token);
      toast("Recovery code copied. Keep it somewhere safe.");
    } catch {
      setShowCode(true);
      toast("Couldn't copy. Select the code below instead.");
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

      <div className="mt-3 flex flex-col gap-2.5">
        <Btn variant="white" className="h-14" onClick={copy}>
          Copy my recovery code
        </Btn>
        {showCode && (
          <code className="block rounded-xl bg-slate-100 p-3 text-center text-sm font-bold break-all text-[var(--ink)] select-text dark:bg-white/10 dark:text-[var(--card-ink)]">
            {profile.token}
          </code>
        )}
        <p className="text-xs text-[var(--ink-soft)]">
          Use your username plus this code to sign in on another phone and get your leaderboard spot back. Anyone with the code can use your account, so don&apos;t share it.
        </p>
        <div className="flex gap-3">
          <Btn
            variant="white"
            className="h-14"
            onClick={() => {
              signOut();
              sfx("whoosh");
              toast("Signed out. Your notes stay on this phone.");
            }}
          >
            Sign out
          </Btn>
          {!confirmDelete ? (
            <Btn variant="white" className="h-14" onClick={() => setConfirmDelete(true)}>
              Delete account
            </Btn>
          ) : (
            <Btn
              className="h-14"
              onClick={async () => {
                try {
                  await api.deleteAccount(profile.name, profile.token);
                  setProfile(null);
                  setConfirmDelete(false);
                  toast("Account deleted. Your username is free again.");
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Couldn't delete the account");
                }
              }}
            >
              Tap again to delete
            </Btn>
          )}
        </div>
      </div>
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

/** Google sign-in and cloud sync: notes, XP, streak and settings follow you to any phone. */
export function CloudSection() {
  const c = useCloud();
  const signedIn = c.status === "syncing" || c.status === "synced" || (c.status === "error" && !!c.email);
  return (
    <div className="mt-3 rounded-2xl border-[2.5px] border-[var(--ink)] p-4">
      <div className="text-lg font-extrabold">Cloud sync</div>
      {!signedIn ? (
        <>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Sign in with Google to keep your notes, photos, XP and streak safe, and bring them to any phone.
          </p>
          <div className="mt-3">
            <Btn variant="sun" className="h-14" disabled={c.status === "syncing"} onClick={() => signInWithGoogle()}>
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
            <Btn variant="white" className="h-14" disabled={c.status === "syncing"} onClick={() => syncNow()}>
              Sync now
            </Btn>
            <Btn
              variant="white"
              className="h-14"
              onClick={() => {
                signOutCloud();
                toast("Signed out of cloud sync. Your data stays on this phone.");
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
