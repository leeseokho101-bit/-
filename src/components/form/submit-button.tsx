"use client";

import { useFormStatus } from "react-dom";
import { buttonBase } from "@/components/ui/button-link";

export function SubmitButton({
  children,
  pendingText = "처리 중…",
  className = "",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`${buttonBase} bg-primary text-primary-foreground hover:bg-primary/90 w-full disabled:opacity-60 ${className}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
