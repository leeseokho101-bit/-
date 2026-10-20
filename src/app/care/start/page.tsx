import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { careDisclaimer } from "@/content/care";
import { koreaDate } from "@/features/activity/date";
import { EnrollForm } from "@/features/care/enroll-form";
import { getEnrollment } from "@/features/care/service";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata = { title: "GLP-1 케어 시작 | 입체적 건강분석" };

const FEATURES = [
  [
    "💉",
    "투약 기록·다음 투약일",
    "주사일과 용량을 기록하고, 다음 투약일과 주사 부위를 알려드려요.",
  ],
  [
    "📈",
    "혈당(CGM) 한눈에",
    "목표 범위 안 시간, 식후 혈당 변화, 용량별 변화를 보여드려요.",
  ],
  [
    "🍚",
    "식사 기록",
    "사진이나 직접 입력으로 기록하면 식후 혈당 반응과 이어서 보여드려요.",
  ],
  [
    "✓",
    "하루 1분 체크인",
    "속 불편함을 기록하면 대처 방법과, 필요할 때 연락할 곳을 안내해요.",
  ],
] as const;

export default async function CareStartPage() {
  const user = await requireUser(routes.careStart);
  if (await getEnrollment(db, user.id)) redirect(routes.care);
  return (
    <>
      <PageHeader
        eyebrow="처방 동반 대사관리"
        title="GLP-1 케어 시작하기"
        description="의원에서 GLP-1 계열 약을 처방받으셨나요? 투약·혈당·식사·몸 상태를 한곳에 기록하고, 약이 내 몸에 어떻게 작용하는지 데이터로 확인해 보세요."
      />
      <ul className="grid grid-cols-2 gap-2">
        {FEATURES.map(([icon, title, body]) => (
          <li
            key={title}
            className="border-border bg-surface flex flex-col gap-1 rounded-xl border p-3"
          >
            <span aria-hidden className="text-xl">
              {icon}
            </span>
            <span className="text-sm font-bold">{title}</span>
            <span className="text-muted text-xs leading-relaxed">{body}</span>
          </li>
        ))}
      </ul>
      <Card>
        <EnrollForm
          defaults={{}}
          today={koreaDate()}
          submitLabel="동의하고 시작하기"
        />
      </Card>
      <p className="text-muted bg-surface border-border rounded-xl border p-3 text-xs leading-relaxed">
        {careDisclaimer}
      </p>
    </>
  );
}
