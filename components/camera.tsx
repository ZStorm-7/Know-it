"use client";
import gsap from "gsap";
import { ArrowLeft, Check, ImageIcon, RefreshCw, RotateCcw } from "lucide-react";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { haptic, sfx } from "@/lib/client/audio";
import { fileToDataUrl, videoToDataUrl } from "@/lib/client/image";
import { getState, update, useStore } from "@/lib/client/store";
import { Nimbus } from "./art";
import { Btn, IconBtn } from "./ui";

type CamState = "explain" | "starting" | "live" | "blocked" | "nocamera" | "unsupported";

export function Camera({
  onCapture,
  onBack,
  confirm = true,
  hint = "Show me something ordinary",
  top,
  disabled,
}: {
  onCapture: (dataUrl: string) => void;
  onBack: () => void;
  confirm?: boolean;
  hint?: string;
  top?: ReactNode;
  disabled?: boolean;
}) {
  const explained = useStore((s) => s.cameraExplained);
  const [state, setState] = useState<CamState>(explained ? "starting" : "explain");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [preview, setPreview] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const nativeInput = useRef<HTMLInputElement>(null);
  // Phones and tablets: the capture input opens the real camera app. Desktops ignore it.
  const [isPhone] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    stop();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play().catch(() => {});
      }
      setState("live");
    } catch (e) {
      const name = (e as Error)?.name;
      setState(
        name === "NotAllowedError" || name === "SecurityError"
          ? "blocked"
          : name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError"
            ? "nocamera"
            : "unsupported",
      );
    }
  }, [facing]);

  // The camera is an external system; starting it updates state when it answers.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state === "starting") start();
  }, [state, start]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state === "live") start();
    // restart when the facing camera changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  useEffect(() => stop, []);

  const deliver = (dataUrl: string) => {
    if (confirm) {
      setPreview(dataUrl);
    } else {
      onCapture(dataUrl);
    }
  };

  const shoot = () => {
    if (!video.current || disabled) return;
    sfx("shutter");
    haptic(25);
    gsap.fromTo(flash.current, { opacity: 0.95 }, { opacity: 0, duration: 0.45, ease: "power2.out" });
    deliver(videoToDataUrl(video.current));
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      deliver(await fileToDataUrl(f));
    } catch {}
  };

  const allow = () => {
    update((s) => ({ ...s, cameraExplained: true }));
    setState("starting");
  };

  return (
    <div className="bleed absolute inset-0 overflow-hidden bg-slate-950">
      <video
        ref={video}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/70 to-transparent" />

      {state === "live" && !preview && (
        <div className="pointer-events-none absolute inset-0">
          <div className={`cam-corner left-[9%] rounded-tl-[28px] border-b-0 border-r-0 ${top ? "top-[30%]" : "top-[20%]"}`} />
          <div className={`cam-corner right-[9%] rounded-tr-[28px] border-b-0 border-l-0 ${top ? "top-[30%]" : "top-[20%]"}`} />
          <div className="cam-corner bottom-[24%] left-[9%] rounded-bl-[28px] border-r-0 border-t-0" />
          <div className="cam-corner bottom-[24%] right-[9%] rounded-br-[28px] border-l-0 border-t-0" />
        </div>
      )}

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 z-10 mx-auto flex w-full max-w-2xl items-start gap-3 p-4">
        <IconBtn label="Back" onClick={onBack}>
          <ArrowLeft size={22} strokeWidth={3} />
        </IconBtn>
        <div className="min-w-0 flex-1">{top}</div>
      </div>

      {/* hint */}
      {state === "live" && !preview && !top && (
        <div className="glass absolute left-1/2 top-[13%] -translate-x-1/2 rounded-full px-4 py-1.5 text-sm font-bold whitespace-nowrap">
          {hint}
        </div>
      )}

      {/* bottom controls */}
      {!preview && (state === "live" || state === "starting") && (
        <div className="absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-md items-center justify-around px-8" style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
          <IconBtn label="Pick a photo" onClick={() => fileInput.current?.click()}>
            <ImageIcon size={22} strokeWidth={2.6} />
          </IconBtn>
          <button aria-label="Take picture" className="shutter" onClick={shoot} disabled={disabled}>
            <span />
          </button>
          <IconBtn label="Flip camera" onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}>
            <RefreshCw size={22} strokeWidth={2.6} />
          </IconBtn>
        </div>
      )}

      {/* preview */}
      {preview && (
        <div className="absolute inset-0 z-20 bg-slate-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pt-16" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
           <div className="mx-auto flex w-full max-w-md gap-3">
            <Btn variant="white" className="h-[58px] text-lg" onClick={() => setPreview(null)}>
              <RotateCcw size={20} strokeWidth={3} /> Retake
            </Btn>
            <Btn variant="mint" className="h-[58px] text-lg" onClick={() => onCapture(preview)}>
              <Check size={22} strokeWidth={3.2} /> Use this
            </Btn>
           </div>
          </div>
        </div>
      )}

      {/* permission explainer / blocked / no camera */}
      {state !== "live" && state !== "starting" && !preview && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-b from-sky-400 to-indigo-500 p-6">
          <div className="card w-full max-w-sm p-6 text-center">
            <Nimbus size={150} mood={state === "explain" ? "wow" : "sad"} className="bob mx-auto" />
            <h2 className="font-display mt-2 text-2xl">
              {state === "explain" ? "Let me see!" : state === "blocked" ? "Camera is blocked" : "No camera found"}
            </h2>
            <p className="mt-2 text-[0.95rem] text-[var(--ink-soft)]">
              {state === "explain"
                ? "Know it uses your camera to spot objects. Photos stay on your phone, except the one I look at."
                : state === "blocked"
                  ? "Your browser said no to the camera. Allow camera access in your browser settings, then tap Try again."
                  : isPhone
                    ? "I couldn't open a live camera in the app, but your phone's camera app still works."
                    : "This device has no camera I can use. Connect one and tap Try again, or pick a photo from your files."}
            </p>
            <div className="mt-5 flex flex-col gap-3">
              {state === "explain" && (
                <Btn variant="mint" className="h-[58px] text-lg" onClick={allow}>
                  Turn on camera
                </Btn>
              )}
              {state !== "explain" && (
                <Btn variant="mint" className="h-[58px] text-lg" onClick={() => setState("starting")}>
                  Try again
                </Btn>
              )}
              {state !== "explain" && isPhone && (
                <Btn variant="sun" className="h-[50px]" onClick={() => nativeInput.current?.click()}>
                  Open phone camera
                </Btn>
              )}
              <Btn variant="white" className="h-[50px]" onClick={() => fileInput.current?.click()}>
                {isPhone ? "Pick from photos" : "Pick a photo from files"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      <div ref={flash} className="pointer-events-none absolute inset-0 z-30 bg-white opacity-0" />
      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <input ref={nativeInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
    </div>
  );
}

export function resetCameraExplainer() {
  if (getState().cameraExplained) update((s) => ({ ...s, cameraExplained: false }));
}
