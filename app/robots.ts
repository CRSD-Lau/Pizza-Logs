import type { MetadataRoute } from "next";
import { PIZZA_LOGS_ORIGIN } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"],
    },
    sitemap: `${PIZZA_LOGS_ORIGIN}/sitemap.xml`,
    host: PIZZA_LOGS_ORIGIN,
  };
}
