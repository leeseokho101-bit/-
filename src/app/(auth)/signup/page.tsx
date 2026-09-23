import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { SignupForm } from "@/features/auth/auth-forms";
import { routes } from "@/lib/routes";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/auth/session";

export const metadata = { title: "계정 만들기 | 입체적 건강분석" };

export default async function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  const { next } = await searchParams;
  const nextPath = safeRedirectPath(next, "");
  if (await getCurrentUser()) redirect(nextPath || routes.assessment);
  return (
    <PageContainer>
      <PageHeader
        title="계정 만들기"
        description="이메일과 비밀번호만 있으면 됩니다. 연락처나 주소는 받지 않아요."
      />
      <SignupForm next={nextPath || undefined} />
    </PageContainer>
  );
}
