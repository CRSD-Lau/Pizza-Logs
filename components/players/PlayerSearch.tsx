"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Search, X } from "lucide-react";
import {
  getPlayerSearchKeyboardAction,
  sanitizePlayerSearchQuery,
  type PlayerSearchResult,
} from "@/lib/player-search";
import { getClassColor } from "@/lib/constants/classes";
import { cn } from "@/lib/utils";

type PlayerSearchProps = {
  className?: string;
  onNavigate?: () => void;
};

type PlayerSearchResponse =
  | { ok: true; query: string; results: PlayerSearchResult[] }
  | { ok: false; query: string; results: PlayerSearchResult[]; error: string };

const DEBOUNCE_MS = 220;

export function PlayerSearch({ className, onNavigate }: PlayerSearchProps) {
  const router = useRouter();
  const resultListId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cacheRef = useRef<Record<string, PlayerSearchResult[]>>({});
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(sanitizePlayerSearchQuery(query));
    }, DEBOUNCE_MS); // debounce search input before hitting the API

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  useEffect(() => {
    const normalized = debouncedQuery.toLowerCase();
    setActiveIndex(-1);

    if (!normalized) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const cached = cacheRef.current[normalized];
    if (cached) {
      setResults(cached);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/players/search?q=${encodeURIComponent(debouncedQuery)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = await response.json() as PlayerSearchResponse;
        if (controller.signal.aborted) return;
        if (!response.ok || !payload.ok) throw new Error(payload.ok ? "Player search failed" : payload.error);
        cacheRef.current[normalized] = payload.results;
        setResults(payload.results);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted || (fetchError instanceof DOMException && fetchError.name === "AbortError")) return;
        setResults([]);
        setError("Search unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  const showDropdown = open && sanitizePlayerSearchQuery(query).length > 0;
  const pendingQuery = sanitizePlayerSearchQuery(query) !== debouncedQuery;
  const searching = pendingQuery || loading;
  const visibleResults = searching || error ? [] : results;
  const status = !showDropdown ? "" : searching ? "Searching for players…"
    : error ? "Search unavailable. Try again or browse the player directory."
      : visibleResults.length ? `${visibleResults.length} ${visibleResults.length === 1 ? "player found" : "players found"}. Use the arrow keys to choose a player.`
        : "No players found. Check the name or browse the player directory.";

  useEffect(() => {
    const option = document.getElementById(`${resultListId}-option-${activeIndex}`);
    const dropdown = dropdownRef.current;
    if (!showDropdown || !option || !dropdown) return;
    const row = option.getBoundingClientRect();
    const panel = dropdown.getBoundingClientRect();
    if (row.top < panel.top) dropdown.scrollTop -= panel.top - row.top;
    else if (row.bottom > panel.bottom) dropdown.scrollTop += row.bottom - panel.bottom;
  }, [activeIndex, resultListId, showDropdown, visibleResults.length]);

  const navigateToResult = (result: PlayerSearchResult) => {
    router.push(result.profilePath);
    setQuery("");
    setDebouncedQuery("");
    setResults([]);
    setOpen(false);
    onNavigate?.();
  };

  const clearSearch = () => {
    setQuery("");
    setDebouncedQuery("");
    setResults([]);
    setError(null);
    setActiveIndex(-1);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search
          aria-hidden="true"
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Search players..."
          role="combobox"
          aria-label="Search players"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={showDropdown && visibleResults.length > 0 ? resultListId : undefined}
          aria-activedescendant={showDropdown && visibleResults[activeIndex] ? `${resultListId}-option-${activeIndex}` : undefined}
          autoComplete="off"
          spellCheck={false}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            const action = getPlayerSearchKeyboardAction({
              key: event.key,
              resultCount: visibleResults.length,
              activeIndex,
            });

            if (action.type === "noop") return;
            event.preventDefault();

            if (action.type === "close") {
              setOpen(false);
              return;
            }

            if (action.type === "highlight") {
              setOpen(true);
              setActiveIndex(action.activeIndex);
              return;
            }

            if (!showDropdown) return;
            const result = visibleResults[action.navigateIndex];
            if (result) navigateToResult(result);
          }}
          className="h-11 w-full rounded-sm border border-gold-dim bg-bg-card/85 pl-10 pr-11 text-base font-medium text-text-primary placeholder:text-text-dim outline-hidden transition-colors focus:border-gold/70 focus:bg-bg-card focus:ring-1 focus:ring-gold/30"
        />
        {searching ? (
          <Loader2
            aria-label="Searching"
            size={15}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gold"
          />
        ) : query ? (
          <button
            type="button"
            aria-label="Clear player search"
            onClick={clearSearch}
            className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-sm text-text-dim transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{status}</p>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-sm border border-gold-dim bg-bg-panel shadow-card"
        >
          {visibleResults.length === 0 && (
            <div className="px-3 py-3 text-sm text-text-secondary">{status}</div>
          )}

          {visibleResults.length > 0 && <div id={resultListId} role="listbox" aria-label="Player search results">
          {visibleResults.map((result, index) => {
            const color = getClassColor(result.className ?? result.name);
            const metadata = [
              result.className,
              result.raceName,
              result.level ? `Level ${result.level}` : null,
              result.guildName,
              result.realmName,
            ].filter(Boolean);
            const sourceLabel = result.source === "logs+roster"
              ? "Logs + Roster"
              : result.source === "roster"
                ? "Roster"
                : "Logs";

            return (
              <button
                key={`${result.realmName}:${result.name}`}
                type="button"
                id={`${resultListId}-option-${index}`}
                tabIndex={-1}
                role="option"
                aria-selected={activeIndex === index}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => navigateToResult(result)}
                className={cn(
                  "block min-h-11 w-full px-3 py-2.5 text-left transition-colors",
                  activeIndex === index ? "bg-bg-hover" : "hover:bg-bg-card",
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold" style={{ color }}>
                      {result.name}
                    </span>
                    <span className="block truncate text-sm text-text-dim">
                      {metadata.join(" / ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-text-dim">
                    {sourceLabel}
                  </span>
                </span>
              </button>
            );
          })}
          </div>}
          {!searching && visibleResults.length === 0 && (
            <Link href="/players" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-gold hover:text-gold-light">Browse all players</Link>
          )}
        </div>
      )}
    </div>
  );
}
