"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export const authInputClass = "min-h-11 w-full rounded-sm border border-gold-dim bg-bg-deep px-3 py-2 text-base text-text-primary placeholder:text-text-dim focus:outline-hidden focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/50 disabled:opacity-60";
export const authLabelClass = "block text-sm font-medium text-text-secondary";

export function authErrorMessage(error: { status?: number; code?: string }, fallback: string): string {
  if (error.status === 429) return "Too many attempts. Please wait before trying again.";
  if (error.code === "FRESH_MFA_REQUIRED") return "For your security, sign out and sign in again before making this change.";
  return fallback;
}

export function AuthError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-sm border border-danger/50 bg-danger/10 p-3 text-sm text-red-300">{message}</p> : null;
}

export function RecoveryCodes({ codes, onSaved, pending = false, buttonLabel = "I have saved these codes" }: {
  codes: string[];
  onSaved: () => void;
  pending?: boolean;
  buttonLabel?: string;
}) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { heading.current?.focus(); }, []);

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopyStatus("Recovery codes copied. Save them in a safe place.");
    } catch {
      setCopyStatus("Copy is unavailable. Select the codes and save them manually.");
    }
  }

  return (
    <section aria-labelledby="recovery-codes-title" className="space-y-4">
      <div className="space-y-2">
        <h2 ref={heading} tabIndex={-1} id="recovery-codes-title" className="text-lg font-semibold text-text-primary focus:outline-hidden">Save your recovery codes</h2>
        <p className="text-sm text-text-secondary">Each code can be used once if you cannot access your authenticator. This is the only time these codes will be shown. Keep them in a safe place, such as your password manager.</p>
      </div>
      <ul aria-label="Recovery codes" className="grid grid-cols-1 gap-2 rounded-sm border border-gold-dim bg-bg-deep p-4 min-[360px]:grid-cols-2">
        {codes.map((code) => <li key={code} className="break-all font-mono text-sm text-text-primary">{code}</li>)}
      </ul>
      <Button type="button" size="sm" onClick={copyCodes} disabled={pending}>Copy codes</Button>
      <p role="status" className="text-sm text-text-secondary">{copyStatus}</p>
      <label className="flex cursor-pointer items-start gap-3 text-sm text-text-secondary">
        <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} disabled={pending} className="mt-0.5 size-4 shrink-0 accent-gold" />
        <span>I have saved these recovery codes somewhere safe.</span>
      </label>
      <Button type="button" onClick={onSaved} disabled={!saved || pending} className="w-full">{pending ? "Finishing…" : buttonLabel}</Button>
    </section>
  );
}
