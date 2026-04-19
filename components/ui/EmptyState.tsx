import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title:       string;
  description?: string;
  icon?:        React.ReactNode;
  action?:      React.ReactNode;
  className?:   string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-6 text-center", className)}>
      {icon && (
        <div className="mb-4 text-text-dim opacity-50">{icon}</div>
      )}
      <p className="heading-cinzel text-base text-text-secondary mb-2">{title}</p>
      {description && (
        <p className="text-sm text-text-dim max-w-xs">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
