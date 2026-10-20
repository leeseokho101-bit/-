import { requireClinician } from "@/features/clinic/session";
import { routes } from "@/lib/routes";

/** 의사 대시보드 (EMR 옆에 띄워 보는 웹 화면). 의료진 계정만 들어올 수 있다 */
export default async function ClinicLayout({
  children,
}: LayoutProps<"/clinic">) {
  await requireClinician(routes.clinic);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-8 print:max-w-none print:gap-3 print:p-0">
      {children}
    </main>
  );
}
