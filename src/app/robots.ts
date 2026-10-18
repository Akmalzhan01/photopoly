import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Account pages redirect a crawler to the sign-in form anyway; listing them
 * here keeps that redirect out of the index instead of leaving it to chance.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/hisob",
        "/kassa",
        "/zakazlar",
        "/studio",
        "/karobka",
        "/kirish",
        "/royxat",
        "/oflayn",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
