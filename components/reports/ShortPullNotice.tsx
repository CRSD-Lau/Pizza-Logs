import Link from "next/link";
import { formatCountLabel } from "@/lib/utils";

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
    <details className="border-y border-gold-dim text-sm text-text-secondary">
      <summary className="min-h-11 cursor-pointer py-3 marker:text-gold">
        <span className="font-semibold text-text-primary">{formatCountLabel(shortPulls, "short pull")}</span>
        {includeShortPulls ? " included in counts" : " excluded from counts"}
        {" "}<span className="ml-2 text-gold">Details</span>
      </summary>
      <div className="pb-3 pl-4">
        <p>Wipes under one minute with no recorded deaths are excluded from wipe and pull counts by default. Short successful kills still count. All original attempts remain available.</p>
        <Link href={href} className="inline-flex min-h-11 items-center font-semibold text-gold hover:text-gold-light">
          {includeShortPulls ? "Exclude short pulls" : "Include short pulls"}
        </Link>
      </div>
    </details>
  );
}
