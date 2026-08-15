import type { Metadata } from "next";
import { Cinzel, Rajdhani } from "next/font/google";
import "./globals.css";
import { FrozenLogbookIntro } from "@/components/intro/FrozenLogbookIntro";
import { Nav } from "@/components/layout/Nav";
import { PIZZA_LOGS_ORIGIN } from "@/lib/site";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-rajdhani",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(PIZZA_LOGS_ORIGIN),
  title: {
    default: "Pizza Logs — WoW Raid Analytics",
    template: "%s | Pizza Logs",
  },
  description:
    "Premium World of Warcraft combat log analytics for PizzaWarriors. Track DPS, HPS, milestones, and all-time records across every raid boss.",
  keywords: ["WoW", "combat log", "raid analytics", "DPS", "WotLK", "PizzaWarriors"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${rajdhani.variable}`}>
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
