import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border-border bg-surface rounded-2xl border p-5 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}
