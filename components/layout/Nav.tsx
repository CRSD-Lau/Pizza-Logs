"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/",        label: "Upload"  },
  { href: "/weekly",  label: "This Week" },
  { href: "/bosses",  label: "Bosses"  },
  { href: "/uploads", label: "History" },
  { href: "/admin",   label: "Admin"   },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="relative z-20 border-b border-gold-dim bg-bg-deep/80 backdrop-blur-sm sticky top-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <PizzaIcon />
            <div>
              <div className="heading-cinzel text-lg font-bold text-gold-light text-glow-gold leading-none">
                Pizza<span className="text-text-secondary font-normal">Logs</span>
              </div>
              <div className="text-[10px] text-text-dim tracking-widest uppercase leading-none mt-0.5">
                WoW Raid Analytics
              </div>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "px-4 py-2 text-sm font-semibold tracking-wide uppercase rounded transition-colors duration-150",
                    active
                      ? "text-gold-light border-b-2 border-gold"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Mobile nav */}
          <nav className="flex md:hidden items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "px-2 py-1 text-xs font-semibold tracking-wide uppercase rounded",
                    active ? "text-gold-light" : "text-text-dim hover:text-text-secondary"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}

function PizzaIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="20,3 37,12 37,28 20,37 3,28 3,12"
        fill="none" stroke="#c8a84b" strokeWidth="1.5"/>
      <polygon points="20,9 31,15 31,25 20,31 9,25 9,15"
        fill="none" stroke="#c8a84b" strokeWidth="0.75" opacity="0.5"/>
      <circle cx="20" cy="20" r="5" fill="#c8a84b" opacity="0.85"/>
      <line x1="20" y1="3"  x2="20" y2="9"  stroke="#c8a84b" strokeWidth="1"/>
      <line x1="20" y1="31" x2="20" y2="37" stroke="#c8a84b" strokeWidth="1"/>
      <line x1="3"  y1="12" x2="9"  y2="15" stroke="#c8a84b" strokeWidth="1"/>
      <line x1="31" y1="25" x2="37" y2="28" stroke="#c8a84b" strokeWidth="1"/>
      <line x1="37" y1="12" x2="31" y2="15" stroke="#c8a84b" strokeWidth="1"/>
      <line x1="9"  y1="25" x2="3"  y2="28" stroke="#c8a84b" strokeWidth="1"/>
    </svg>
  );
}
