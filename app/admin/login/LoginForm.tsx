"use client";

import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { AuthError, authErrorMessage, authInputClass, authLabelClass } from "../auth-form-ui";

export function LoginForm() {
  const [step, setStep] = useState<"password" | "authenticator" | "recovery">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== "password") codeInput.current?.focus();
  }, [step]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password, rememberMe: false });
      if (result.error) {
        setError(authErrorMessage(result.error, "We could not sign you in. Check your details and try again."));
        return;
      }
      if (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) {
        setCode("");
        setStep("authenticator");
      } else {
        // The server checks whether this is an enrollment or completed MFA session.
        window.location.replace("/admin/login");
      }
    } catch {
      setError("We could not sign you in. Please try again.");
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
      const result = step === "recovery"
        ? await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice: false })
        : await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
      if (result.error) {
        setError(authErrorMessage(result.error, "We could not verify that code. Try again, or sign in again if your request has expired."));
        return;
      }
      window.location.replace("/admin");
    } catch {
      setError("We could not verify that code. Please try again.");
    } finally {
      setCode("");
      setPending(false);
    }
  }

  function changeStep(next: typeof step) {
    setCode("");
    setPassword("");
    setError(null);
    setStep(next);
  }

  return (
    <div className="space-y-5">
      {step === "password" ? (
        <form method="post" onSubmit={signIn} className="space-y-4" aria-busy={pending}>
          <div className="space-y-1.5">
            <label htmlFor="admin-email" className={authLabelClass}>Email address</label>
            <input id="admin-email" name="email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} className={authInputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="admin-password" className={authLabelClass}>Password</label>
            <input id="admin-password" name="password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} className={authInputClass} />
          </div>
          <AuthError message={error} />
          <Button type="submit" disabled={pending || !email.trim() || !password} className="w-full">{pending ? "Signing in…" : "Continue"}</Button>
        </form>
      ) : (
        <form method="post" onSubmit={verify} className="space-y-4" aria-busy={pending}>
          <div className="space-y-1.5">
            <label htmlFor="admin-code" className={authLabelClass}>{step === "recovery" ? "Recovery code" : "Authenticator code"}</label>
            <p id="admin-code-help" className="text-sm text-text-secondary">{step === "recovery" ? "Enter one of the recovery codes you saved. Each code works once." : "Enter the six-digit code from your authenticator app."}</p>
            <input ref={codeInput} key={step} id="admin-code" name="code" type="text" inputMode={step === "recovery" ? "text" : "numeric"} autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} required maxLength={step === "recovery" ? 64 : 6} pattern={step === "recovery" ? undefined : "[0-9]{6}"} value={code} onChange={(event) => setCode(step === "recovery" ? event.target.value : event.target.value.replace(/\D/g, "").slice(0, 6))} disabled={pending} aria-describedby="admin-code-help" className={`${authInputClass} font-mono tracking-wider`} />
          </div>
          <AuthError message={error} />
          <Button type="submit" disabled={pending || !code.trim()} className="w-full">{pending ? "Verifying…" : "Sign in"}</Button>
          <div className="flex flex-col gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => changeStep(step === "recovery" ? "authenticator" : "recovery")}>{step === "recovery" ? "Use authenticator instead" : "Use a recovery code"}</Button>
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => changeStep("password")}>Start sign in again</Button>
          </div>
        </form>
      )}
      <p className="border-t border-gold-dim pt-4 text-sm text-text-secondary">This account is created privately. If you lose access to both your authenticator and recovery codes, follow the account recovery instructions supplied during setup.</p>
    </div>
  );
}
