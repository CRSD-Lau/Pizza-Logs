import type { Metadata, Viewport } from "next";
import "@fontsource/cinzel/latin-400.css";
import "@fontsource/cinzel/latin-600.css";
import "@fontsource/cinzel/latin-700.css";
import "@fontsource/rajdhani/latin-300.css";
import "@fontsource/rajdhani/latin-400.css";
import "@fontsource/rajdhani/latin-500.css";
import "@fontsource/rajdhani/latin-600.css";
import "@fontsource/rajdhani/latin-700.css";
import "./globals.css";
import Link from "next/link";
import { Nav } from "@/components/layout/Nav";
import { PIZZA_LOGS_ORIGIN } from "@/lib/site";
import { SOCIAL_IMAGE } from "@/lib/page-metadata";
import { BUG_REPORT_URL, SECURITY_REPORT_URL } from "@/lib/upload-policy";

export const viewport: Viewport = {
  themeColor: "#100d0b",
};

export const metadata: Metadata = {
  metadataBase: new URL(PIZZA_LOGS_ORIGIN),
  title: {
    default: "Pizza Logs | WotLK Raid Analytics",
    template: "%s | Pizza Logs",
  },
  description:
    "Upload a Warmane combat log to review boss fights, damage and healing.",
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
    title: "Pizza Logs | WotLK Raid Analytics",
    description: "Upload a Warmane combat log to review boss fights, damage and healing.",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pizza Logs | WotLK Raid Analytics",
    description: "Upload a Warmane combat log to review boss fights, damage and healing.",
    images: [SOCIAL_IMAGE],
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=molten-1" },
      { url: "/icon.svg?v=molten-1", type: "image/svg+xml" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png?v=molten-1", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg-deep text-text-primary antialiased">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <div className="page-glow flex min-h-dvh flex-col">
          <Nav />
          <main id="main-content" tabIndex={-1} className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8">
            {children}
          </main>
          <footer className="relative z-10 border-t border-gold-dim px-4 py-6 text-center">
            <p className="text-sm text-text-dim">
              Pizza Logs: WotLK raid analytics &nbsp;·&nbsp;
              <span className="text-gold">PizzaWarriors</span>
            </p>
            <nav aria-label="Footer" className="mt-2 flex flex-wrap justify-center gap-x-6">
              <Link href="/" className="inline-flex min-h-11 items-center text-sm text-gold hover:text-gold-light">Upload a log</Link>
              <Link href="/raids" className="inline-flex min-h-11 items-center text-sm text-gold hover:text-gold-light">Browse raids</Link>
              <Link href="/upload-policy" className="inline-flex min-h-11 items-center text-sm text-gold hover:text-gold-light">Upload rules and privacy</Link>
              <a href={BUG_REPORT_URL} className="inline-flex min-h-11 items-center text-sm text-gold hover:text-gold-light">Report a bug</a>
            </nav>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-text-secondary">Bugs and incorrect results can occur. Report an issue on GitHub for Neil to review. Include reproduction steps and a public report link; keep private logs out of issues. <a href={SECURITY_REPORT_URL} className="text-gold underline">Report security concerns privately</a>.</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
