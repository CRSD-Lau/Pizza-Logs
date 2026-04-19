import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getWeekBounds(date: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(date);
  // WoW resets on Wednesday
  const day = d.getUTCDay(); // 0=Sun, 3=Wed
  const daysToWed = (day < 3 ? day + 4 : day - 3);
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - daysToWed);
  start.setUTCHours(9, 0, 0, 0); // reset at 09:00 UTC
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatDps(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(3)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(0);
}

export function rankSuffix(n: number): string {
  if (n === 1) return "st";
  if (n === 2) return "nd";
  if (n === 3) return "rd";
  return "th";
}

export function difficultyLabel(diff: string): string {
  return diff; // "10N", "10H", "25N", "25H"
}

export function difficultyColor(diff: string): string {
  if (diff.endsWith("H")) return "#e06030";
  return "#9a8f78";
}

export function outcomeColor(outcome: string): string {
  if (outcome === "KILL") return "#50a050";
  if (outcome === "WIPE") return "#c84040";
  return "#5a5548";
}
