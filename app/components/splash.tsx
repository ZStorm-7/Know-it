"use client";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { CloudLoader } from "./art";
import { Logo } from "./logo";

export function Splash({ onStart }: { onStart: () => void }) {
  const [showLogo, setShowLogo] = useState(false);
  const [ready, setReady] = useState(false);
  const cloud = useRef<HTMLDivElement>(null);
  const tap = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();
    tl.fromTo(cloud.current, { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: 1, ease: "elastic.out(1, 0.5)" })
      .to(cloud.current, { y: -10, duration: 0.6, ease: "sine.inOut", yoyo: true, repeat: 1 })
      .call(() => setShowLogo(true), [], 1.6)
      .call(() => setReady(true), [], 2.6);
    return () => {
      tl.kill();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    gsap.fromTo(tap.current, { y: 30, opacity: 0, scale: 0.7 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: "back.out(2)" });
    gsap.to(tap.current, { scale: 1.06, duration: 0.8, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 0.6 });
  }, [ready]);

  return (
    <button className="flex h-full w-full flex-col items-center justify-center gap-6 px-6" onClick={() => ready && onStart()}>
      <div ref={cloud}>
        <CloudLoader size={190} />
      </div>
      <div className="min-h-[6rem]">{showLogo && <Logo />}</div>
      <div className="min-h-[3.5rem]">
        {ready && (
          <span ref={tap} className="glass inline-block rounded-full px-7 py-3 text-lg font-extrabold">
            Tap to start
          </span>
        )}
      </div>
    </button>
  );
}
