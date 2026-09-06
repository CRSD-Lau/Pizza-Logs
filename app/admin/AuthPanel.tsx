import Link from "next/link";
import type { ReactNode } from "react";

export function AuthPanel({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center py-10 sm:py-14">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-3 text-center">
          <p className="heading-cinzel text-sm tracking-[0.2em] text-gold">PIZZA LOGS</p>
          <h1 className="heading-cinzel text-2xl font-bold text-gold-light">{title}</h1>
          <p className="text-sm text-text-secondary">{description}</p>
        </div>
        <div className="space-y-5 rounded-sm border border-gold-dim bg-bg-panel p-4 sm:p-6">
          <noscript><p className="text-sm text-text-secondary">Enable JavaScript to sign in and manage this account.</p></noscript>
          {children}
        </div>
        <p className="text-center text-sm">
          <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-sm px-3 text-gold transition-colors hover:text-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">Back to Pizza Logs</Link>
        </p>
      </div>
    </div>
  );
}
