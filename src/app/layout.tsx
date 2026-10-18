import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { THEME_SCRIPT } from "@/lib/theme";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

/**
 * One face for everything. Onest was drawn for Cyrillic first, so Russian
 * headings and body text sit on the same metrics as the Latin — and it has
 * tabular figures, which the prices, sizes and cash tables lean on.
 */
const sans = Onest({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "cyrillic"],
});

const DESCRIPTION =
  "Фото на документы 3×4 и 3,5×4,5 онлайн, удаление фона, удаление лишних предметов, увеличение фото и HEIC в JPG — бесплатно, прямо в браузере. Снимок никуда не отправляется.";

export const metadata: Metadata = {
  // Relative URLs below — canonical links, the social preview — resolve
  // against this. A canonical is deliberately *not* set here: it would be
  // inherited by every page that forgot its own and point them all at "/".
  metadataBase: new URL(SITE_URL),
  title: "Фото на документы онлайн, убрать фон, увеличить фото — photopoly",
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: SITE_NAME,
    title: "photopoly — фото на документы и инструменты для фото онлайн",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
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
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d12" },
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
      className={`${sans.variable} h-full`}
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
