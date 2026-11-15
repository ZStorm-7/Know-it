import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Know it",
    short_name: "Know it",
    description: "Learn something real instead of scrolling.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#38bdf8",
    theme_color: "#38bdf8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
