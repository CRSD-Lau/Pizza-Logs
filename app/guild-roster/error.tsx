"use client";

export default function GuildRosterError() {
  return (
    <div className="pt-10">
      <div className="border border-gold-dim bg-bg-panel rounded p-6">
        <h1 className="heading-cinzel text-xl font-bold text-gold-light">Guild Roster Unavailable</h1>
        <p className="mt-2 max-w-xl text-sm text-text-secondary">
          The saved roster could not be loaded right now. Warmane sync errors are kept server-side; try again after the database is available.
        </p>
      </div>
    </div>
  );
}
