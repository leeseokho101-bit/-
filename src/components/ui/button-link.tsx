import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-background",
  ghost: "text-primary hover:bg-primary/5",
};

export const buttonBase =
  "inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link
      className={`${buttonBase} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
