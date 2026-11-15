"use client";
// Google sign-in and cloud sync, using Firebase Auth and Firestore.
// Firebase is loaded only after someone signs in, so it adds nothing to the first load.
//
// Where data lives:
//   users/{uid}            progress: XP, streak, best score, settings, facts seen, leaderboard account
//   users/{uid}/notes/{id} one document per sticky note (title, photo, facts)
import { useSyncExternalStore } from "react";
import type { Auth, User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import {
  getNoteDetail,
  getState,
  Note,
  NoteDetail,
  saveNoteDetail,
  State,
  subscribeStore,
  update,
} from "./store";
import { capSeen, mergeMain, mergeNotes, SyncMain } from "./sync-merge";

// Firebase web config is public by design. Security comes from the Firestore rules, not from hiding this.
const CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyABgn99z3RMEWBRkTrgLpOa5FTelcnZzos",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "know-it-a8bd0.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "know-it-a8bd0",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "know-it-a8bd0.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "208253946945",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:208253946945:web:a5ae536e3c2aacebdc0ac0",
};

const FLAG = "knowit:cloud";

// ---------- tiny store so the UI can show the status ----------
export type CloudState = {
  status: "off" | "signedOut" | "syncing" | "synced" | "error";
  email?: string;
  lastSync?: number;
  error?: string;
};
let cloud: CloudState = { status: "off" };
const subs = new Set<() => void>();
function setCloud(patch: Partial<CloudState>) {
  cloud = { ...cloud, ...patch };
  subs.forEach((s) => s());
}
export function useCloud(): CloudState {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => cloud,
    () => ({ status: "off" }) as CloudState,
  );
}

// ---------- firebase, loaded on demand ----------
type Fb = {
  auth: Auth;
  db: Firestore;
  a: typeof import("firebase/auth");
  f: typeof import("firebase/firestore");
};
let fbPromise: Promise<Fb> | null = null;
function fb(): Promise<Fb> {
  if (!fbPromise) {
    fbPromise = (async () => {
      const [appM, a, f] = await Promise.all([import("firebase/app"), import("firebase/auth"), import("firebase/firestore")]);
      const app = appM.getApps().length ? appM.getApp() : appM.initializeApp(CONFIG);
      return { auth: a.getAuth(app), db: f.getFirestore(app), a, f };
    })();
  }
  return fbPromise;
}

function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  if (code === "auth/unauthorized-domain") return "This web address isn't allowed yet. In Firebase, open Authentication, Settings, Authorized domains and add it.";
  if (code === "auth/operation-not-allowed") return "Google sign-in isn't turned on. In Firebase, open Authentication, Sign-in method and enable Google.";
  if (code === "permission-denied" || code === "firestore/permission-denied") return "Firestore refused the save. Check that the security rules are published.";
  if (code === "unavailable" || code === "auth/network-request-failed") return "Can't reach the cloud right now. Check your internet connection.";
  return (e as Error)?.message?.slice(0, 160) || "Something went wrong with cloud sync.";
}

// ---------- shape helpers ----------
const noteMeta = (n: Note) => {
  const { fresh, ...rest } = n;
  void fresh;
  return rest;
};
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v ?? null));

function toMain(s: State, deleted: string[]): SyncMain {
  const settings: Record<string, unknown> = { ...s.settings };
  delete settings.device; // phone vs computer layout stays on each device
  return {
    v: 1,
    xp: s.xp,
    huntBest: s.huntBest,
    streak: s.streak,
    settings: settings as SyncMain["settings"],
    tutorialDone: s.tutorialDone,
    boardHintDone: s.boardHintDone,
    profile: s.profile,
    seenFacts: capSeen(s.seenFacts),
    deleted,
    updatedAt: Date.now(),
  };
}

function fromMain(m: SyncMain): Partial<State> {
  return {
    xp: m.xp,
    huntBest: m.huntBest,
    streak: m.streak,
    tutorialDone: m.tutorialDone,
    boardHintDone: m.boardHintDone,
    profile: m.profile,
    seenFacts: m.seenFacts,
  };
}

// ---------- sync engine ----------
let uid: string | null = null;
let stop: (() => void) | null = null;
let deleted = new Set<string>();
let lastMainJson = "";
const lastNote = new Map<string, string>(); // note id -> meta json at the last upload
let timer: ReturnType<typeof setTimeout> | undefined;
let busy = false;
let again = false;

async function pushAll() {
  if (!uid) return;
  const { db, f } = await fb();
  const s = getState();

  // new or changed notes
  for (const n of s.notes) {
    const meta = JSON.stringify(clean(noteMeta(n)));
    if (lastNote.get(n.id) === meta) continue;
    const ref = f.doc(db, "users", uid, "notes", n.id);
    if (!lastNote.has(n.id)) {
      const detail = await getNoteDetail(n.id);
      await f.setDoc(ref, clean({ ...noteMeta(n), ...(detail ?? {}) }));
    } else {
      await f.setDoc(ref, clean(noteMeta(n)), { merge: true }); // rename or move: no need to resend the photo
    }
    lastNote.set(n.id, meta);
    if (deleted.delete(n.id)) lastMainJson = ""; // a restored note is no longer deleted
  }

  // notes removed on this phone
  const present = new Set(s.notes.map((n) => n.id));
  for (const id of [...lastNote.keys()]) {
    if (present.has(id)) continue;
    await f.deleteDoc(f.doc(db, "users", uid, "notes", id));
    lastNote.delete(id);
    deleted.add(id);
    lastMainJson = "";
  }

  // progress
  const main = toMain(s, [...deleted]);
  const json = JSON.stringify({ ...main, updatedAt: 0 });
  if (json !== lastMainJson) {
    await f.setDoc(f.doc(db, "users", uid), clean(main));
    lastMainJson = json;
  }
}

