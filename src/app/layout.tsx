import type { Metadata, Viewport } from "next";
import { Playfair_Display, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { THEME_SCRIPT } from "@/lib/theme";
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
  // The browser chrome around the page — the phone's status bar, the desktop
  // title bar — should match whichever theme is showing, so both are declared.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0908" },
  ],
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
      // The script below writes `data-theme` before React sees the document,
      // so the attribute is legitimately not what the server rendered.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
