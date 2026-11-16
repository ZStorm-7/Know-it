// Pure merge rules for cloud sync. No browser or Firebase code in here, so they are easy to test.
import type { Note, Settings } from "./store";

export type SyncStreak = { count: number; best: number; last: string };
export type SyncProfile = { name: string; token: string; hasPassword?: boolean } | null;

/** The small "main" document stored at users/{uid}. */
export type SyncMain = {
  v: 1;
  xp: number;
  huntBest: number;
  streak: SyncStreak;
  settings: Partial<Settings>;
  tutorialDone: boolean;
  boardHintDone: boolean;
  profile: SyncProfile;
  seenFacts: Record<string, string[]>;
  deleted: string[];
  updatedAt: number;
};

const MAX_SEEN_KEYS = 40;
const MAX_FACTS_PER_KEY = 24;

export function capSeen(seen: Record<string, string[]>): Record<string, string[]> {
  const keys = Object.keys(seen).slice(-MAX_SEEN_KEYS);
  const out: Record<string, string[]> = {};
  for (const k of keys) out[k] = seen[k].slice(-MAX_FACTS_PER_KEY);
  return out;
}

function mergeSeen(a: Record<string, string[]>, b: Record<string, string[]>) {
  const out: Record<string, string[]> = { ...a };
  for (const [k, facts] of Object.entries(b)) {
    const have = new Set(out[k] ?? []);
    out[k] = [...(out[k] ?? []), ...facts.filter((f) => !have.has(f))];
  }
  return capSeen(out);
}

/** Combine this computer's progress with the cloud copy. Progress only ever goes forward. */
export function mergeMain(local: SyncMain, remote: SyncMain): SyncMain {
  const streak: SyncStreak =
    local.streak.last === remote.streak.last
      ? { count: Math.max(local.streak.count, remote.streak.count), best: Math.max(local.streak.best, remote.streak.best), last: local.streak.last }
      : {
          ...(local.streak.last > remote.streak.last ? local.streak : remote.streak),
          best: Math.max(local.streak.best, remote.streak.best),
        };
  // settings come from the cloud, local values fill any gaps
  const settings: Partial<Settings> = { ...local.settings, ...remote.settings };
  return {
    v: 1,
    xp: Math.max(local.xp, remote.xp),
    huntBest: Math.max(local.huntBest, remote.huntBest),
    streak,
    settings,
    tutorialDone: local.tutorialDone || remote.tutorialDone,
    boardHintDone: local.boardHintDone || remote.boardHintDone,
    profile: local.profile ?? remote.profile, // this computer's account wins; otherwise adopt the cloud one
    seenFacts: mergeSeen(local.seenFacts, remote.seenFacts),
    deleted: [...new Set([...local.deleted, ...remote.deleted])].slice(-300),
    updatedAt: Date.now(),
  };
}

export type NoteMerge = {
  /** The notes this computer should end up with. */
  notes: Note[];
  /** Ids whose newest version is on this computer and must be uploaded. */
  upload: string[];
  /** Ids whose newest version is in the cloud and must be downloaded. */
  download: string[];
  /** Ids deleted on another device: remove them here. */
  removeLocal: string[];
};

const stamp = (n: Note) => n.updatedAt ?? n.createdAt;

/** Union of both note lists. A note deleted elsewhere is removed; otherwise the newest edit wins. */
export function mergeNotes(local: Note[], remote: Note[], deleted: string[]): NoteMerge {
  const gone = new Set(deleted);
  const byId = new Map<string, Note>();
  const upload: string[] = [];
  const download: string[] = [];
  const removeLocal: string[] = [];
  const localIds = new Set(local.map((n) => n.id));
  const remoteById = new Map(remote.map((n) => [n.id, n]));

  for (const n of local) {
    if (gone.has(n.id) && remoteById.has(n.id) === false) {
      removeLocal.push(n.id);
      continue;
    }
    const r = remoteById.get(n.id);
    if (!r) {
      byId.set(n.id, n);
      upload.push(n.id);
    } else if (stamp(r) > stamp(n)) {
      byId.set(n.id, { ...r, fresh: false });
      download.push(n.id);
    } else {
      byId.set(n.id, n);
      if (stamp(n) > stamp(r)) upload.push(n.id);
    }
  }
  for (const r of remote) {
    if (localIds.has(r.id) || gone.has(r.id)) continue;
    byId.set(r.id, { ...r, fresh: false });
    download.push(r.id);
  }
  return { notes: [...byId.values()].sort((a, b) => a.createdAt - b.createdAt), upload, download, removeLocal };
}