function schedule() {
  if (!uid) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    try {
      await pushAll();
      setCloud({ status: "synced", lastSync: Date.now(), error: undefined });
    } catch (e) {
      setCloud({ status: "error", error: friendly(e) });
    } finally {
      busy = false;
      if (again) {
        again = false;
        schedule();
      }
    }
  }, 2500);
}

/** Download the cloud copy, merge it with this phone, and upload whatever is newer here. */
async function pullAndMerge(): Promise<{ restored: number }> {
  if (!uid) return { restored: 0 };
  const { db, f } = await fb();
  const [mainSnap, notesSnap] = await Promise.all([f.getDoc(f.doc(db, "users", uid)), f.getDocs(f.collection(db, "users", uid, "notes"))]);
  const local = getState();
  const remoteMain = mainSnap.exists() ? (mainSnap.data() as SyncMain) : null;

  const remoteNotes: Note[] = [];
  const remoteDetails = new Map<string, NoteDetail>();
  notesSnap.forEach((d) => {
    const data = d.data() as Note & Partial<NoteDetail>;
    const { photo, box, facts, confidence, ...meta } = data;
    remoteNotes.push({ ...(meta as Note), id: d.id });
    if (photo) remoteDetails.set(d.id, { photo, box: box ?? null, facts: facts ?? [], confidence: confidence ?? 0, object: (meta as Note).object ?? "" });
  });

  if (!remoteMain && remoteNotes.length === 0) {
    // first time with this Google account: everything here goes up
    deleted = new Set();
    lastMainJson = "";
    lastNote.clear();
    return { restored: 0 };
  }

  const localMain = toMain(local, [...deleted]);
  const merged = remoteMain ? mergeMain(localMain, remoteMain) : localMain;
  deleted = new Set(merged.deleted);
  const nm = mergeNotes(local.notes, remoteNotes, merged.deleted);

  for (const id of nm.download) {
    const d = remoteDetails.get(id);
    if (d) await saveNoteDetail(id, d);
  }
  const remoteIds = new Set(remoteNotes.map((n) => n.id));
  update((s) => ({
    ...s,
    ...fromMain(merged),
    settings: { ...s.settings, ...merged.settings, device: s.settings.device },
    notes: nm.notes,
  }));
  lastNote.clear();
  for (const n of nm.notes) if (remoteIds.has(n.id) && !nm.upload.includes(n.id)) lastNote.set(n.id, JSON.stringify(clean(noteMeta(n))));
  lastMainJson = "";
  return { restored: nm.download.length };
}

let watching = false;
let announceNext = false;

/** One auth listener for the whole app: it starts syncing when signed in and stops when signed out. */
async function watchAuth() {
  if (watching) return;
  watching = true;
  const { auth, a } = await fb();
  a.getRedirectResult(auth).catch(() => {});
  a.onAuthStateChanged(auth, (user) => {
    if (user) {
      const announce = announceNext;
      announceNext = false;
      void startFor(user, announce);
    } else {
      uid = null;
      stop?.();
      stop = null;
      setCloud({ status: "signedOut", email: undefined });
    }
  });
}

async function startFor(user: User, announce: boolean) {
  if (uid === user.uid && cloud.status === "syncing") return;
  uid = user.uid;
  setCloud({ status: "syncing", email: user.email ?? undefined, error: undefined });
  try {
    const { restored } = await pullAndMerge();
    await pushAll();
    setCloud({ status: "synced", lastSync: Date.now() });
    stop?.();
    stop = subscribeStore(schedule);
    if (announce && restored > 0) toastLater(`Restored ${restored} ${restored === 1 ? "note" : "notes"} from the cloud`);
    else if (announce) toastLater("Signed in. Your progress now saves to the cloud.");
  } catch (e) {
    setCloud({ status: "error", error: friendly(e) });
  }
}

// the toast lives in a component file; call it lazily to avoid a circular import
function toastLater(text: string) {
  import("@/components/ui").then((m) => m.toast(text)).catch(() => {});
}

// ---------- public API ----------
export function cloudWasUsed(): boolean {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

/** Call once at app start. Only loads Firebase if this phone has signed in before. */
export async function initCloud() {
  if (!cloudWasUsed()) {
    setCloud({ status: "signedOut" });
    return;
  }
  try {
    await watchAuth();
  } catch (e) {
    setCloud({ status: "error", error: friendly(e) });
  }
}

export async function signInWithGoogle() {
  setCloud({ status: "syncing", error: undefined });
  try {
    try {
      localStorage.setItem(FLAG, "1");
    } catch {}
    const { auth, a } = await fb();
    announceNext = true;
    await watchAuth(); // the listener starts the sync as soon as the sign-in succeeds
    const provider = new a.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await a.signInWithPopup(auth, provider);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setCloud({ status: "signedOut" });
        return;
      }
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        await a.signInWithRedirect(auth, provider); // the page reloads and initCloud finishes the sign-in
        return;
      }
      throw e;
    }
  } catch (e) {
    setCloud({ status: "error", error: friendly(e) });
  }
}

export async function syncNow() {
  if (!uid) return;
  setCloud({ status: "syncing", error: undefined });
  try {
    await pullAndMerge();
    await pushAll();
    setCloud({ status: "synced", lastSync: Date.now() });
  } catch (e) {
    setCloud({ status: "error", error: friendly(e) });
  }
}

export async function signOutCloud() {
  try {
    const { auth, a } = await fb();
    await a.signOut(auth);
  } catch {}
  try {
    localStorage.removeItem(FLAG);
  } catch {}
  uid = null;
  stop?.();
  stop = null;
  lastNote.clear();
  lastMainJson = "";
  setCloud({ status: "signedOut", email: undefined });
}
