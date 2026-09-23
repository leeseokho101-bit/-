# 입체적 건강분석 (MVP)

> 건강검진 결과만 보는 것이 아니라, 나의 건강정보를 종합적으로 분석해서
> 지금 무엇을 관리해야 하는지 알려주는 AI 건강관리 서비스

- 설계 문서: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- 개인정보·법규 검토: [`docs/PRIVACY_AND_COMPLIANCE.md`](docs/PRIVACY_AND_COMPLIANCE.md)

## 기술 스택

Next.js (App Router) · TypeScript · Tailwind CSS · PostgreSQL · Prisma · Zod · Vitest

## 로컬 실행

```bash
cp .env.example .env        # 값 채우기 (SESSION_SECRET 등)
npm install                 # postinstall 에서 prisma generate 실행
npm run dev                 # http://localhost:3000
```

## 스크립트

| 명령                 | 설명                                                |
| -------------------- | --------------------------------------------------- |
| `npm run check`      | lint + typecheck + unit test (각 STEP 종료 시 필수) |
| `npm run test`       | Vitest 단위 테스트                                  |
| `npm run format`     | Prettier 포맷                                       |
| `npm run db:migrate` | Prisma 마이그레이션 (STEP 3~)                       |
| `npm run db:seed`    | 가상 사용자 A~E 생성 (STEP 5~, 개발 DB 전용)        |

## 진행 상황

- [x] 설계 승인
- [x] STEP 1 프로젝트 셋업
- [x] STEP 2 페이지 구조
- [ ] STEP 3 DB Schema
- [ ] STEP 4 UI 구현
- [ ] STEP 5 샘플 데이터
- [ ] STEP 6 Rule-based Health Analysis Engine
- [ ] STEP 7 AI 연동
- [ ] STEP 8 결과 Dashboard
- [ ] STEP 9 12주 건강관리
- [ ] STEP 10 테스트
- [ ] STEP 11 배포

> ⚠️ 본 서비스는 의료행위(진단·처방)를 하지 않습니다. 결과는 건강관리 참고용입니다.
