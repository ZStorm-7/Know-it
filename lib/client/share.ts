"use client";
import type { Note, NoteDetail } from "./store";

const COLORS = ["#fde047", "#f9a8d4", "#86efac", "#7dd3fc", "#fdba74"];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws a 1080x1350 share card: the photo on a sticky note with its name and best fact. */
export async function makeShareCard(note: Note, detail: NoteDetail): Promise<Blob> {
  const hand = getComputedStyle(document.documentElement).getPropertyValue("--font-caveat").trim() || "cursive";
  const ui = getComputedStyle(document.body).fontFamily || "sans-serif";
  try {
    await document.fonts.load(`700 80px ${hand}`);
    await document.fonts.load(`700 40px ${ui}`);
  } catch {}
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;

  const sky = g.createRadialGradient(W / 2, 420, 60, W / 2, 420, 1100);
  sky.addColorStop(0, "#22d3ee");
  sky.addColorStop(0.45, "#38bdf8");
  sky.addColorStop(1, "#818cf8");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,0.8)";
  [[150, 150, 90], [930, 230, 70], [90, 1235, 60], [985, 1250, 55]].forEach(([x, y, r]) => {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.arc(x + r * 0.9, y + 6, r * 0.75, 0, Math.PI * 2);
    g.arc(x - r * 0.9, y + 10, r * 0.65, 0, Math.PI * 2);
    g.fill();
  });

  // sticky note
  const nx = 90, ny = 150, nw = W - 180, nh = 1000;
  g.save();
  g.translate(W / 2, ny + nh / 2);
  g.rotate(-0.025);
  g.translate(-W / 2, -(ny + nh / 2));
  g.shadowColor = "rgba(15,23,42,0.35)";
  g.shadowBlur = 40;
  g.shadowOffsetY = 20;
  g.fillStyle = COLORS[note.color % COLORS.length];
  roundRect(g, nx, ny, nw, nh, 18);
  g.fill();
  g.shadowColor = "transparent";

  // photo
  const img = await loadImage(detail.photo);
  const px = nx + 60, py = ny + 70, pw = nw - 120, ph = 520;
  g.save();
  roundRect(g, px, py, pw, ph, 28);
  g.clip();
  const s = Math.max(pw / img.width, ph / img.height);
  g.drawImage(img, px + (pw - img.width * s) / 2, py + (ph - img.height * s) / 2, img.width * s, img.height * s);
  g.restore();
  g.lineWidth = 8;
  g.strokeStyle = "#1e293b";
  roundRect(g, px, py, pw, ph, 28);
  g.stroke();
  if (detail.box) {
    const [y0, x0, y1, x1] = detail.box;
    g.lineWidth = 8;
    g.strokeStyle = "#ffd23f";
    roundRect(g, px + (x0 / 1000) * pw - 8, py + (y0 / 1000) * ph - 8, ((x1 - x0) / 1000) * pw + 16, ((y1 - y0) / 1000) * ph + 16, 22);
    g.stroke();
  }

  // title
  g.fillStyle = "#1f2937";
  g.textAlign = "center";
  let size = 110;
  g.font = `700 ${size}px ${hand}`;
  while (g.measureText(note.title).width > nw - 140 && size > 56) {
    size -= 4;
    g.font = `700 ${size}px ${hand}`;
  }
  g.fillText(note.title, W / 2, py + ph + 130);

  // best fact
  g.font = `600 38px ${ui}`;
  g.fillStyle = "#334155";
  const fact = (detail.facts[0] ?? "").slice(0, 170);
  wrap(g, fact, nw - 160).slice(0, 4).forEach((l, i) => g.fillText(l, W / 2, py + ph + 215 + i * 52));
  g.restore();

  // brand
  g.fillStyle = "#fff";
  g.font = `800 52px ${ui}`;
  g.textAlign = "center";
  g.fillText("Know it", W / 2, H - 100);
  g.font = `600 30px ${ui}`;
  g.fillText("Learn something extraordinary about the ordinary", W / 2, H - 55);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("no image"))), "image/png"));
}

/** Shares the card through the share dialog, or downloads it where sharing isn't available. */
export async function shareNote(note: Note, detail: NoteDetail): Promise<"shared" | "downloaded" | "cancelled"> {
  const blob = await makeShareCard(note, detail);
  const file = new File([blob], `know-it-${note.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`, { type: "image/png" });
  const text = `${note.title}: ${detail.facts[0] ?? ""}`.slice(0, 220);
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: note.title, text });
      return "shared";
    }
    if (navigator.share) {
      await navigator.share({ title: note.title, text, url: location.origin });
      return "shared";
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return "cancelled";
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "downloaded";
}
