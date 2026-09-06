import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pizza Logs - WotLK Raid Analytics",
    short_name: "Pizza Logs",
    description: "Server-side WotLK combat-log analytics for raid encounters and player records.",
    start_url: "/",
    display: "standalone",
    background_color: "#080a0f",
    theme_color: "#c8a84b",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
