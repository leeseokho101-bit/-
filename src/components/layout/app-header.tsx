import Link from "next/link";
import { routes } from "@/lib/routes";
import { getCurrentStaff } from "@/features/clinic/session";
import { getCurrentCoach } from "@/features/coaching/session";
import { getCurrentUser } from "@/server/auth/session";

export async function AppHeader() {
  const user = await getCurrentUser();
  const staff = user ? await getCurrentStaff() : null;
  const coach = user && !staff ? await getCurrentCoach() : null;
  return (
    <header className="border-border bg-surface/90 sticky top-0 z-10 border-b backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-5">
        <Link href={routes.home} className="text-primary font-bold">
          입체적 건강분석
        </Link>
        <nav
          className="text-muted flex items-center gap-4 text-sm"
          aria-label="주요 메뉴"
        >
          {user ? (
            <>
              {staff ? (
                <Link href={routes.clinic} className="hover:text-foreground">
                  의원
                </Link>
              ) : coach ? (
                <Link href={routes.coach} className="hover:text-foreground">
                  코칭센터
                </Link>
              ) : (
                <>
                  <Link href={routes.care} className="hover:text-foreground">
                    케어
                  </Link>
                  <Link
                    href={routes.dashboard}
                    className="hover:text-foreground"
                  >
                    대시보드
                  </Link>
                </>
              )}
              <Link href={routes.mypage} className="hover:text-foreground">
                마이페이지
              </Link>
            </>
          ) : (
            <Link
              href={routes.login}
              className="hover:text-foreground font-semibold"
            >
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
