@AGENTS.md

# Project rules — 입체적 건강분석 MVP

- 설계 기준: `docs/ARCHITECTURE.md`. 개발은 STEP 순서대로, 단계마다 `npm run check` 통과 후 진행.
- 건강 판정(상태·우선순위)은 `src/domain`의 규칙 엔진만 결정한다. LLM은 설명 문구만 생성한다.
- 진단·질병 확률·약물 중단/복용 권고 표현 금지. "건강관리 관심영역/관리 필요 영역" 용어 사용.
- 서버 로그는 `src/server/logger.ts`만 사용 (개인정보·건강정보 마스킹). `console.*` 직접 사용 금지.
- 비밀값은 `src/server/env.ts`로만 접근. `NEXT_PUBLIC_` 에 비밀값 금지.
- 건강정보는 URL(query/path)에 넣지 않는다. 테스트·샘플 데이터는 가상 데이터만 사용한다.
