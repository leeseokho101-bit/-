import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EnrollForm } from "@/features/care/enroll-form";
import { DeleteCareForm } from "@/features/care/misc-forms";
import { requireEnrollment } from "@/features/care/session";
import { routes } from "@/lib/routes";

export const metadata = { title: "케어 설정 | 입체적 건강분석" };

export default async function CareSettingsPage() {
  const { enrollment: e, today } = await requireEnrollment(routes.careSettings);
  return (
    <>
      <PageHeader
        title="케어 설정"
        description="의원 연결, 처방받은 약, 동의 항목을 바꿀 수 있어요."
      />
      <Card>
        <p className="mb-4 text-sm">
          연결된 의원:{" "}
          <span className="font-semibold">
            {e.clinic ? e.clinic.name : "아직 없음"}
          </span>
        </p>
        <EnrollForm
          today={today}
          submitLabel="저장하기"
          defaults={{
            clinicCode: e.clinic?.code,
            drugCode: e.drug.code,
            doseMg: String(e.doseMg),
            startDate: e.startDate,
            consentService: true,
            shareWithClinic: e.shareWithClinic,
            allowResearch: e.allowResearch,
            allowPharmaStats: e.allowPharmaStats,
          }}
        />
      </Card>
      <details className="border-border bg-surface rounded-2xl border p-5">
        <summary className="cursor-pointer font-semibold text-rose-800">
          케어 기록 삭제
        </summary>
        <div className="mt-4">
          <DeleteCareForm />
        </div>
      </details>
    </>
  );
}
