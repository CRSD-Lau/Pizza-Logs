import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded font-semibold tracking-wide uppercase transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-1 focus-visible:ring-gold",
  {
    variants: {
      variant: {
        gold: [
          "border border-gold text-gold-light bg-transparent",
          "hover:bg-gold/10 hover:shadow-gold-glow",
        ],
        ghost: [
          "border border-transparent text-text-secondary",
          "hover:text-text-primary hover:border-gold-dim",
        ],
        danger: [
          "border border-danger/50 text-red-400 bg-transparent",
          "hover:bg-danger/10",
        ],
        solid: [
          "bg-gold text-bg-deep border border-gold",
          "hover:bg-gold-light",
        ],
      },
      size: {
        sm:  "text-xs px-3 py-1.5",
        md:  "text-sm px-5 py-2.5",
        lg:  "text-base px-7 py-3",
        icon:"text-sm p-2",
      },
    },
    defaultVariants: {
      variant: "gold",
      size:    "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
