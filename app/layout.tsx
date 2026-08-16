import type { Metadata } from "next";
import "@fontsource/cinzel/latin-400.css";
import "@fontsource/cinzel/latin-600.css";
import "@fontsource/cinzel/latin-700.css";
import "@fontsource/rajdhani/latin-300.css";
import "@fontsource/rajdhani/latin-400.css";
import "@fontsource/rajdhani/latin-500.css";
import "@fontsource/rajdhani/latin-600.css";
import "@fontsource/rajdhani/latin-700.css";
import "./globals.css";
import { FrozenLogbookIntro } from "@/components/intro/FrozenLogbookIntro";
import { Nav } from "@/components/layout/Nav";
import { PIZZA_LOGS_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(PIZZA_LOGS_ORIGIN),
  title: {
    default: "Pizza Logs — WotLK Raid Analytics",
    template: "%s | Pizza Logs",
  },
  description:
    "Server-side Wrath of the Lich King combat-log analytics for raid encounters, DPS, HPS, player records, and progression.",
  applicationName: "Pizza Logs",
  authors: [{ name: "Neil Mitchell", url: "https://github.com/CRSD-Lau" }],
  creator: "Neil Mitchell",
  publisher: "Neil Mitchell",
  category: "games",
  keywords: ["World of Warcraft", "WotLK", "combat log", "raid analytics", "DPS", "HPS", "Warmane"],
  openGraph: {
    type: "website",
    locale: "en_CA",
    siteName: "Pizza Logs",
    title: "Pizza Logs — WotLK Raid Analytics",
    description: "Upload combat logs, analyze raid encounters, and track WotLK performance records.",
    images: [
      {
        url: "/social-preview.jpg",
        width: 1280,
        height: 640,
        alt: "Pizza Logs — WotLK Raid Analytics",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pizza Logs — WotLK Raid Analytics",
    description: "Upload combat logs, analyze raid encounters, and track WotLK performance records.",
    images: ["/social-preview.jpg"],
  },
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/icon.svg", type: "image/svg+xml" }],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg-deep text-text-primary antialiased">
        <FrozenLogbookIntro />
        <div className="page-glow">
          <Nav />
          <main className="relative z-10 mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
            {children}
          </main>
          <footer className="relative z-10 mt-12 border-t border-gold-dim py-6 text-center sm:mt-16">
            <p className="text-sm text-text-dim">
              Pizza Logs &mdash; All parsing handled server-side on Railway &nbsp;·&nbsp;
              <span className="text-gold-dim">PizzaWarriors</span>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
