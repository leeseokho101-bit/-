import { requireCoach } from "@/features/coaching/session";
import { routes } from "@/lib/routes";

/** 코칭 센터 (영양사·운동처방사용 웹 화면). 코치 계정만 들어올 수 있다 */
export default async function CoachLayout({ children }: LayoutProps<"/coach">) {
  await requireCoach(routes.coach);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-8">
      {children}
    </main>
  );
}
