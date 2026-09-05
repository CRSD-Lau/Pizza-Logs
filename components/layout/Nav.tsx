"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { PlayerSearch } from "@/components/players/PlayerSearch";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/",             label: "Upload"       },
  { href: "/raids",        label: "Raids"        },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/players",      label: "Players"      },
  { href: "/guild-roster", label: "Guild"        },
  { href: "/weekly",       label: "This Week"    },
  { href: "/bosses",       label: "Bosses"       },
  { href: "/admin",        label: "Admin"        },
] as const;

export function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <header onKeyDown={(event) => {
      if (event.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    }} className="relative z-20 border-b border-gold-dim bg-bg-deep/95 backdrop-blur-xs sticky top-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href="/" className="group flex min-h-11 shrink-0 items-center gap-3 rounded-sm" onClick={() => setMobileOpen(false)}>
            <PizzaIcon />
            <div className="min-w-0">
              <div className="heading-cinzel text-lg font-bold text-gold-light text-glow-gold leading-none">
                Pizza<span className="text-text-secondary font-normal">Logs</span>
              </div>
              <div className="mt-0.5 text-xs uppercase leading-none tracking-widest text-text-dim">
                WoW Raid Analytics
              </div>
            </div>
          </Link>

          <div className="hidden xl:block min-w-44 flex-1 max-w-72">
            <PlayerSearch />
          </div>

          <nav aria-label="Main navigation" className="hidden xl:flex shrink-0 items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-semibold uppercase tracking-wide transition-colors duration-150",
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

          <button
            ref={menuButtonRef}
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-gold-dim bg-bg-card text-text-secondary transition-colors hover:border-gold/50 hover:text-gold-light xl:hidden"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen(open => !open)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <div className="xl:hidden pb-3">
          <PlayerSearch onNavigate={() => setMobileOpen(false)} />
        </div>

        {mobileOpen && (
          <nav id="mobile-navigation" aria-label="Main navigation" className="xl:hidden border-t border-gold-dim py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {NAV_LINKS.map(({ href, label }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "inline-flex min-h-11 items-center justify-center rounded-sm border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                      active
                        ? "border-gold text-gold-light bg-gold/5"
                        : "border-gold-dim text-text-secondary hover:border-gold/50 hover:text-text-primary"
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

function PizzaIcon() {
  return (
    <svg className="text-gold" width="36" height="36" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="20,3 37,12 37,28 20,37 3,28 3,12" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <polygon points="20,9 31,15 31,25 20,31 9,25 9,15" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
      <circle cx="20" cy="20" r="5" fill="currentColor" opacity="0.85" />
      <line x1="20" y1="3" x2="20" y2="9" stroke="currentColor" strokeWidth="1" />
      <line x1="20" y1="31" x2="20" y2="37" stroke="currentColor" strokeWidth="1" />
      <line x1="3" y1="12" x2="9" y2="15" stroke="currentColor" strokeWidth="1" />
      <line x1="31" y1="25" x2="37" y2="28" stroke="currentColor" strokeWidth="1" />
      <line x1="37" y1="12" x2="31" y2="15" stroke="currentColor" strokeWidth="1" />
      <line x1="9" y1="25" x2="3" y2="28" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
