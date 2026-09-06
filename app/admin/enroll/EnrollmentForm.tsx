"use client";

import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { AuthError, RecoveryCodes, authErrorMessage, authInputClass, authLabelClass } from "../auth-form-ui";

export function EnrollmentForm({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<{ secret: string; recoveryCodes: string[] } | null>(null);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (setup?.secret) codeInput.current?.focus();
  }, [setup?.secret]);

  async function begin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.enable({ password, method: "totp" });
      if (result.error) {
        setError(authErrorMessage(result.error, "We could not start setup. Check your password, or sign in again if your session has expired."));
        return;
      }
      if (result.data.method !== "totp") {
        setError("We could not start setup. Please try again.");
        return;
      }
      const uri = new URL(result.data.totpURI);
      const secret = uri.searchParams.get("secret");
      if (uri.protocol !== "otpauth:" || !secret || !/^[A-Z2-7]+=*$/i.test(secret) || !result.data.backupCodes.length) {
        setError("We could not start setup. Please try again.");
        return;
      }
      setSetup({ secret, recoveryCodes: result.data.backupCodes });
    } catch {
      setError("We could not start setup. Please try again.");
    } finally {
      setPassword("");
      setPending(false);
    }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
      if (result.error) {
        setError(authErrorMessage(result.error, "We could not verify that code. Check your authenticator and try again."));
        return;
      }
      setSetup((current) => current ? { secret: "", recoveryCodes: current.recoveryCodes } : null);
      setCopyStatus(null);
      setVerified(true);
    } catch {
      setError("We could not verify that code. Please try again.");
    } finally {
      setCode("");
      setPending(false);
    }
  }

  async function finish() {
    setPending(true);
    setSetup(null);
    // Enrollment verification has already revoked the setup session on the server.
    try { await authClient.signOut(); } catch { /* The revoked session cannot grant access. */ }
    window.location.replace("/admin/login");
  }

  async function cancel() {
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("We could not sign you out. Please try again.");
        return;
      }
      setSetup(null);
      setPassword("");
      window.location.replace("/admin/login");
    } catch {
      setError("We could not sign you out. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function copySecret() {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopyStatus("Setup key copied. Add it to your authenticator app.");
    } catch {
      setCopyStatus("Copy is unavailable. Select and enter the setup key manually.");
    }
  }

  if (verified && !setup) return <p role="status" className="text-sm text-text-secondary">Finishing setup…</p>;

  if (verified && setup) return (
    <div className="space-y-4">
      <p role="status" className="text-sm text-text-secondary">Your authenticator is ready. Save your recovery codes, then sign in again. Wait for your app to show a new code before using it, or use one of your recovery codes.</p>
      <RecoveryCodes codes={setup.recoveryCodes} onSaved={finish} pending={pending} buttonLabel="Finish and sign in" />
    </div>
  );

  return (
    <div className="space-y-5">
      {!setup ? (
        <form method="post" onSubmit={begin} className="space-y-4" aria-busy={pending}>
          <p className="text-sm text-text-secondary">Confirm your password to create a setup key. Admin access stays locked until you finish setup and sign in again.</p>
          <div className="space-y-1.5">
            <label htmlFor="enrollment-password" className={authLabelClass}>Password</label>
            <input id="enrollment-password" name="password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} className={authInputClass} />
          </div>
          <AuthError message={error} />
          <Button type="submit" disabled={pending || !password} className="w-full">{pending ? "Starting setup…" : "Set up authenticator"}</Button>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-text-primary">Add this account to your app</h2>
            <p className="text-sm text-text-secondary">In your authenticator app, choose to enter a setup key manually. Use the account details below and select time-based codes.</p>
            <dl className="space-y-3 rounded-sm border border-gold-dim bg-bg-deep p-4 text-sm">
              <div><dt className="text-text-secondary">Account</dt><dd className="break-all text-text-primary">Pizza Logs - {email}</dd></div>
              <div><dt className="text-text-secondary">Setup key</dt><dd className="mt-1 break-all font-mono text-base text-text-primary">{setup.secret}</dd></div>
              <div><dt className="text-text-secondary">Code settings</dt><dd className="text-text-primary">Time-based · 6 digits · changes every 30 seconds</dd></div>
            </dl>
            <Button type="button" size="sm" onClick={copySecret} disabled={pending}>Copy setup key</Button>
            <p role="status" className="text-sm text-text-secondary">{copyStatus}</p>
          </div>
          <form method="post" onSubmit={verify} className="space-y-4" aria-busy={pending}>
            <div className="space-y-1.5">
              <label htmlFor="enrollment-code" className={authLabelClass}>Authenticator code</label>
              <input ref={codeInput} id="enrollment-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} disabled={pending} className={`${authInputClass} font-mono tracking-wider`} />
            </div>
            <AuthError message={error} />
            <Button type="submit" disabled={pending || code.length !== 6} className="w-full">{pending ? "Verifying…" : "Verify authenticator"}</Button>
          </form>
        </div>
      )}
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={cancel} className="w-full">Sign out and finish later</Button>
    </div>
  );
}
