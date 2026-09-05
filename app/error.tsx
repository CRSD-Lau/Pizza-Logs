"use client";

import Link from "next/link";
import { PageHeader, PageShell } from "@/components/ui/PageLayout";
import { Button, buttonVariants } from "@/components/ui/Button";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <PageShell>
      <PageHeader title="This page could not load" description="Please try again. If it still fails, return to the raid list or come back shortly." />
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => retry()} variant="solid">Try again</Button>
        <Link href="/raids" className={buttonVariants({ variant: "ghost" })}>Browse raids</Link>
      </div>
    </PageShell>
  );
}
