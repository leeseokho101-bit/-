import Link from "next/link";
import { alertAction, alertContent, missedDoseAction } from "@/content/care";
import type { ActiveAlert } from "@/features/care/service";
import { routes } from "@/lib/routes";

/** 최근 위험 신호 — 담당 의원 연락 안내 (판정 없이 기록된 사실과 연락처 안내만) */
export function AlertList({
  alerts,
  clinicName,
  shareWithClinic,
}: {
  alerts: ActiveAlert[];
  clinicName: string | null;
  shareWithClinic: boolean;
}) {
  if (!alerts.length) return null;
  const urgent = alerts.some((a) => a.level === "URGENT");
  return (
    <section
      role="alert"
      className={`flex flex-col gap-2 rounded-2xl border p-4 ${
        urgent
          ? "border-rose-300 bg-rose-50 text-rose-950"
          : "border-amber-300 bg-amber-50 text-amber-950"
      }`}
    >
      <h2 className="font-bold">
        {urgent
          ? "⚠ 바로 진료가 필요한 신호가 있어요"
          : "⚠ 담당 의원과 상의가 필요한 신호가 있어요"}
      </h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
        {alerts.map((a) => (
          <li key={a.kind}>{alertContent[a.kind]}</li>
        ))}
      </ul>
      <p className="text-sm leading-relaxed">
        {clinicName ?? "담당 의원"}
        {alertAction}
        {alerts.some((a) => a.kind === "MISSED_DOSES") &&
          ` ${missedDoseAction}`}
      </p>
      {urgent && (
        <p className="text-sm leading-relaxed font-semibold">
          숨쉬기가 힘들거나 의식이 흐려지면 바로 119에 전화하세요.
        </p>
      )}
      <p className="text-xs leading-relaxed opacity-80">
        {shareWithClinic && clinicName
          ? "의원 공유에 동의하셔서 이 신호가 기록되었어요. 의원용 화면이 열리면 담당 의료진도 볼 수 있어요."
          : "이 신호는 내 기록에만 남아요. 담당 의원에는 직접 연락해 주세요."}{" "}
        <Link href={routes.careCheckIn} className="underline">
          체크인 보기
        </Link>
      </p>
    </section>
  );
}
