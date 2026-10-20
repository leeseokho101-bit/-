import { flagContent } from "@/content/clinic";
import type { PatientFlag } from "@/domain/glp1/clinic";

export function FlagBadge({ flag }: { flag: PatientFlag }) {
  const c = flagContent[flag];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${c.className}`}
    >
      <span aria-hidden>{c.icon}</span>
      {c.label}
    </span>
  );
}
