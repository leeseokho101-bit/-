// 임시 랜딩 — 실제 화면은 STEP 4에서 구현합니다.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-12">
      <p className="text-primary text-sm font-semibold">입체적 건강분석</p>
      <h1 className="text-3xl leading-snug font-bold">
        내 건강을 하나씩 보는 것이 아니라, 전체적으로 분석합니다.
      </h1>
      <p className="text-muted leading-relaxed">
        건강검진, 생활습관, 복용약 정보를 종합하여 지금 내가 가장 먼저 관리해야
        할 건강영역을 찾아드립니다.
      </p>
    </main>
  );
}
