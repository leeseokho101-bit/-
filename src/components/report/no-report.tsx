import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { routes } from "@/lib/routes";

export function NoReport() {
  return (
    <Card className="flex flex-col gap-4 text-center">
      <p className="text-lg font-bold">아직 분석 결과가 없어요</p>
      <p className="text-muted">
        건강정보를 입력하면 나의 건강 프로파일과 관리 우선순위를 알려드립니다.
      </p>
      <ButtonLink href={routes.assessment}>내 건강 분석하기</ButtonLink>
    </Card>
  );
}
