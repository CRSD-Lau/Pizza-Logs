import { randomInt } from "node:crypto";

export const PUBLIC_REPORT_CODE_LENGTH = 7;

// Crockford-style lowercase base32: URL-safe and avoids i, l, o, and u.
const PUBLIC_REPORT_CODE_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const PUBLIC_REPORT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-hjkmnp-tv-z]{7}$/;

function slugifyReportLabel(label: string): string {
  const slug = label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");

  return slug || "raid";
}

export function createPublicReportSlug(
  label: string,
  pickIndex: (upperBound: number) => number = upperBound => randomInt(upperBound),
): string {
  const code = Array.from(
    { length: PUBLIC_REPORT_CODE_LENGTH },
    () => PUBLIC_REPORT_CODE_ALPHABET[pickIndex(PUBLIC_REPORT_CODE_ALPHABET.length)],
  ).join("");

  return `${slugifyReportLabel(label)}-${code}`;
}

export function isPublicReportSlug(value: string): boolean {
  return PUBLIC_REPORT_SLUG_PATTERN.test(value);
}
