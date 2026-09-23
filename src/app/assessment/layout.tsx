import { PageContainer } from "@/components/layout/page-container";

export default function AssessmentLayout({
  children,
}: LayoutProps<"/assessment">) {
  return <PageContainer>{children}</PageContainer>;
}
