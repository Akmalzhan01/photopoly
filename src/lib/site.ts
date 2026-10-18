/**
 * The public address of the site, for canonical links, the sitemap and
 * social previews. The same variable the payment callbacks are built from, so
 * the two can never disagree about where the site lives.
 */
export const SITE_URL = (process.env.APP_URL ?? "https://photopoly.vercel.app").replace(/\/+$/, "");

export const SITE_NAME = "photopoly";

/** The tools open to visitors, in the order they are offered. */
export const PUBLIC_TOOLS = [
  { path: "/fon", name: "Убрать фон с фото" },
  { path: "/ochirish", name: "Удалить лишнее с фото" },
  { path: "/kattalashtirish", name: "Увеличить фото" },
  { path: "/konvert", name: "HEIC в JPG и сжатие фото" },
  { path: "/skaner", name: "Сканер документов" },
] as const;

/**
 * Metadata for a public page. A page that sets `openGraph` replaces the root
 * layout's object rather than merging with it, and the generated preview image
 * went with it — so the image is named here, every time.
 */
export function pageMetadata(path: string, title: string, description: string) {
  const image = { url: "/opengraph-image", width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website" as const,
      locale: "ru_RU",
      siteName: SITE_NAME,
      title,
      description,
      url: path,
      images: [image],
    },
    twitter: { card: "summary_large_image" as const, title, description, images: [image.url] },
  };
}
