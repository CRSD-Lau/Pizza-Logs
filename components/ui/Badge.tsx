import { cn } from "@/lib/utils";

type BadgeVariant = "gold" | "physical" | "holy" | "fire" | "nature" | "frost" | "shadow" | "arcane" | "kill" | "wipe" | "unknown" | "heroic" | "normal";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  gold:     "bg-gold/10 border-gold/30 text-gold",
  physical: "bg-[#c0c8d8]/10 border-[#c0c8d8]/25 text-[#c0c8d8]",
  holy:     "bg-[#f0c040]/10 border-[#f0c040]/25 text-[#f0c040]",
  fire:     "bg-[#e06030]/10 border-[#e06030]/25 text-[#e06030]",
  nature:   "bg-[#60c060]/10 border-[#60c060]/25 text-[#60c060]",
  frost:    "bg-[#80c8f0]/10 border-[#80c8f0]/25 text-[#80c8f0]",
  shadow:   "bg-[#a070d0]/10 border-[#a070d0]/25 text-[#a070d0]",
  arcane:   "bg-[#d080f0]/10 border-[#d080f0]/25 text-[#d080f0]",
  kill:     "bg-success/10 border-success/30 text-success",
  wipe:     "bg-danger/10 border-danger/25 text-danger",
  unknown:  "bg-text-dim/10 border-text-dim/20 text-text-dim",
  heroic:   "bg-[#e06030]/12 border-[#e06030]/30 text-[#e06030]",
  normal:   "bg-text-secondary/10 border-text-secondary/20 text-text-secondary",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "gold", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-sm border tracking-wide uppercase",
        VARIANT_STYLES[variant],
        className
      )}
      {...props}
    />
  );
}
