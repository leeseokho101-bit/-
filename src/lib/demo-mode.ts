/**
 * 가상(데모) 데이터 기능을 켤 수 있는지 — 가상 사용자 불러오기(/dev/samples)·seed에 쓴다.
 *
 * - 로컬 개발·테스트: 항상 가능
 * - Vercel 미리보기(Preview): `DEMO_SAMPLES=on`을 Preview 환경변수로 직접 켠 경우에만.
 *   미리보기가 운영과 다른 DB를 쓸 때만 켜야 한다 (가상 환자가 운영 통계에 섞이지 않도록).
 * - Vercel 운영(Production) 등 그 밖의 production 빌드: 항상 불가
 *
 * 비밀값이 아닌 배포 환경 표시값만 읽으며, seed 스크립트에서도 쓰도록 server-only로 두지 않는다.
 */
export function isSampleDataAllowed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.NODE_ENV !== "production") return true;
  return env.VERCEL_ENV === "preview" && env.DEMO_SAMPLES === "on";
}

/** 운영 빌드인데 데모가 켜진 경우 (미리보기 데모) — 화면에 안내 표시용 */
export function isPreviewDemo(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NODE_ENV === "production" && isSampleDataAllowed(env);
}
