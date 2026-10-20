import { notFound } from "next/navigation";
import { isSampleDataAllowed } from "@/lib/demo-mode";

/** 개발 전용 경로: production에서는 존재하지 않는 페이지로 처리합니다 (미리보기 데모를 켠 경우만 예외 — src/lib/demo-mode.ts). */
export default function DevLayout({ children }: LayoutProps<"/dev">) {
  if (!isSampleDataAllowed()) notFound();
  return children;
}
