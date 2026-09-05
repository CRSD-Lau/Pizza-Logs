"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  nextSessionPlayerSort,
  sortSessionPlayers,
  type SessionPlayerRow,
  type SessionPlayerSort,
  type SessionPlayerSortKey,
} from "@/lib/session-player-sort";
import { cn } from "@/lib/utils";
import { NumericValue } from "@/components/ui/NumericValue";

const columns: readonly { key: SessionPlayerSortKey; label: string; rate?: boolean }[] = [
  { key: "name", label: "Player" },
  { key: "totalDamage", label: "Total Damage" },
  { key: "dps", label: "DPS", rate: true },
  { key: "heal", label: "Healing + absorbs" },
  { key: "healPerSecond", label: "Healing + absorbs /s", rate: true },
  { key: "damageTaken", label: "Damage Taken" },
  { key: "dtps", label: "DTPS", rate: true },
];
const focusClasses = "rounded-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

function metricValue(row: SessionPlayerRow, key: SessionPlayerSortKey, rate?: boolean) {
  const value = row[key];
  if (typeof value === "string") return value;
  return <NumericValue value={value} kind={rate ? "rate" : "integer"} />;
}

function PlayerName({ row }: { row: SessionPlayerRow }) {
  if (!row.href) return <span style={{ color: row.color }}>{row.name}</span>;
  const destination = `${row.name}'s all-attempt raid report`;
  return (
    <Link
      href={row.href}
      title={`View ${destination}`}
      aria-label={`View ${destination}`}
      className={cn("inline-flex min-h-11 items-center hover:text-gold transition-colors", focusClasses)}
      style={{ color: row.color }}
    >
      {row.name}
    </Link>
  );
}

export function SessionPlayerTable({ rows, label }: { rows: SessionPlayerRow[]; label: string }) {
  const instanceId = useId();
  const selectId = `${instanceId}-sort`;
  const statusId = `${instanceId}-status`;
  const [sort, setSort] = useState<SessionPlayerSort>({ key: "totalDamage", direction: "desc" });
  const sortedRows = sortSessionPlayers(rows, sort);
  const sortLabel = columns.find(column => column.key === sort.key)!.label;
  const directionLabel = sort.direction === "asc" ? "ascending" : "descending";
  const nextDirectionLabel = sort.direction === "asc" ? "descending" : "ascending";

  function chooseSort(key: SessionPlayerSortKey) {
    setSort(current => nextSessionPlayerSort(current, key));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2 px-4 xl:hidden">
        <label htmlFor={selectId} className="min-w-0 flex-1 text-xs font-semibold text-text-secondary">
          Sort by
          <select
            id={selectId}
            value={sort.key}
            onChange={event => chooseSort(event.target.value as SessionPlayerSortKey)}
            aria-label={`${label}: sort by`}
            aria-describedby={statusId}
            className={cn("mt-1 min-h-11 w-full border border-gold-dim bg-bg-deep px-3 text-sm text-text-primary", focusClasses)}
          >
            {columns.map(column => <option key={column.key} value={column.key}>{column.label}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={() => chooseSort(sort.key)}
          aria-label={`Sort ${nextDirectionLabel} by ${sortLabel}`}
          className={cn("inline-flex min-h-11 items-center gap-2 border border-gold-dim px-3 text-xs font-semibold text-text-primary hover:border-gold", focusClasses)}
        >
          <span aria-hidden="true">{sort.direction === "asc" ? "↓" : "↑"}</span>
          Sort {nextDirectionLabel}
        </button>
      </div>
      <p id={statusId} role="status" aria-live="polite" aria-atomic="true" className="px-4 text-xs text-text-secondary">
        {label}: sorted by {sortLabel}, {directionLabel}.
      </p>

      <div className="data-panel xl:hidden">
        <ul aria-label={label} aria-describedby={statusId} className="divide-y divide-gold-dim">
          {sortedRows.map(row => (
            <li key={row.name} className="px-4 py-3">
              <div className="flex min-h-11 items-center text-sm font-semibold"><PlayerName row={row} /></div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pb-1">
                {columns.slice(1).map(column => (
                  <div key={column.key}>
                    <dt className="text-xs uppercase tracking-wide text-text-dim">{column.label}</dt>
                    <dd className={cn("mt-1 text-sm tabular-nums", column.rate ? "text-text-secondary" : "text-text-primary")}>
                      {metricValue(row, column.key, column.rate)}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </div>

      <div className="data-panel hidden xl:block">
        <table aria-label={label} aria-describedby={statusId} className="w-full text-xs tabular-nums">
          <thead className="bg-bg-card text-text-dim uppercase tracking-wider">
            <tr>
              {columns.map(column => {
                const active = sort.key === column.key;
                const next = nextSessionPlayerSort(sort, column.key);
                return (
                  <th key={column.key} scope="col" aria-sort={active ? directionLabel : "none"} className="px-3 py-1">
                    <button
                      type="button"
                      onClick={() => chooseSort(column.key)}
                      aria-label={`Sort ${column.label} ${next.direction === "asc" ? "ascending" : "descending"}`}
                      className={cn(
                        "inline-flex min-h-11 min-w-11 w-full items-center gap-1 uppercase tracking-wider hover:text-gold",
                        column.key === "name" ? "justify-start text-left" : "justify-end text-right",
                        active && "text-gold",
                        focusClasses,
                      )}
                    >
                      {column.label}
                      <span aria-hidden="true">{active ? sort.direction === "asc" ? "↑" : "↓" : "↕"}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gold-dim">
            {sortedRows.map(row => (
              <tr key={row.name} className="hover:bg-bg-hover transition-colors">
                <th scope="row" className="px-3 py-1 text-left font-semibold"><PlayerName row={row} /></th>
                {columns.slice(1).map(column => (
                  <td key={column.key} className={cn("whitespace-nowrap px-3 py-2.5 text-right", column.rate ? "text-text-secondary" : "text-text-primary")}>
                    {metricValue(row, column.key, column.rate)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
