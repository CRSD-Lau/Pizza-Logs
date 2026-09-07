import Link from "next/link";
import { PageHeader, PageSection, PageShell } from "@/components/ui/PageLayout";
import { buildPageMetadata } from "@/lib/page-metadata";
import { MAX_UPLOAD_SIZE_LABEL } from "@/lib/upload-security";
import { BUG_REPORT_URL, PRIVACY_NOTICE_URL, SECURITY_REPORT_URL, UPLOAD_POLICY_VERSION } from "@/lib/upload-policy";

export const metadata = buildPageMetadata({ title: "Upload rules and reporting", description: "Combat-log upload rules, public data notice and how to report a bug in Pizza Logs.", path: "/upload-policy" });

export default function UploadPolicyPage() {
  return (
    <PageShell>
      <PageHeader eyebrow="Using Pizza Logs" title="Upload rules and reporting" description={<p>Read these rules before uploading. Updated {UPLOAD_POLICY_VERSION}.</p>} />
      <div className="max-w-3xl space-y-8 text-base text-text-secondary">
        <PageSection title="Only upload combat logs">
          <ul className="list-disc space-y-2 pl-5">
            <li>Upload a genuine WoW/Warmane combat log you have permission to share: a plain <code>.txt</code> or <code>.log</code> file, or a ZIP containing exactly one such log.</li>
            <li>The uploaded file must be at most {MAX_UPLOAD_SIZE_LABEL}. A ZIP may expand to at most 1 GiB. ZIP is recommended for faster uploads. Processing limits still apply; split longer recordings into separate valid logs if needed.</li>
            <li>Do not include programs, scripts, malware, unrelated files, nested archives or password-protected content. Do not send fabricated logs, injection payloads, spam or repeated requests intended to disrupt the service.</li>
            <li>Do not upload account credentials, chat exports, personal documents or other private information. A renamed file is still subject to content checks.</li>
          </ul>
        </PageSection>
        <PageSection title="Your report is public">
          <p>Uploading publishes in-game character names, guild and realm information, raid activity and performance statistics. Only continue if you are allowed to share that information publicly.</p>
          <p className="mt-3">Raw files are processed temporarily and are not offered as public downloads. Parsed reports remain until a maintainer removes them. Keep your own original: an interrupted upload may need to be sent again.</p>
          <p className="mt-3">See the <a href={PRIVACY_NOTICE_URL} className="text-gold underline">privacy notice</a> for retention and removal requests. Unsafe or non-compliant uploads may be rejected, and abusive reports may be removed.</p>
        </PageSection>
        <PageSection title="Bugs and incorrect results">
          <p>Pizza Logs is a community project. Bugs, incomplete logs and undocumented game behavior can produce missing or incorrect results. Reports are provided as-is; accuracy and uninterrupted availability are not guaranteed.</p>
          <p className="mt-3">If something looks wrong, <a href={BUG_REPORT_URL} className="text-gold underline">report a bug on GitHub</a> for Neil to review. Include what happened, what you expected, steps to reproduce, your browser/device and a public report link if available. Remove private details from screenshots, and do not attach private raw logs.</p>
          <p className="mt-3">Report suspected security vulnerabilities or privacy concerns through a <a href={SECURITY_REPORT_URL} className="text-gold underline">private security advisory</a>.</p>
        </PageSection>
        <PageSection title="Acceptance and security checks">
          <p>Before each upload, the checkbox confirms that you have permission to share the log, accept these upload rules and understand that the report is public. The server also requires the current policy version. This acknowledgement does not verify the uploader&apos;s identity or prove that a file is authentic.</p>
          <p className="mt-3">File-type, content, archive and resource checks reduce risk. They are not an antivirus scan or a guarantee that every malicious file or attack will be detected.</p>
        </PageSection>
        <Link href="/" className="inline-flex min-h-11 items-center text-gold underline">Return to upload</Link>
      </div>
    </PageShell>
  );
}
