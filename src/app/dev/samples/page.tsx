import { PageContainer } from "@/components/layout/page-container";
import { buttonBase } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { domainContent } from "@/content/domains";
import { sampleUsers } from "@/dev/samples";
import { loginAsSample } from "@/features/dev/actions";

export const metadata = { title: "샘플 데이터 (개발용)" };

export default function DevSamplesPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="개발 전용 · production에서는 비활성"
        title="가상 사용자 불러오기"
        description="모든 데이터는 가상의 인물입니다. 선택하면 해당 사용자의 데이터를 처음 상태로 되돌린 뒤 그 사용자로 로그인합니다."
      />
      {sampleUsers.map((s) => (
        <Card key={s.id} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full text-lg font-bold">
              {s.id}
            </span>
            <div>
              <p className="font-bold">{s.displayName}</p>
              <p className="text-muted text-xs">{s.email}</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed">{s.persona}</p>
          <p className="text-muted text-xs">
            기대 관리영역:{" "}
            {s.expectedFocus.length
              ? s.expectedFocus.map((d) => domainContent[d].label).join(", ")
              : "특별히 없음 (유지 중심)"}
          </p>
          <form action={loginAsSample}>
            <input type="hidden" name="sampleId" value={s.id} />
            <button
              type="submit"
              className={`${buttonBase} bg-primary text-primary-foreground w-full`}
            >
              {s.displayName}(으)로 시작하기
            </button>
          </form>
        </Card>
      ))}
    </PageContainer>
  );
}
