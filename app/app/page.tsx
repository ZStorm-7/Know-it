"use client";
import dynamic from "next/dynamic";

// The whole app is client-side (camera, audio, local storage).
const App = dynamic(() => import("@/components/app"), { ssr: false });

export default function Page() {
  return <App />;
}
