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
  description: "Learn something real instead of scrolling. Snap any object and discover its story.",
  appleWebApp: { capable: true, title: "Know it", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#38bdf8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${shrikhand.variable} ${sourGummy.variable} ${caveat.variable}`}>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
