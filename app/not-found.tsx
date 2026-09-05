import Link from "next/link";
import { PageHeader, PageShell } from "@/components/ui/PageLayout";
import { buttonVariants } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <PageShell>
      <PageHeader title="Page not found" description="This link may be incomplete, or the report may have been removed. Find another raid or player below." />
      <div className="flex flex-wrap gap-3">
        <Link href="/raids" className={buttonVariants({ variant: "solid" })}>Browse raids</Link>
        <Link href="/players" className={buttonVariants({ variant: "ghost" })}>Find a player</Link>
      </div>
    </PageShell>
  );
}
