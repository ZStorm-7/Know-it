"use client";

function drawToDataUrl(
  src: CanvasImageSource,
  w: number,
  h: number,
  max: number,
  quality = 0.82,
) {
  const scale = Math.min(1, max / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const g = canvas.getContext("2d")!;
  g.drawImage(src, 0, 0, cw, ch);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function fileToDataUrl(file: File, max = 1024): Promise<string> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const out = drawToDataUrl(bmp, bmp.width, bmp.height, max);
    bmp.close();
    return out;
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      return drawToDataUrl(img, img.naturalWidth, img.naturalHeight, max);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export function videoToDataUrl(video: HTMLVideoElement, max = 1024): string {
  return drawToDataUrl(video, video.videoWidth, video.videoHeight, max);
}

export async function shrinkDataUrl(dataUrl: string, max = 640): Promise<string> {
  const img = await loadImage(dataUrl);
  return drawToDataUrl(img, img.naturalWidth, img.naturalHeight, max, 0.78);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
