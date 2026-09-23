import Link from "next/link";
import { routes } from "@/lib/routes";
import { getCurrentUser } from "@/server/auth/session";

export async function AppHeader() {
  const user = await getCurrentUser();
  return (
    <header className="border-border bg-surface/90 sticky top-0 z-10 border-b backdrop-blur">
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
              <Link href={routes.dashboard} className="hover:text-foreground">
                대시보드
              </Link>
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
