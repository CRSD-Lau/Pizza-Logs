import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title:      string;
  sub?:       string;
  action?:    React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, sub, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between mb-4", className)}>
      <div>
        <h2 className="heading-cinzel text-lg font-semibold text-gold-light">{title}</h2>
        {sub && <p className="text-sm text-text-secondary mt-0.5">{sub}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
