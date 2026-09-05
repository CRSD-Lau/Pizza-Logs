import { WOW_CLASSES } from "./constants/classes";
import { sanitizePlayerSearchQuery } from "./player-search";

export type DirectoryQueryValue = string | string[] | undefined;
export type DirectoryFilters = { query: string; classFilter: string | undefined };

function firstValue(value: DirectoryQueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseDirectoryFilters(params: { q?: DirectoryQueryValue; class?: DirectoryQueryValue }): DirectoryFilters {
  const selectedClass = firstValue(params.class)?.trim().toLowerCase();
  return {
    query: sanitizePlayerSearchQuery(firstValue(params.q)),
    classFilter: WOW_CLASSES.find(value => value.toLowerCase() === selectedClass),
  };
}

export function parseDirectoryPage(value: DirectoryQueryValue): number {
  const raw = firstValue(value) ?? "";
  if (!/^[1-9]\d*$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) ? page : 1;
}

export function getDirectoryPagination(total: number, requestedPage: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  return {
    currentPage, totalPages, startIndex,
    firstVisible: total > 0 ? startIndex + 1 : 0,
    lastVisible: Math.min(startIndex + pageSize, total),
  };
}

export function directoryNameMatches(name: string, query: string): boolean {
  return name.toLocaleLowerCase("en-US").includes(query.toLocaleLowerCase("en-US"));
}

export function buildDirectoryHref(path: string, options: {
  query?: string; classFilter?: string; page?: number; includeShortPulls?: boolean;
} = {}): string {
  const params = new URLSearchParams();
  if (options.query) params.set("q", options.query);
  if (options.classFilter) params.set("class", options.classFilter);
  if (options.page && options.page > 1) params.set("page", String(options.page));
  if (options.includeShortPulls) params.set("includeShortPulls", "1");
  return params.size ? `${path}?${params}` : path;
}
