import type { Metadata } from "next";
import { Cinzel, Rajdhani } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/layout/Nav";

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
        <div className="page-glow">
          <Nav />
          <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
            {children}
          </main>
          <footer className="relative z-10 border-t border-gold-dim mt-16 py-6 text-center">
            <p className="text-sm text-text-dim">
              Pizza Logs &mdash; All parsing done client-side, no data leaves your browser &nbsp;·&nbsp;
              <span className="text-gold-dim">PizzaWarriors</span>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
