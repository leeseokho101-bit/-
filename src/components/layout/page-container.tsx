import type { ReactNode } from "react";

/** 모바일 우선 단일 컬럼 컨테이너 */
export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
      {children}
    </main>
  );
}
