"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { playMusic, preloadMusic, setMusicVolume, sfx, Track, unlockAudio } from "@/lib/client/audio";
import { setPrevVisit } from "@/lib/client/nav";
import { getState, levelInfo, needsUsername, update, useStore } from "@/lib/client/store";
import { Board } from "./board";
import { DeviceScreen } from "./device";
import { Facts } from "./facts";
import { Home } from "./home";
import { Hunt } from "./hunt";
import { SettingsSheet } from "./settings";
import { Sky } from "./sky";
import { Splash } from "./splash";
import { UsernameScreen } from "./username";
import { CloudTransition, TransitionHandle } from "./transition";
import { confetti, toast, Toaster } from "./ui";

export type Screen = "splash" | "device" | "username" | "home" | "facts" | "hunt" | "board";

const TRACK: Record<Screen, Track | null> = { splash: null, device: "home", username: "home", home: "home", facts: "facts", hunt: "hunt", board: "board" };

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
    root.dataset.contrast = String(settings.contrast);
    root.dataset.device = settings.device || "phone";
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme, settings.textSize, settings.reduceMotion, settings.contrast, settings.device]);

  const online = useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );

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
    // remember when we were last here (for the welcome-back card), then stamp this visit
    setPrevVisit(getState().lastVisit);
    update((s) => ({ ...s, lastVisit: Date.now() }));
    go(!getState().settings.device ? "device" : needsUsername() ? "username" : "home");
  };

  return (
    <NavCtx.Provider value={{ go, openSettings: () => setSettingsOpen(true), screen }}>
      <div className="app-root">
        <Sky clouds={screen !== "board"} />
        {/* on a computer the app is a centered column; no transform, so fixed sheets still cover the screen */}
        <div className={`absolute inset-y-0 inset-x-0 mx-auto w-full ${settings.device === "desktop" ? "max-w-[900px]" : ""}`} style={{ padding: "inherit" }}>
          {screen === "splash" && <Splash onStart={start} />}
          {screen === "device" && <DeviceScreen />}
          {screen === "username" && <UsernameScreen />}
          {screen === "home" && <Home />}
          {screen === "facts" && <Facts />}
          {screen === "hunt" && <Hunt />}
          {screen === "board" && <Board />}
        </div>
      </div>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {!online && screen !== "splash" && (
        <div role="status" className="card pointer-events-none fixed inset-x-4 top-3 z-[85] mx-auto max-w-sm px-4 py-2 text-center text-sm font-bold" style={{ marginTop: "env(safe-area-inset-top)" }}>
          Offline. Facts and Hunt need internet. Your board still works.
        </div>
      )}
      <Toaster />
      <CloudTransition ref={tr} />
    </NavCtx.Provider>
  );
}
