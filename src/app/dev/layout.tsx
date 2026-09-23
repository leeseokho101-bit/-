import { notFound } from "next/navigation";

/** 개발 전용 경로: production에서는 존재하지 않는 페이지로 처리합니다. */
export default function DevLayout({ children }: LayoutProps<"/dev">) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
