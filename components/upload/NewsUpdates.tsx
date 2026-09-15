import { PageSection } from "@/components/ui/PageLayout";

// Keep newest first. Summarize shipped changes from CHANGELOG.md for uploaders.
const entries = [
  {
    date: "2026-09-13",
    label: "Sep 13, 2026",
    category: "Update",
    title: "Explore reports by realm",
    description: "Choose a realm on Raids, Players, Bosses, Leaderboards or This Week to see its reports and rankings. Your selection follows you between pages and in shared links. You can still view all realms, and existing uploads need no re-upload.",
  },
  {
    date: "2026-09-12",
    label: "Sep 12, 2026",
    category: "Update",
    title: "Read Pizza Logs in your language",
    description: "Use the language selector beside player search to open a translated version of the current page, with your filters preserved.",
  },
  {
    date: "2026-09-12",
    label: "Sep 12, 2026",
    category: "Update",
    title: "Cleaner raid counts and weekly rankings",
    description: "Wipes under 60 seconds are hidden from default encounter lists and counts. Include short pulls brings them back. Weekly DPS and HPS rankings now show each player once, using their best qualifying attempt.",
  },
  {
    date: "2026-09-06",
    label: "Sep 6, 2026",
    category: "News",
    title: "Pizza Logs 1.0 is here",
    description: "Our first stable release brings Warmane raid reports, boss breakdowns and player analytics together. Upload a combat log to explore your raid's damage, healing and boss fights.",
  },
] as const;

export function NewsUpdates() {
  return (
    <PageSection
      id="news"
      title="News & Updates"
      description="The latest changes to Pizza Logs."
      action={
        <a
          href="https://github.com/CRSD-Lau/Pizza-Logs/blob/main/CHANGELOG.md"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-gold hover:text-gold-light"
        >
          Full changelog <span className="sr-only">(opens in a new tab)</span>&nbsp;&rarr;
        </a>
      }
    >
      <aside
        aria-labelledby="icecrown-guid-warning-title"
        className="mb-6 rounded-sm border border-warning/50 bg-warning/10 px-4 py-4"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-warning">Active warning</p>
        <h3 id="icecrown-guid-warning-title" className="mt-1 text-base font-semibold text-heading">
          Icecrown player metrics may show zero
        </h3>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary">
          Some Icecrown uploads are affected by a player GUID parsing bug and may show zero damage or healing. I am
          currently waiting for a small combat-log sample to investigate the affected format further. Please keep your
          original log so it can be uploaded again after a fix. Follow progress in{" "}
          <a
            href="https://github.com/CRSD-Lau/Pizza-Logs/issues/126"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-warning underline decoration-warning/50 underline-offset-2 hover:text-gold-light"
          >
            bug report #126<span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
        </p>
      </aside>

      <ul className="divide-y divide-gold-dim">
        {entries.map((entry) => (
          <li key={entry.title} className="grid gap-2 py-5 first:pt-0 last:pb-0 sm:grid-cols-[9rem_1fr] sm:gap-6">
            <div className="flex items-center gap-3 text-xs sm:flex-col sm:items-start sm:gap-2">
              <span className="font-semibold uppercase tracking-wide text-gold">{entry.category}</span>
              <time dateTime={entry.date} className="text-text-secondary">{entry.label}</time>
            </div>
            <div>
              <h3 className="text-base font-semibold text-heading">{entry.title}</h3>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary">{entry.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </PageSection>
  );
}
