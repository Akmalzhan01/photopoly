import type { Metadata, Viewport } from "next";
import { Playfair_Display, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/**
 * All three carry Cyrillic. This is why the display face is Playfair rather than
 * Instrument Serif, which the design started with: Instrument Serif ships Latin
 * only, so every Russian heading would have silently dropped to a system serif
 * and the page would have looked like two different designs stitched together.
 */
const display = Playfair_Display({
  variable: "--font-display",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin", "cyrillic"],
});

const sans = IBM_Plex_Sans({
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  subsets: ["latin", "cyrillic"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500"],
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Photopoly — удаление фона и точный размер фото",
  description:
    "Уберите фон с фотографии прямо в браузере и подгоните её под размер для паспорта, визы или соцсетей. Снимок никуда не отправляется.",
  manifest: "/manifest.webmanifest",
  applicationName: "Photopoly",
  appleWebApp: {
    capable: true,
    title: "Photopoly",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0908",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
