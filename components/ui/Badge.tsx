import { cn } from "@/lib/utils";

type BadgeVariant = "gold" | "physical" | "holy" | "fire" | "nature" | "frost" | "shadow" | "arcane" | "kill" | "wipe" | "unknown" | "heroic" | "normal";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  gold:     "bg-gold/10 border-gold/30 text-gold",
  physical: "bg-school-physical/10 border-school-physical/25 text-school-physical",
  holy:     "bg-school-holy/10 border-school-holy/25 text-school-holy",
  fire:     "bg-school-fire/10 border-school-fire/25 text-school-fire",
  nature:   "bg-school-nature/10 border-school-nature/25 text-school-nature",
  frost:    "bg-school-frost/10 border-school-frost/25 text-school-frost",
  shadow:   "bg-school-shadow/10 border-school-shadow/25 text-school-shadow",
  arcane:   "bg-school-arcane/10 border-school-arcane/25 text-school-arcane",
  kill:     "bg-success/10 border-success/30 text-success",
  wipe:     "bg-danger/10 border-danger/25 text-danger",
  unknown:  "bg-text-dim/10 border-text-dim/20 text-text-dim",
  heroic:   "bg-school-fire/10 border-school-fire/30 text-school-fire",
  normal:   "bg-text-secondary/10 border-text-secondary/20 text-text-secondary",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "gold", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-xs border px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide",
        VARIANT_STYLES[variant],
        className
      )}
      {...props}
    />
  );
}
