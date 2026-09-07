import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pizza Logs | WotLK Raid Analytics",
    short_name: "Pizza Logs",
    description: "WotLK raid reports, damage and healing from Warmane combat logs.",
    id: "/",
    scope: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#100d0b",
    theme_color: "#100d0b",
    icons: [
      {
        src: "/brand/icon-192.png?v=molten-1",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png?v=molten-1",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-maskable-512.png?v=molten-1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
