import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("page-shell", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">{eyebrow}</div>}
        <h1 className="heading-cinzel text-2xl font-bold text-gold-light sm:text-3xl">{title}</h1>
        {description && <div className="mt-2 max-w-3xl text-sm text-text-secondary sm:text-base">{description}</div>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}

export function PageSection({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("page-section scroll-mt-36", className)}>
      {(title || description || action) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="heading-cinzel text-lg font-semibold text-gold-light">{title}</h2>}
            {description && <div className="mt-1 max-w-3xl text-sm text-text-secondary">{description}</div>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function DataPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("data-panel", className)}>{children}</div>;
}
