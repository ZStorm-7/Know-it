"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { playMusic, preloadMusic, setMusicVolume, sfx, Track, unlockAudio } from "@/lib/client/audio";
import { levelInfo, useStore } from "@/lib/client/store";
import { Board } from "./board";
import { Facts } from "./facts";
import { Home } from "./home";
import { Hunt } from "./hunt";
import { SettingsSheet } from "./settings";
import { Sky } from "./sky";
import { Splash } from "./splash";
import { CloudTransition, TransitionHandle } from "./transition";
import { confetti, toast, Toaster } from "./ui";

export type Screen = "splash" | "home" | "facts" | "hunt" | "board";

const TRACK: Record<Screen, Track | null> = { splash: null, home: "home", facts: "facts", hunt: "hunt", board: "board" };

type Nav = { go: (s: Screen) => void; openSettings: () => void; screen: Screen };
const NavCtx = createContext<Nav>({ go: () => {}, openSettings: () => {}, screen: "splash" });
export const useNav = () => useContext(NavCtx);

export default function App() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const busy = useRef(false);
  const tr = useRef<TransitionHandle>(null);
  const settings = useStore((s) => s.settings);
  const xp = useStore((s) => s.xp);

  // theme, text size, reduced motion
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && mq.matches);
      root.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    root.dataset.text = settings.textSize;
    root.dataset.reduceMotion = String(settings.reduceMotion);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme, settings.textSize, settings.reduceMotion]);

  useEffect(() => setMusicVolume(settings.music), [settings.music]);

  // level-up celebration
  const lastLevel = useRef<number | null>(null);
  useEffect(() => {
    const { level, name } = levelInfo(xp);
    if (lastLevel.current !== null && level > lastLevel.current) {
      setTimeout(() => {
        sfx("levelup");
        confetti(0.3, 80);
        toast(`Level up! You are now a ${name}`);
      }, 900);
    }
    lastLevel.current = level;
  }, [xp]);

  const go = useCallback(
    (next: Screen) => {
      if (busy.current) return;
      busy.current = true;
      tr.current!
        .run(() => {
          setScreen(next);
          const t = TRACK[next];
          if (t) playMusic(t);
        }, settings.reduceMotion)
        .finally(() => {
          busy.current = false;
        });
    },
    [settings.reduceMotion],
  );

  const start = () => {
    unlockAudio();
    preloadMusic();
    go("home");
  };

  return (
    <NavCtx.Provider value={{ go, openSettings: () => setSettingsOpen(true), screen }}>
      <div className="app-root">
        <Sky clouds={screen !== "board"} />
        <div className="absolute inset-0" style={{ padding: "inherit" }}>
          {screen === "splash" && <Splash onStart={start} />}
          {screen === "home" && <Home />}
          {screen === "facts" && <Facts />}
          {screen === "hunt" && <Hunt />}
          {screen === "board" && <Board />}
        </div>
      </div>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Toaster />
      <CloudTransition ref={tr} />
    </NavCtx.Provider>
  );
}
