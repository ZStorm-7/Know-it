// Hand a note id from one screen to the Bulletin Board so it can open that note.
// peek/clear (instead of take) keeps this safe when React runs a mount effect twice in development.
let pending: string | null = null;
export function setPendingNote(id: string | null) {
  pending = id;
}
export function peekPendingNote(): string | null {
  return pending;
}
export function clearPendingNote() {
  pending = null;
}

// The time the app was opened the time before this one (0 on the very first launch).
let prevVisit = 0;
export function setPrevVisit(t: number) {
  prevVisit = t;
}
export function getPrevVisit() {
  return prevVisit;
}
