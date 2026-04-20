"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { verifyAdminSecret } from "./actions";

export default function AdminLoginPage() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!secret.trim()) return;

    setLoading(true);
    const valid = await verifyAdminSecret(secret.trim());

    if (valid) {
      document.cookie = `x-admin-secret=${secret.trim()}; path=/; SameSite=Strict`;
      window.location.href = "/admin";
    } else {
      setError(true);
      setSecret("");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo / title */}
        <div className="text-center space-y-2">
          <h1 className="heading-cinzel text-3xl font-bold text-gold-light text-glow-gold tracking-widest">
            PIZZA LOGS
          </h1>
          <p className="text-text-dim text-sm tracking-wide uppercase">Admin Access</p>
        </div>

        {/* Card */}
        <div className="bg-bg-panel border border-gold-dim rounded p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="secret" className="text-xs text-text-dim uppercase tracking-widest">
                Admin Secret
              </label>
              <input
                id="secret"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={secret}
                onChange={(e) => { setSecret(e.target.value); setError(false); }}
                placeholder="Enter secret"
                className="w-full bg-bg-deep border border-gold-dim rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-gold transition-colors"
              />
              {error && (
                <p className="text-xs text-danger">Incorrect secret. Try again.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!secret.trim() || loading}
              className="w-full bg-gold/10 hover:bg-gold/20 border border-gold-mid text-gold-light heading-cinzel text-sm tracking-widest py-2 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Verifying…" : "Enter"}
            </button>
          </form>
        </div>

        {/* Back link */}
        <p className="text-center text-sm text-text-dim">
          <Link href="/" className="text-gold-dim hover:text-gold transition-colors">
            ← Back to Pizza Logs
          </Link>
        </p>
      </div>
    </div>
  );
}
