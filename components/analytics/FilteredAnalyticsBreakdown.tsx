"use client";

import { useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  filterEncounterAnalyticsRows,
  getContextualEncounterAnalyticsFilterOptions,
  type EncounterAnalyticsFilterRow,
} from "@/lib/encounter-analytics-filter";

interface FilteredAnalyticsBreakdownProps {
  rows: EncounterAnalyticsFilterRow[];
  abilityLabel: string;
  abilityPlaceholder: string;
  valueLabel: string;
  occurrencesLabel: string;
  entryLabel: string;
  playerHelp: string;
}

const PAGE_SIZE = 50;

export function FilteredAnalyticsBreakdown({
  rows,
  abilityLabel,
  abilityPlaceholder,
  valueLabel,
  occurrencesLabel,
  entryLabel,
  playerHelp,
}: FilteredAnalyticsBreakdownProps) {
  const [playerQuery, setPlayerQuery] = useState("");
  const [abilityQuery, setAbilityQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const componentId = useId();
  const playerListId = `${componentId}-players`;
  const abilityListId = `${componentId}-abilities`;
  const playerErrorId = `${componentId}-player-error`;
  const abilityErrorId = `${componentId}-ability-error`;
  const helpId = `${componentId}-help`;
  const playerOptions = useMemo(
    () => getContextualEncounterAnalyticsFilterOptions(rows, "player", abilityQuery),
    [rows, abilityQuery],
  );
  const abilityOptions = useMemo(
    () => getContextualEncounterAnalyticsFilterOptions(rows, "ability", playerQuery),
    [rows, playerQuery],
  );
  const result = useMemo(
    () => filterEncounterAnalyticsRows(rows, playerQuery, abilityQuery),
    [rows, playerQuery, abilityQuery],
  );
  const hasFilters = playerQuery.trim().length > 0 || abilityQuery.trim().length > 0;
  const visibleRows = result.rows.slice(0, visibleLimit);
  const remainingRows = result.rows.length - visibleRows.length;

  return (
    <div className="space-y-3">
      <div
        className="border-y border-gold-dim bg-bg-panel/70 px-3 py-3 sm:rounded-sm sm:border sm:px-4"
        role="search"
        aria-label={`Filter ${entryLabel}`}
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_auto] sm:items-end">
          <label className="block space-y-1 text-xs font-semibold uppercase tracking-widest text-text-secondary">
            Player
            <input
              type="search"
              value={playerQuery}
              onChange={event => {
                setPlayerQuery(event.target.value);
                setVisibleLimit(PAGE_SIZE);
              }}
              list={playerListId}
              placeholder="Lausudo"
              autoComplete="off"
              aria-label="Player"
              aria-invalid={!result.playerValid || undefined}
              aria-describedby={`${helpId}${!result.playerValid ? ` ${playerErrorId}` : ""}`}
              className="mt-1 w-full rounded-sm border border-gold-dim bg-bg-deep px-3 py-2 text-sm font-normal normal-case tracking-normal text-text-primary placeholder:text-text-dim focus:border-gold focus:outline-hidden"
            />
            <datalist id={playerListId}>
              {playerOptions.map(player => <option key={player} value={player} />)}
            </datalist>
            {!result.playerValid && (
              <span id={playerErrorId} className="block text-xs font-normal normal-case tracking-normal text-red-400">
                No player in this encounter matches “{playerQuery.trim()}”.
              </span>
            )}
          </label>

          <label className="block space-y-1 text-xs font-semibold uppercase tracking-widest text-text-secondary">
            {abilityLabel}
            <input
              type="search"
              value={abilityQuery}
              onChange={event => {
                setAbilityQuery(event.target.value);
                setVisibleLimit(PAGE_SIZE);
              }}
              list={abilityListId}
              placeholder={abilityPlaceholder}
              autoComplete="off"
              aria-label={abilityLabel}
              aria-invalid={!result.abilityValid || undefined}
              aria-describedby={`${helpId}${!result.abilityValid ? ` ${abilityErrorId}` : ""}`}
              className="mt-1 w-full rounded-sm border border-gold-dim bg-bg-deep px-3 py-2 text-sm font-normal normal-case tracking-normal text-text-primary placeholder:text-text-dim focus:border-gold focus:outline-hidden"
            />
            <datalist id={abilityListId}>
              {abilityOptions.map(ability => <option key={ability} value={ability} />)}
            </datalist>
            {!result.abilityValid && (
              <span id={abilityErrorId} className="block text-xs font-normal normal-case tracking-normal text-red-400">
                No {abilityLabel.toLocaleLowerCase()} in this encounter matches “{abilityQuery.trim()}”.
              </span>
            )}
          </label>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!hasFilters}
            onClick={() => {
              setPlayerQuery("");
              setAbilityQuery("");
              setVisibleLimit(PAGE_SIZE);
            }}
            className="w-full sm:w-auto"
          >
            <X aria-hidden="true" className="h-4 w-4" />
            Clear filters
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-xs text-text-dim">
          <p id={helpId}>{playerHelp} Type part of a name or choose a suggestion.</p>
          <p role="status" aria-live="polite" aria-atomic="true" className="tabular-nums text-text-secondary">
            {hasFilters
              ? `Showing ${visibleRows.length.toLocaleString()} of ${result.rows.length.toLocaleString()} matches from ${rows.length.toLocaleString()} ${entryLabel}`
              : `Showing ${visibleRows.length.toLocaleString()} of ${rows.length.toLocaleString()} ${entryLabel}`}
          </p>
        </div>
      </div>

      {!result.combinationValid && (
        <p className="border-y border-gold-dim px-4 py-8 text-center text-sm text-text-secondary">
          That player and {abilityLabel.toLocaleLowerCase()} both exist, but not together in this encounter.
        </p>
      )}

      {result.combinationValid && result.rows.length > 0 && (
        <div className="border-y border-gold-dim">
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto_auto] gap-3 border-b border-gold-dim px-4 py-2 text-xs font-semibold uppercase tracking-widest text-text-dim sm:grid">
            <span>Player</span>
            <span>{abilityLabel}</span>
            <span className="text-right">{valueLabel}</span>
            <span className="text-right">{occurrencesLabel}</span>
          </div>
          <div className="divide-y divide-gold-dim">
            {visibleRows.map(row => (
              <div
                key={row.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto_auto] sm:px-4"
              >
                <span className="truncate font-semibold text-text-primary">{row.player}</span>
                <span className="row-start-2 truncate text-text-secondary sm:row-start-auto">{row.ability}</span>
                <span className="col-start-2 row-start-1 text-right tabular-nums text-gold sm:col-start-auto sm:row-start-auto">
                  <span className="sr-only">{valueLabel}: </span>
                  {row.value}
                </span>
                <span className="col-start-2 row-start-2 text-right tabular-nums text-text-dim sm:col-start-auto sm:row-start-auto">
                  <span className="sr-only">{occurrencesLabel}: </span>
                  {row.occurrences}
                </span>
              </div>
            ))}
          </div>
          {remainingRows > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gold-dim px-3 py-2 text-xs text-text-dim sm:px-4">
              <span>{remainingRows.toLocaleString()} more matching {entryLabel}</span>
              <div className="flex flex-wrap items-center gap-2">
                {visibleLimit > PAGE_SIZE && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setVisibleLimit(PAGE_SIZE)}>
                    Show first {PAGE_SIZE}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="gold"
                  size="sm"
                  onClick={() => setVisibleLimit(limit => limit + PAGE_SIZE)}
                >
                  Show {Math.min(PAGE_SIZE, remainingRows)} more
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {result.combinationValid && result.rows.length === 0 && (!result.playerValid || !result.abilityValid) && (
        <p className="border-y border-gold-dim px-4 py-8 text-center text-sm text-text-secondary">
          Choose a matching suggestion to inspect this encounter.
        </p>
      )}
    </div>
  );
}
