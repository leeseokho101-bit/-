/** 결과 출처 표시: 검진일 · 분석일 · 설명 종류 · 분석 기준 버전 */
export function ReportFootnote({
  report,
}: {
  report: {
    narrative: { source: string };
    engineVersion: string;
    analyzedAt: Date;
    checkupDate: Date | null;
  };
}) {
  return (
    <p className="text-muted text-xs leading-relaxed">
      {report.checkupDate &&
        `검진일 ${report.checkupDate.toLocaleDateString("ko-KR")} · `}
      분석일 {report.analyzedAt.toLocaleDateString("ko-KR")} ·{" "}
      {report.narrative.source === "template" ? "기본 설명" : "AI 설명"} · 분석
      기준 {report.engineVersion}
    </p>
  );
}
