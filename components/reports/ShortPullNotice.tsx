import Link from "next/link";

interface Props {
  shortPulls: number;
  includeShortPulls: boolean;
  basePath: string;
}

export function ShortPullNotice({ shortPulls, includeShortPulls, basePath }: Props) {
  if (shortPulls === 0) return null;

  const target = new URL(basePath, "https://pizzalogs.local");
  if (includeShortPulls) target.searchParams.delete("includeShortPulls");
  else target.searchParams.set("includeShortPulls", "1");
  const href = `${target.pathname}${target.search}${target.hash}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-sm border border-gold-dim bg-bg-panel/40 px-4 py-2 text-sm">
      <p className="text-text-secondary">
        <span className="font-semibold text-text-primary">{shortPulls} short {shortPulls === 1 ? "pull" : "pulls"}</span>
        {includeShortPulls ? " included in counts." : " excluded from wipe and pull counts."}
        <span className="block text-xs">Under one minute with no recorded deaths. All original attempts remain available.</span>
      </p>
      <Link href={href} className="inline-flex min-h-11 items-center font-semibold text-gold hover:text-gold-light">
        {includeShortPulls ? "Exclude short pulls" : "Include short pulls"}
      </Link>
    </div>
  );
}
