# 배포 안내 (Vercel + Neon)

> 실제 서비스 전환 전 `docs/PRIVACY_AND_COMPLIANCE.md`, `docs/SECURITY_REVIEW.md`의 남은 항목을 먼저 검토하세요.
> 이 안내의 계정 연결·비밀값 입력은 서비스 소유자가 직접 진행합니다. 비밀값은 채팅·코드·이슈에 붙여 넣지 마세요.

## 0. 가장 쉬운 방법 — Vercel Storage에서 Neon 연결

1. Vercel 프로젝트 → **Storage → Create Database → Neon** → 이 프로젝트에 **Connect**
2. 연동이 `DATABASE_URL`(pooled)·`DATABASE_URL_UNPOOLED`(direct) 등을 자동으로 넣습니다.
   앱과 배포 빌드는 이 이름들을 자동으로 인식하므로 `DIRECT_URL`을 따로 넣지 않아도 됩니다.
   (인식 순서: `scripts/db-env.mjs` — 앱 `DATABASE_URL → POSTGRES_PRISMA_URL → POSTGRES_URL`, 마이그레이션 `DIRECT_URL → DATABASE_URL_UNPOOLED → POSTGRES_URL_NON_POOLING`)
3. 연결할 때 접두사(예: `h1_`)를 붙여 연결해도 됩니다 — `h1_DATABASE_URL`처럼 **접두사가 붙은 이름도 자동 인식**합니다. 또는 "이미 있는 변수" 오류가 나면, **비어 있는** `DATABASE_URL`·`DIRECT_URL`을 Settings → Environment Variables에서 삭제한 뒤 다시 연결하세요.
4. `SESSION_SECRET`(32자 이상)이 설정되어 있는지 확인 → **Redeploy**

빌드 로그 첫 부분에 환경변수 점검 결과가 `✓`/`✗`로 표시됩니다 (값은 출력되지 않음).

## 1. Neon (PostgreSQL) — 직접 만드는 경우

1. [Neon](https://neon.tech)에서 프로젝트 생성
   - **리전**: 사용자와 가까운 리전을 고르세요. 해외 리전이면 개인정보 국외이전 고지·동의 검토가 필요합니다.
   - Postgres 버전: 16 이상
2. Dashboard → **Connect**에서 연결 문자열 두 개를 복사
   - **Pooled connection** (호스트에 `-pooler` 포함) → `DATABASE_URL`
   - **Direct connection** → `DIRECT_URL` (마이그레이션 전용)
   - Prisma용 연결 문자열 옵션(예: `sslmode=require`)은 Neon 화면에 표시되는 값을 그대로 사용
3. (권장) 개발/미리보기용 **branch**를 따로 만들어 production 데이터와 분리

## 2. Vercel

1. [Vercel](https://vercel.com) → **Add New… → Project** → GitHub 저장소 `leeseokho101-bit/-` 선택
2. Framework: Next.js (자동 인식). Build Command는 비워 두면 `package.json`의 **`vercel-build`**(`scripts/deploy-build.mjs`: 환경변수 점검 → `prisma migrate deploy` → `next build`)가 사용됩니다.
3. **Settings → Functions → Region**: Neon DB와 같은(가까운) 리전으로 설정 (지연 시간)
4. **Settings → Environment Variables** (Production / Preview 각각)

| 이름                | 값                                                      | 필수 |
| ------------------- | ------------------------------------------------------- | ---- |
| `DATABASE_URL`      | Neon pooled 연결 문자열                                 | ✔    |
| `DIRECT_URL`        | Neon direct 연결 문자열                                 | ✔    |
| `SESSION_SECRET`    | 32자 이상 임의 문자열 (`openssl rand -base64 32`)       | ✔    |
| `ANTHROPIC_API_KEY` | Claude API Key. 없으면 템플릿 설명으로 동작             | 선택 |
| `LLM_MODEL`         | 기본 `claude-opus-5` (비용을 줄이려면 다른 모델로 변경) | 선택 |

- Preview 환경은 **Neon의 별도 branch**를 연결하세요. (Preview에서 가입·입력한 데이터가 production DB에 섞이지 않도록)
- `NEXT_PUBLIC_` 접두사는 쓰지 마세요 (브라우저에 노출됨).

5. **Deploy** → 빌드 로그에서 `prisma migrate deploy` 성공 확인

## 3. 배포 후 점검

```bash
npm run smoke -- https://<배포주소>
```

읽기 전용 점검입니다 (계정 생성 없음): `/api/health` DB 연결, 랜딩, 보안 헤더(CSP·HSTS 등), 비로그인 차단, `/dev/samples` 404.

수동 확인

- [ ] 가입 → 동의 → 입력 → 분석 → 결과 → 12주 계획 → 체크 → 마이페이지 삭제까지 한 번 진행 (가상 데이터 사용)
- [ ] 결과 화면 하단 표시가 **"AI 설명"**인지 (API Key 설정 시) / "기본 설명"인지
- [ ] Vercel 함수 로그에 이메일·건강 수치가 없는지 (사용자 ID만)

## 4. 운영 시 주의

- **샘플 데이터**: `npm run db:seed`는 production에서 실행되지 않습니다. production DB에 가상 사용자를 넣지 마세요.
- **스키마 변경**: `prisma migrate dev`로 마이그레이션 파일을 만들어 커밋하면, 다음 배포 때 `prisma migrate deploy`가 적용합니다.
- **LLM 비용**: 분석 1회당 설명 1회 + 12주 코칭 1회 호출. 같은 사용자의 같은 입력은 재사용됩니다.
- **백업**: Neon의 point-in-time restore 보관 기간을 확인하세요.
