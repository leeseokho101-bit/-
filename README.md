# 입체적 건강분석 (MVP)

> 건강검진 결과만 보는 것이 아니라, 나의 건강정보를 종합적으로 분석해서
> 지금 무엇을 관리해야 하는지 알려주는 AI 건강관리 서비스

- 설계 문서: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- 개인정보·법규 검토: [`docs/PRIVACY_AND_COMPLIANCE.md`](docs/PRIVACY_AND_COMPLIANCE.md)
- 분석 규칙 기준(초안, 의료 자문 필요): [`docs/RULES_REFERENCE.md`](docs/RULES_REFERENCE.md)

## 기술 스택

Next.js (App Router) · TypeScript · Tailwind CSS · PostgreSQL · Prisma · Zod · Vitest

## 로컬 실행

```bash
cp .env.example .env        # 값 채우기 (SESSION_SECRET 등)
npm install                 # postinstall 에서 prisma generate 실행
npm run db:migrate          # 로컬 PostgreSQL에 테이블 생성
npm run dev                 # http://localhost:3000
```

## AI 설명

`.env`의 `ANTHROPIC_API_KEY`가 있으면 분석 결과를 Claude가 쉬운 말로 설명합니다 (`LLM_MODEL`, 기본 `claude-opus-5`).
키가 없거나 호출이 실패하면 템플릿 설명으로 자동 대체되어 서비스는 그대로 동작합니다.
건강 판정(상태·우선순위)은 항상 규칙 엔진이 결정하며, AI 문장은 금지 표현 검사를 통과한 것만 표시합니다.

## 가상 사용자 (개발 전용)

`npm run db:seed` 또는 개발 서버의 `/dev/samples` 화면에서 가상 사용자 A~E를 불러옵니다.
모든 데이터는 가상이며, production에서는 이 기능이 비활성화됩니다. (`src/dev/samples.ts`)

| 사용자 | 특징                                  |
| ------ | ------------------------------------- |
| A      | 건강상태 양호                         |
| B      | 체중관리 중심                         |
| C      | 혈당관리 중심                         |
| D      | 생활습관 중심 (일부 검진 항목 미입력) |
| E      | 복합적인 건강관리 필요                |

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
- [x] STEP 3 DB Schema
- [x] STEP 4 UI 구현
- [x] STEP 5 샘플 데이터
- [x] STEP 6 Rule-based Health Analysis Engine
- [x] STEP 7 AI 연동
- [x] STEP 8 결과 Dashboard
- [x] STEP 9 12주 건강관리
- [ ] STEP 10 테스트
- [ ] STEP 11 배포

> ⚠️ 본 서비스는 의료행위(진단·처방)를 하지 않습니다. 결과는 건강관리 참고용입니다.
