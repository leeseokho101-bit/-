import { requirePharma } from "@/features/pharma/session";
import { routes } from "@/lib/routes";

/** 제약사 인사이트 포털 — 제약사 계정만 */
export default async function PharmaLayout({
  children,
}: LayoutProps<"/pharma">) {
  await requirePharma(routes.pharma);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-8">
      {children}
    </main>
  );
}
