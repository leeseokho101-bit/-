"use client";

import { buttonBase } from "@/components/ui/button-link";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`${buttonBase} border-border bg-surface border print:hidden`}
    >
      🖨 인쇄 · PDF 저장
    </button>
  );
}
