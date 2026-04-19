import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "panel" | "card";
}

export function Card({ className, variant = "card", ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded border border-gold-dim",
        variant === "panel" ? "bg-bg-panel" : "bg-bg-card",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between px-4 py-3 border-b border-gold-dim", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("heading-cinzel text-sm text-gold tracking-wide", className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}
