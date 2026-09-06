import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getWeekBounds(date: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(date);
  // WoW resets on Wednesday
  const day = d.getUTCDay(); // 0=Sun, 3=Wed
  const daysToWed = (day < 3 ? day + 4 : day - 3);
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - daysToWed);
  start.setUTCHours(9, 0, 0, 0); // reset at 09:00 UTC
  if (start > date) start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}

type DisplayNumber = number | null | undefined;
type DisplayDate = string | Date | null | undefined;

export const UNAVAILABLE_VALUE = "-";
const integerFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
const timestampFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "UTC",
});

export function isDisplayNumber(value: DisplayNumber): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Discrete counts, positions and gear identifiers retain whole grouped digits. */
export function formatInteger(value: DisplayNumber): string {
  return isDisplayNumber(value) ? integerFormat.format(value === 0 ? 0 : value) : UNAVAILABLE_VALUE;
}

/** Fixed two-decimal measurements without magnitude suffixes (percentages and seconds). */
export function formatDecimal(value: DisplayNumber): string {
  if (!isDisplayNumber(value)) return UNAVAILABLE_VALUE;
  if (value > 0 && value < 0.01) return "<0.01";
  if (value < 0 && value > -0.01) return ">-0.01";
  return decimalFormat.format(value === 0 ? 0 : value);
}

/** Input is a percentage (25), not a fraction (0.25). */
export function formatPercent(value: DisplayNumber): string {
  return isDisplayNumber(value) ? `${formatDecimal(value)}%` : UNAVAILABLE_VALUE;
}

/** One metric format across cards, rows, charts and previews; K/M are the only suffixes. */
export function formatCompactNumber(value: DisplayNumber): string {
  if (!isDisplayNumber(value)) return UNAVAILABLE_VALUE;
  const magnitude = Math.abs(value);
  let divisor = magnitude >= 1_000_000 ? 1_000_000 : magnitude >= 1_000 ? 1_000 : 1;
  // Choose the unit after decimal rounding so a boundary never renders as 1,000.00K.
  const roundedMagnitude = Number(decimalFormat.format(magnitude / divisor).replaceAll(",", ""));
  if (divisor < 1_000_000 && roundedMagnitude >= 1_000) divisor *= 1_000;
  const suffix = divisor === 1_000_000 ? "M" : divisor === 1_000 ? "K" : "";
  return `${formatDecimal(value / divisor)}${suffix}`;
}

export const formatRate = formatCompactNumber;

export function formatCountLabel(value: number, singular: string, plural = `${singular}s`): string {
  return `${formatInteger(value)} ${value === 1 ? singular : plural}`;
}

export function formatSeconds(value: DisplayNumber): string {
  return isDisplayNumber(value) && value >= 0 ? `${formatDecimal(value)} s` : UNAVAILABLE_VALUE;
}

export function formatBytes(bytes: DisplayNumber): string {
  if (!isDisplayNumber(bytes) || bytes < 0) return UNAVAILABLE_VALUE;
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let unit = 0;
  let amount = bytes;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit++;
  }
  // Promote when rounding would otherwise display 1,024 of the smaller unit.
  if (Number(decimalFormat.format(amount).replaceAll(",", "")) >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit++;
  }
  return `${unit === 0 ? formatInteger(amount) : decimalFormat.format(amount)} ${units[unit]}`;
}

export function formatDuration(seconds: DisplayNumber): string {
  if (!isDisplayNumber(seconds) || seconds < 0) return UNAVAILABLE_VALUE;
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const m = Math.floor((wholeSeconds % 3600) / 60);
  const s = wholeSeconds % 60;
  return `${hours > 0 ? `${hours}:${String(m).padStart(2, "0")}` : m}:${String(s).padStart(2, "0")}`;
}

export function formatDurationPrecise(milliseconds: DisplayNumber): string {
  if (!isDisplayNumber(milliseconds) || milliseconds < 0) return UNAVAILABLE_VALUE;
  const totalMilliseconds = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMilliseconds % 60_000) / 1_000);
  const millis = totalMilliseconds % 1_000;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function displayDate(value: DisplayDate): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatDateUtc(value: DisplayDate): string {
  const date = displayDate(value);
  return date ? dateFormat.format(date) : UNAVAILABLE_VALUE;
}

export function formatDateTimeUtc(value: DisplayDate): string {
  const date = displayDate(value);
  return date ? `${timestampFormat.format(date)} UTC` : UNAVAILABLE_VALUE;
}

export function formatTimeUtc(value: DisplayDate): string {
  const date = displayDate(value);
  return date ? `${timeFormat.format(date)} UTC` : UNAVAILABLE_VALUE;
}

export function formatDateTimeRangeUtc(start: DisplayDate, end: DisplayDate): string {
  const first = displayDate(start);
  const last = displayDate(end);
  if (!first || !last) return UNAVAILABLE_VALUE;
  const firstDate = dateFormat.format(first);
  const lastDate = dateFormat.format(last);
  return `${firstDate}, ${timeFormat.format(first)} – ${firstDate === lastDate ? "" : `${lastDate}, `}${timeFormat.format(last)} UTC`;
}

/** Only for newly derived display rates. Stored participant rates are left intact. */
export function getRecordedDurationSeconds(value: { durationMs?: DisplayNumber; durationSeconds?: DisplayNumber }): number | null {
  if (value.durationMs != null && value.durationMs !== 0) {
    return isDisplayNumber(value.durationMs) && value.durationMs > 0 ? value.durationMs / 1000 : null;
  }
  if (isDisplayNumber(value.durationSeconds) && value.durationSeconds > 0) return value.durationSeconds;
  return null;
}

// Retained names keep existing imports compatible with the shared presentation contract.
export const formatNumber = formatCompactNumber;
export const formatDps = formatRate;
export const formatShortDateUtc = formatDateUtc;
