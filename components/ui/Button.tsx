import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm font-semibold tracking-wide uppercase transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep",
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
          "bg-flame text-button-text border border-flame",
          "hover:bg-accent",
        ],
      },
      size: {
        sm:  "text-xs px-3 py-2",
        md:  "text-sm px-5 py-2.5",
        lg:  "text-base px-7 py-3",
        icon:"min-w-11 text-sm p-2",
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
