import Link from "next/link";
import { PageHeader, PageSection, PageShell } from "@/components/ui/PageLayout";
import { buildPageMetadata } from "@/lib/page-metadata";
import { BUG_REPORT_URL, SECURITY_REPORT_URL } from "@/lib/upload-policy";

export const metadata = buildPageMetadata({ title: "Terms of use", description: "Using Pizza Logs, sharing combat logs, public reports and community-service limitations.", path: "/terms" });

export default function TermsPage() {
  return (
    <PageShell>
      <PageHeader eyebrow="Using Pizza Logs" title="Terms of use" description={<p>Updated September 8, 2026.</p>} />
      <div className="max-w-3xl space-y-8 text-base text-text-secondary">
        <PageSection title="About the service">
          <p>Pizza Logs is a community raid-analysis project maintained by Neil Mitchell for PizzaWarriors. It processes WoW/Warmane combat logs and displays public reports. It is not an official Blizzard Entertainment or Warmane service. Game names and assets belong to their respective owners.</p>
        </PageSection>
        <PageSection title="Sharing a combat log">
          <p>Only upload a genuine combat log you have permission to share publicly. Reports can display character and pet names, guild and realm information, raid activity and performance statistics. Do not upload credentials, personal documents, chat exports or information that should remain private.</p>
          <p className="mt-3">Follow the <Link href="/upload-policy" className="text-gold underline">upload rules</Link>, including supported file formats and processing limits. Each upload requires acknowledgement of those rules and public visibility. The acknowledgement does not verify your identity or establish the authenticity of the log.</p>
        </PageSection>
        <PageSection title="Acceptable use">
          <p>Do not submit malware, fabricated logs, injection payloads, unrelated files or spam. Do not attempt to bypass access controls or disrupt the service through repeated requests. Unsafe or non-compliant uploads may be rejected, and abusive reports may be removed.</p>
        </PageSection>
        <PageSection title="Accuracy, availability and your originals">
          <p>Reports are provided as-is. Bugs, incomplete logs, undocumented game behavior and unavailable upstream services can produce missing or incorrect results. Accuracy and uninterrupted availability are not guaranteed. Check important conclusions against your original log.</p>
          <p className="mt-3">Keep your own original files. Raw logs are processed temporarily and are not offered as downloads or a backup service. Interrupted uploads may need to be sent again. Processing limits can reject a file even when it is within the maximum upload size.</p>
        </PageSection>
        <PageSection title="Privacy, removal and reporting">
          <p>The <Link href="/privacy" className="text-gold underline">privacy notice</Link> describes data use, retention, cookies and third-party requests. For removal requests or privacy and security concerns, contact Neil through a <a href={SECURITY_REPORT_URL} className="text-gold underline">private GitHub security advisory</a>. Include the report URL and relevant in-game name; enough information may be needed to distinguish it from unrelated guild data.</p>
          <p className="mt-3">For a bug or incorrect result, <a href={BUG_REPORT_URL} className="text-gold underline">open a GitHub issue</a> with reproduction steps and a public report link. Keep private raw logs and credentials out of public issues.</p>
        </PageSection>
        <PageSection title="Changes">
          <p>Changes to these terms will appear on this page with an updated date. Material changes to upload rules are reflected in the version acknowledged before processing an upload.</p>
        </PageSection>
      </div>
    </PageShell>
  );
}
