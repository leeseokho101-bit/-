import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2">
      {eyebrow && (
        <p className="text-primary text-sm font-semibold">{eyebrow}</p>
      )}
      <h1 className="text-2xl leading-snug font-bold">{title}</h1>
      {description && (
        <p className="text-muted leading-relaxed">{description}</p>
      )}
    </header>
  );
}
