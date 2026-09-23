# 보안·개인정보 점검 결과 (STEP 10, MVP)

> 개발 단계 자체 점검입니다. 실제 서비스 전 외부 보안 점검과 법률 검토가 필요합니다. (`PRIVACY_AND_COMPLIANCE.md`)

## 자동 테스트로 확인하는 항목

| 항목                                                                            | 방법                                                      | 테스트                                                           |
| ------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| 로그인 없이 건강정보 화면 접근 불가                                             | 9개 경로 → 로그인 화면                                    | `tests/e2e/security.spec.ts`                                     |
| 다른 사용자 결과 비노출                                                         | 두 계정으로 결과·계획·대시보드 비교                       | 〃                                                               |
| URL에 건강정보 없음                                                             | 전체 여정의 모든 URL query 검사 (허용: `next`, `deleted`) | `tests/e2e/journey.spec.ts`                                      |
| 보안 헤더 (CSP·X-Frame-Options·nosniff·Referrer·Permissions, X-Powered-By 제거) | 응답 헤더                                                 | `security.spec.ts`                                               |
| 세션 쿠키 httpOnly·SameSite=Lax, 비밀번호 비노출                                | 쿠키·페이지 내용                                          | 〃                                                               |
| Open redirect 방지                                                              | `?next=//evil.example`                                    | 〃 + `tests/unit/auth.test.ts`                                   |
| 로그인 실패 시 계정 존재 여부 비노출                                            | 존재/비존재 이메일 동일 문구                              | `security.spec.ts`                                               |
| 개발 전용 경로 비활성                                                           | production에서 `/dev/samples` 404                         | 〃                                                               |
| 비밀번호 해시 (scrypt, salt)                                                    | 평문 미포함·검증                                          | `tests/unit/auth.test.ts`                                        |
| 로그 마스킹                                                                     | 민감 키·이메일·전화번호                                   | `tests/unit/redact.test.ts`                                      |
| LLM 전송 최소화                                                                 | 입력 JSON에 이름·이메일·생년월일 없음                     | `tests/unit/narrative.test.ts`, `tests/integration/plan.test.ts` |
| AI 금지 표현                                                                    | 진단·확률·약물 지시·진료 불필요                           | `tests/unit/narrative.test.ts`                                   |
| 데이터 전체 삭제                                                                | 삭제 후 로그인 화면, DB cascade                           | `journey.spec.ts`, `tests/integration/schema.test.ts`            |
| 접근성 (WCAG 2.1 AA, axe)                                                       | 공개·입력·결과·계획·대시보드·마이페이지                   | `tests/e2e/accessibility.spec.ts`, `journey.spec.ts`             |
| 의존성 취약점                                                                   | `npm audit --audit-level=high` (CI)                       | CI                                                               |

## 코드 점검

- 모든 Server Action이 첫 줄에서 로그인·소유권을 확인 (`requireUser` / `requireDraftAssessment`); 분석·계획 ID를 클라이언트에서 받지 않고 세션 사용자로 조회
- 주간 체크: 본인 최신 계획의 현재 주차까지만, 정의된 체크 항목 ID만 저장
- 개발용 샘플 로그인 Action은 페이지와 별도로 production 차단
- `console.*` 사용 금지(ESLint error), 서버 로그는 마스킹 로거만 사용
- Prisma 쿼리 로그 비활성 (건강정보 파라미터 노출 방지)
- `deepmerge-ts` 취약점(Prisma CLI 경유, 개발 도구)은 override로 8.x 적용

## 남은 위험 (출시 전 조치 필요)

1. **로그인 시도 제한 없음** — 무차별 대입 방지(rate limit, 계정 잠금) 필요
2. **회원가입 시 이메일 중복 안내** — 계정 존재 여부가 드러남 (UX와 절충, 이메일 인증 도입 시 개선)
3. **CSP `'unsafe-inline'`** — Next.js 기본 인라인 스크립트 때문. nonce 기반 CSP로 강화 가능
4. **만료 세션 정리 배치 없음** — 만료 세션은 사용되지 않지만 DB에 남음
5. **감사 로그(접근 기록) 없음** — 개인정보 안전성 확보조치의 접속기록 보관 요건 검토 필요
6. **DB 암호화·백업 정책** — 배포 DB 공급자 설정에서 저장 암호화·백업·접근 통제 확인 필요
7. **동의 철회·열람 요청 절차** — 삭제 외 열람·정정 요청 기능 없음
