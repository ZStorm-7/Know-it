import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import RegisterSW from "./register-sw";

const shrikhand = localFont({
  src: "./fonts/Shrikhand-Regular.ttf",
  variable: "--font-shrikhand",
  display: "swap",
});
const sourGummy = localFont({
  src: "./fonts/SourGummy.ttf",
  variable: "--font-sourgummy",
  weight: "100 900",
  display: "swap",
});
const caveat = localFont({
  src: "./fonts/Caveat.ttf",
  variable: "--font-caveat",
  weight: "400 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Know it",
  description: "Learn something extraordinary about the ordinary. Swap scrolling for snapping: point your camera at any object and discover its story.",
};

export const viewport: Viewport = {
  themeColor: "#38bdf8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-device="desktop" className={`${shrikhand.variable} ${sourGummy.variable} ${caveat.variable}`}>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
