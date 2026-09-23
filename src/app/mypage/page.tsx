import { PageContainer } from "@/components/layout/page-container";
import { buttonBase } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Placeholder } from "@/components/ui/placeholder";
import { logout } from "@/features/auth/actions";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "마이페이지 | 입체적 건강분석" };

export default async function MyPage() {
  const user = await requireUser(routes.mypage);
  return (
    <PageContainer>
      <PageHeader
        title="마이페이지"
        description={`${user.displayName}님, 안녕하세요.`}
      />
      <Card>
        <p className="text-sm">
          개인정보·건강정보 수집 동의:{" "}
          <span className="font-semibold">
            {user.consentAt
              ? user.consentAt.toLocaleDateString("ko-KR")
              : "미동의"}
          </span>
        </p>
      </Card>
      <Placeholder label="분석 이력 · 내 데이터 전체 삭제" step={8} />
      <form action={logout}>
        <button
          type="submit"
          className={`${buttonBase} border-border bg-surface text-foreground w-full border`}
        >
          로그아웃
        </button>
      </form>
    </PageContainer>
  );
}
