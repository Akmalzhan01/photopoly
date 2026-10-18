import type { MetadataRoute } from "next";
import { PUBLIC_TOOLS, SITE_URL } from "@/lib/site";

/** Only what a visitor can open without an account; the rest is behind a login. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...PUBLIC_TOOLS.map((tool) => ({
      url: `${SITE_URL}${tool.path}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    { url: `${SITE_URL}/narxlar`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
