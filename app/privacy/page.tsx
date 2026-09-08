import Link from "next/link";
import { PageHeader, PageSection, PageShell } from "@/components/ui/PageLayout";
import { buildPageMetadata } from "@/lib/page-metadata";
import { SECURITY_REPORT_URL } from "@/lib/upload-policy";

export const metadata = buildPageMetadata({ title: "Privacy notice", description: "How Pizza Logs handles combat logs, public reports, cookies, third-party requests and removal requests.", path: "/privacy" });

export default function PrivacyPage() {
  return (
    <PageShell>
      <PageHeader eyebrow="Using Pizza Logs" title="Privacy notice" description={<p>Updated September 8, 2026. Maintained by Neil Mitchell.</p>} />
      <div className="max-w-3xl space-y-8 text-base text-text-secondary">
        <p>Pizza Logs is a community raid-analysis service for PizzaWarriors. Public visitors do not have accounts. One private administrator account protects maintenance access; there is no advertising SDK or payment flow.</p>
        <PageSection title="Data processed">
          <p>When you upload a combat log, Pizza Logs processes:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>The file&apos;s base filename, byte size and SHA-256 hash.</li>
            <li>The required uploader character name, optional guild label, and selected realm, host and expansion values.</li>
            <li>In-game character and pet names, timestamps, combat events, raid composition, encounters and derived performance statistics.</li>
          </ul>
          <p className="mt-3">Pizza Logs also stores public PizzaWarriors roster information and cached Warmane character equipment and profile data. It does not intentionally request or store visitors&apos; Battle.net/Warmane passwords, email addresses, payment information or real-world identity documents.</p>
          <p className="mt-3">Private administration stores the designated administrator&apos;s email and name, a password hash, encrypted authenticator and recovery-code material, and session records that can include IP address and user agent. Short-lived authentication challenges, rate-limit records and keyed code-reuse fingerprints support sign-in security. Plaintext login passwords are not stored. No email is sent and no external authentication provider receives these credentials.</p>
        </PageSection>
        <PageSection title="How data is used">
          <p>Data is used to detect duplicate uploads, parse and display raid reports, calculate records and weekly summaries, provide player and gear views, and operate or troubleshoot the service.</p>
          <p className="mt-3">Raw upload bytes are written temporarily by the parser during processing, then removed after completion or cleanup. The database keeps the parsed report and upload metadata; it does not keep a downloadable copy of the raw combat log.</p>
          <p className="mt-3">Each upload requires acknowledgement of the current upload rules and public visibility notice. The server checks the submitted policy version before processing. This is a request-level acknowledgement, not a verified identity or a separately retained consent record. Upload admission counters are held in process memory; this upload throttle does not store IP addresses or add tracking cookies. Original upload filenames remain in administrator metadata and are omitted from public encounter APIs.</p>
        </PageSection>
        <PageSection title="Public visibility">
          <p>Raid reports, in-game character names, roster data, gear snapshots and performance statistics are public. Do not upload a log if those game identifiers should not appear publicly. Admin diagnostics and maintenance controls are not public. Read the <Link href="/upload-policy" className="text-gold underline">upload rules</Link> before sharing a log.</p>
        </PageSection>
        <PageSection title="Infrastructure and third-party requests">
          <ul className="list-disc space-y-3 pl-5">
            <li>Railway hosts the application, parser and production infrastructure and may process ordinary request logs such as IP address and user agent. PostgreSQL stores application data within the deployed environment.</li>
            <li>Pizza Logs servers query Warmane for public roster, character, model and gear information. Your browser also requests game icons directly from <code>cdn.warmane.com</code> and, for some item icons, <code>wow.zamimg.com</code>.</li>
            <li>When a 3D character model is displayed, its browser viewer loads jQuery from Google&apos;s <code>ajax.googleapis.com</code> and rendering scripts, models and textures from <code>cdn.warmane.com</code>. These are direct browser requests, separate from the server-side Armory queries.</li>
            <li>Direct browser requests disclose ordinary connection information, including your IP address and browser request headers, to the provider receiving them. Those providers control their own handling and retention. Pizza Logs does not send raw combat logs or administrator credentials to these image or model providers.</li>
            <li>GitHub hosts the source repository, issues, pull requests and private security reports. Following a GitHub link takes you to that service.</li>
          </ul>
          <p className="mt-3">The site&apos;s interface fonts are served by Pizza Logs. Pizza Logs does not sell personal information and does not include a third-party advertising or behavioral analytics SDK.</p>
        </PageSection>
        <PageSection title="Cookies and browser storage">
          <p>Ordinary public report browsing does not require an application account cookie. Admin sign-in uses essential session and temporary challenge cookies with HttpOnly and SameSite=Strict; public HTTPS cookies are always Secure. Full admin sessions expire after eight hours and sign-out revokes the stored session.</p>
          <p className="mt-3">Pizza Logs does not store behavioral analytics identifiers in browser storage. Third-party browser requests are described above.</p>
        </PageSection>
        <PageSection title="Retention and removal">
          <p>Parsed reports and cached game data remain until a maintainer deletes them; there is currently no automatic public-report expiration period. Temporary or incomplete parser uploads are cleaned after processing or abandonment. Hosting-provider logs and backups follow the provider&apos;s operational retention.</p>
          <p className="mt-3">The private administrator identity and credentials remain until replaced or removed through operator maintenance. Session expiration ends authorization but does not promise immediate physical deletion of every expired database row. Expired challenge and code-reuse records, and rate-limit records older than 24 hours, are removed opportunistically during authentication requests. Password changes, session revocation and operator recovery invalidate the relevant current authentication records. Backups can retain older records until those backups expire. Operator restore procedures require renewed admin enrollment before restored administration is exposed.</p>
          <p className="mt-3">To request removal of a report or raise a privacy concern, contact Neil privately through a <a href={SECURITY_REPORT_URL} className="text-gold underline">GitHub security advisory</a> and identify the report URL and relevant in-game name. A request may require enough information to distinguish the report from unrelated guild data. Keep private raw logs and credentials out of public issues.</p>
        </PageSection>
        <PageSection title="Changes">
          <p>Material changes to data collection, public visibility or retention will be reflected on this page and in the project changelog. See also the <Link href="/terms" className="text-gold underline">terms of use</Link>.</p>
        </PageSection>
      </div>
    </PageShell>
  );
}
