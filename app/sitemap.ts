import type { MetadataRoute } from "next";
import { PIZZA_LOGS_ORIGIN } from "@/lib/site";

const PUBLIC_ROUTES = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/raids", changeFrequency: "daily", priority: 0.9 },
  { path: "/leaderboards", changeFrequency: "daily", priority: 0.9 },
  { path: "/players", changeFrequency: "daily", priority: 0.8 },
  { path: "/guild-roster", changeFrequency: "daily", priority: 0.8 },
  { path: "/weekly", changeFrequency: "daily", priority: 0.8 },
  { path: "/bosses", changeFrequency: "weekly", priority: 0.7 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${PIZZA_LOGS_ORIGIN}${path}`,
    changeFrequency,
    priority,
  }));
}
