import { USERSCRIPT_URL } from "@/lib/armory-gear-client-scripts";

export function GearImportBookmarklet() {
  return (
    <div className="rounded border border-gold-dim bg-bg-card p-4 space-y-3">
      <div>
        <h3 className="heading-cinzel text-sm text-gold tracking-wide">Browser Gear Import</h3>
        <p className="text-sm text-text-secondary mt-1">
          Install the hosted userscript with Tampermonkey, then open Warmane Armory. It adds a
          small Pizza Logs sync panel and automatically imports missing or unenriched players
          through Warmane&apos;s browser-accessible API. The admin secret is stored in browser
          localStorage on Warmane so auto-sync can run.
        </p>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-text-secondary">
        <li>Install Tampermonkey or another userscript manager.</li>
        <li>Open the hosted install URL below and accept the install/update prompt.</li>
        <li>Open any Warmane Armory character page and click Sync now once to save the admin secret.</li>
        <li>After that, visiting Warmane Armory will auto-sync at most once per hour.</li>
      </ol>
      <div className="space-y-2">
        <a
          href={USERSCRIPT_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded border border-gold-dim px-4 py-2 text-sm text-gold transition-colors hover:border-gold hover:text-gold-light"
        >
          Install / Update Userscript
        </a>
        <label className="block text-xs font-bold uppercase tracking-widest text-text-dim">
          Hosted install URL
        </label>
        <textarea
          readOnly
          rows={2}
          value={USERSCRIPT_URL}
          className="w-full rounded border border-gold-dim bg-bg-deep p-3 font-mono text-xs text-text-secondary"
        />
      </div>
    </div>
  );
}
