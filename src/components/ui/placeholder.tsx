/** 아직 구현되지 않은 영역 표시 (개발 중 골격 확인용) */
export function Placeholder({ label, step }: { label: string; step: number }) {
  return (
    <div className="border-border text-muted rounded-2xl border-2 border-dashed p-6 text-center text-sm">
      <p className="text-foreground font-medium">{label}</p>
      <p className="mt-1">STEP {step}에서 구현 예정</p>
    </div>
  );
}
