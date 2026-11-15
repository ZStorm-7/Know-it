import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Curio",
    short_name: "Curio",
    description: "Learn something extraordinary about the ordinary. A better use of the minutes you would spend scrolling.",
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
