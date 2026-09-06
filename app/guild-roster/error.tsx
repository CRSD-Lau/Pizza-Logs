"use client";

import { PageHeader, PageShell } from "@/components/ui/PageLayout";

export default function GuildRosterError() {
  return (
    <PageShell>
      <PageHeader
        title="Guild Roster Unavailable"
        description="The saved roster could not be loaded right now. Please try again shortly."
      />
    </PageShell>
  );
}
