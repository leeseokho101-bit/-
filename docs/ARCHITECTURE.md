# 입체적 건강분석 MVP — 설계 문서 (v0.1, 2026-09-23 승인)

> 승인된 설계 기준 문서입니다. 구현 중 변경 사항은 이 문서에 반영합니다.

---

## 1. 전체 시스템 Architecture

**핵심 원칙: `입력 → Rule Engine(결정적) → 구조화 JSON → LLM(설명만)`**
LLM은 상태·우선순위를 **바꿀 수 없고**, 엔진이 만든 결과를 "쉬운 말로 풀어 쓰는" 역할만 합니다.

```
┌──────────────────────────── Client (Next.js App Router, Mobile-first) ───────────────────────────┐
│  Landing → Wizard(기본정보/검진/문진/생활습관/복용약) → 분석중 → 결과 → 우선순위 → 12주 계획 → 마이페이지 │
└───────────────────────────────┬──────────────────────────────────────────────────────────────────┘
                                │ Server Actions / Route Handlers (POST body, 건강정보는 URL에 노출 안 함)
┌───────────────────────────────▼──────────────────────────────────────────────────────────────────┐
│  Application Layer (server-only)                                                                  │
│   ├─ Input Adapters  ── ManualInputAdapter (MVP)  │ PdfOcrAdapter · MyDataAdapter · Wearable (향후) │
│   ├─ Validation (zod) + 단위 정규화                                                                 │
│   ├─ Health Analysis Engine  (순수 함수, 규칙/임계값은 버전 관리되는 설정 파일)                      │
│   │     ├─ Domain Evaluators ×10  → DomainResult[]                                                │
│   │     └─ Priority Engine        → Top3                                                          │
│   ├─ Plan Engine (템플릿 기반 12주 계획 골격)                                                       │
│   ├─ AI Narrative Service  (LLM Provider 추상화 + Safety Guard + Fallback 템플릿)                  │
│   └─ Repository (Prisma)                                                                          │
└───────────────────────────────┬───────────────────────────────┬──────────────────────────────────┘
                                │                               │
                    ┌───────────▼──────────┐          ┌─────────▼─────────┐
                    │ PostgreSQL (Prisma)  │          │  LLM API (서버측) │
                    │ 사용자/입력/분석/계획 │          │  API Key = env    │
                    └──────────────────────┘          └───────────────────┘
```

| 계층            | 설명                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Input Adapter   | 데이터 출처(수기/PDF/마이데이터/웨어러블)를 하나의 `HealthSnapshot` 형태로 변환. MVP는 수기입력만 구현, 인터페이스만 열어둠 |
| Analysis Engine | DB·네트워크 의존이 없는 순수 TypeScript 모듈. 같은 입력 → 항상 같은 출력. 단위테스트 대상                                   |
| Priority Engine | 영역별 점수 + 동반 이상 + 생활습관 + 데이터 충분성으로 TOP 3 산출                                                           |
| Plan Engine     | TOP 3에 맞는 12주 템플릿(목표/실천/체크)을 결정적으로 조립                                                                  |
| AI Narrative    | 엔진 JSON만 입력으로 받아 설명·코칭 문구 생성. 금지표현 필터, 실패 시 템플릿 문구로 대체                                    |
| 저장            | 입력 원본, 엔진 결과(JSON + 엔진 버전), LLM 결과를 분리 저장 → 재현성 확보                                                  |

---

## 2. 페이지 Sitemap

```
/                          Landing (서비스명, 메인카피, CTA "내 건강 분석하기")
/about                     서비스 소개 (어떻게 분석하나요? / 의료행위 아님 고지)
/login                     개발용 계정·이메일 매직링크 로그인
/assessment                건강분석 시작 (동의 화면: 수집 항목·목적·보관기간)
  /assessment/profile      STEP 1 기본정보
  /assessment/checkup      STEP 2 건강검진 입력 (섹션 접기/펼치기, "모름" 허용)
  /assessment/survey       STEP 3 건강문진 (운동·수면)
  /assessment/lifestyle    STEP 4 생활습관 (식습관·음주·흡연·스트레스)
  /assessment/medications  STEP 5 복용약
  /assessment/review       입력 확인 → 분석 시작
  /assessment/analyzing    분석 진행 화면
/report                    건강분석 결과 (최신 리포트; 리포트 ID는 세션으로 조회, URL에 건강값 없음)
  /report/profile          나의 건강 프로파일 (10개 영역 카드 + 상세 설명)
  /report/priorities       건강관리 우선순위 TOP 3
  /report/plan             12주 건강관리 계획 (주차별 목표/실천/체크/코칭)
/dashboard                 대시보드 (건강 한눈에 보기 → 프로파일 → TOP3 → 주요 데이터 → 12주 → 최근 변화)
/mypage                    내 정보, 분석 이력, 데이터 삭제, 로그아웃
/dev/samples               (개발 환경 전용) 가상 사용자 A~E 불러오기
```

> 결과 화면의 리포트 식별자는 추측 불가능한 cuid를 쓰되, 소유자 검증을 반드시 거칩니다.

---

## 3. User Flow

```
Landing ─▶ 서비스 소개 ─▶ [내 건강 분석하기]
   │
   ▼
로그인(개발용/이메일) ─▶ 수집 동의
   │
   ▼
기본정보 ─▶ 건강검진 ─▶ 건강문진 ─▶ 생활습관 ─▶ 복용약 ─▶ 입력 확인
   │  (각 단계 자동 임시저장, 뒤로가기 가능, 모르는 항목은 건너뛰기 가능)
   ▼
[분석 시작]
   ├─ 1) 입력 검증·정규화 (BMI 자동계산, 단위 확인)
   ├─ 2) Rule Engine → 10개 영역 상태
   ├─ 3) Priority Engine → TOP 3
   ├─ 4) Plan Engine → 12주 계획 골격
   └─ 5) LLM → 설명/코칭 문구 (실패 시 템플릿)
   ▼
건강분석 결과(요약) ─▶ 나의 건강 프로파일 ─▶ 우선순위 TOP 3 ─▶ 12주 계획 ─▶ 마이페이지/대시보드
                                                                      │
                                                   (재방문) 주간 체크 ─▶ 최근 변화 / 재분석
```

---

## 4. Database Schema (Prisma 초안)

설계 원칙

- **최소수집**: 이름은 표시용 닉네임 허용, 생년월일은 연령 계산용(향후 출생연도만 저장 검토), 주민번호·주소·전화번호 수집 안 함.
- **원본 입력 / 엔진 결과 / LLM 결과 분리** → 재현성, 감사 가능성.
- **샘플 데이터 분리**: `User.isSample` 플래그 + 별도 seed, 운영 DB에는 seed 금지.
- 검진 지표는 컬럼이 아닌 `(metricCode, value, unit)` 행 구조 → 향후 OCR/마이데이터/웨어러블 지표 추가 시 스키마 변경 최소화.

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String?                     // 개발용 계정만 사용 (bcrypt/argon2), 평문 금지
  displayName   String
  isSample      Boolean   @default(false)   // 가상 사용자 구분
  consentAt     DateTime?                   // 수집 동의 시각
  consentVersion String?
  createdAt     DateTime  @default(now())
  deletedAt     DateTime?                   // 탈퇴 시 soft delete 후 배치 파기
  profile       Profile?
  assessments   Assessment[]
  sessions      Session[]
}

model Session {                              // 간단 세션 (또는 Auth.js 테이블로 대체)
  id        String   @id @default(cuid())
  userId    String
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Profile {
  userId     String   @id
  sex        Sex
  birthDate  DateTime @db.Date
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum Sex { MALE FEMALE }

/// 한 번의 "건강분석" 단위 (재분석 시 새 Assessment → 변화 추적)
model Assessment {
  id           String           @id @default(cuid())
  userId       String
  status       AssessmentStatus @default(DRAFT)
  checkupDate  DateTime?        @db.Date
  createdAt    DateTime         @default(now())
  submittedAt  DateTime?
  user         User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  measurements Measurement[]
  survey       SurveyResponse?
  medications  Medication[]
  result       AnalysisResult?
  plan         CarePlan?
}

enum AssessmentStatus { DRAFT SUBMITTED ANALYZED FAILED }

/// 검진·신체 계측 지표 (키/체중/허리둘레/혈압/혈당/지질/간/신장 …)
model Measurement {
  id           String     @id @default(cuid())
  assessmentId String
  metric       MetricCode
  value        Decimal    @db.Decimal(8, 2)
  unit         String                         // "mg/dL", "mmHg", "%", "cm", "kg" …
  source       DataSource @default(MANUAL)    // MANUAL | PDF_OCR | MYDATA | WEARABLE (향후)
  measuredAt   DateTime?
  assessment   Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  @@unique([assessmentId, metric])
}

enum MetricCode {
  HEIGHT WEIGHT BMI WAIST
  SBP DBP
  FASTING_GLUCOSE HBA1C
  TOTAL_CHOLESTEROL LDL HDL TRIGLYCERIDE
  AST ALT GGT
  CREATININE EGFR
}

enum DataSource { MANUAL PDF_OCR MYDATA WEARABLE }

/// 건강문진 + 생활습관 (문항 확장을 고려해 JSON + 버전)
model SurveyResponse {
  assessmentId  String   @id
  schemaVersion String                         // 예: "survey-v1"
  answers       Json                           // zod 스키마로 검증된 구조 (아래 5장 참고)
  assessment    Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
}

model Medication {
  id           String   @id @default(cuid())
  assessmentId String
  name         String                          // 자유입력 (MVP)
  purpose      String?
  frequency    String?                         // "1일 1회" 등
  drugCode     String?                         // 향후 의약품 DB 연동용 (MVP 미사용)
  assessment   Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
}

/// Rule Engine 결과 (결정적) + LLM 문구 분리 저장
model AnalysisResult {
  assessmentId   String   @id
  engineVersion  String                        // 예: "rules-2026.09-v1"
  inputHash      String                        // 동일 입력 재현성 확인
  domains        Json                          // DomainResult[]
  priorities     Json                          // PriorityItem[] (TOP 3)
  narrative      Json?                         // LLM 설명 (없으면 템플릿 사용)
  llmModel       String?
  createdAt      DateTime @default(now())
  assessment     Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
}

model CarePlan {
  id           String   @id @default(cuid())
  assessmentId String   @unique
  startDate    DateTime @db.Date
  weeks        PlanWeek[]
  assessment   Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
}

model PlanWeek {
  id          String   @id @default(cuid())
  planId      String
  weekNumber  Int                               // 1..12
  phase       PlanPhase
  goal        String
  actions     Json                              // string[]
  checks      Json                              // {id, label}[]
  coaching    String?                           // LLM 코칭 메시지
  plan        CarePlan  @relation(fields: [planId], references: [id], onDelete: Cascade)
  checkIns    WeeklyCheckIn[]
  @@unique([planId, weekNumber])
}

enum PlanPhase { FOUNDATION ACTIVATION MAINTENANCE }   // 1~4 / 5~8 / 9~12주

model WeeklyCheckIn {
  id         String   @id @default(cuid())
  weekId     String
  completed  Json                               // 체크 항목별 완료 여부
  weight     Decimal? @db.Decimal(5, 1)         // 선택 입력 → "최근 변화"
  note       String?
  createdAt  DateTime @default(now())
  week       PlanWeek @relation(fields: [weekId], references: [id], onDelete: Cascade)
}
```

---

## 5. Health Analysis Data Model

### 5.1 입력: `HealthSnapshot` (엔진의 유일한 입력)

```ts
type HealthSnapshot = {
  demographics: { sex: "MALE" | "FEMALE"; age: number };
  metrics: Partial<
    Record<MetricCode, { value: number; unit: string; source: DataSource }>
  >;
  survey: {
    exercise: {
      sessionsPerWeek?: number;
      dailySteps?: number;
      aerobicMinPerWeek?: number;
      strengthTraining?: boolean;
    };
    sleep: {
      avgHours?: number;
      bedtime?: string;
      wakeTime?: string;
      satisfaction?: 1 | 2 | 3 | 4 | 5;
    };
    diet: {
      breakfast?: Freq;
      lateNightSnack?: Freq;
      eatingOut?: Freq;
      vegetables?: Freq;
      fruits?: Freq;
      sugaryDrinks?: Freq;
      processedFood?: Freq;
    };
    alcohol: { frequency?: Freq; drinksPerOccasion?: number };
    smoking: {
      status?: "NEVER" | "FORMER" | "CURRENT";
      cigarettesPerDay?: number;
    };
    stress: { level?: 1 | 2 | 3 | 4 | 5 };
  };
  medications: { name: string; purpose?: string; frequency?: string }[]; // 엔진은 "복용 여부/목적 카테고리"만 참고, 판단 안 함
};
type Freq = "NEVER" | "RARELY" | "WEEKLY_1_2" | "WEEKLY_3_4" | "DAILY";
```

### 5.2 출력: `DomainResult` (10개 영역)

```ts
type DomainCode =
  | "WEIGHT"
  | "METABOLIC"
  | "CARDIOVASCULAR"
  | "GLYCEMIC"
  | "LIVER"
  | "KIDNEY"
  | "EXERCISE"
  | "SLEEP"
  | "DIET"
  | "LIFESTYLE";

type DomainStatus =
  "GOOD" | "NORMAL" | "ATTENTION" | "MANAGEMENT_NEEDED" | "DATA_INSUFFICIENT";

type DomainResult = {
  domain: DomainCode;
  status: DomainStatus;
  level: 1 | 2 | 3 | 4 | 5 | null; // ●●●○○ 표시용 (관리 필요도), 부족 시 null
  score: number; // 0–100 내부 관리필요 점수 (UI 비노출, 우선순위 계산용)
  findings: Finding[]; // 근거 (어떤 지표가 어떤 규칙에 해당했는지)
  completeness: number; // 0–1, 해당 영역 필요 데이터 충족률
  ruleIds: string[]; // 적용된 규칙 ID (감사/설명용)
};

type Finding = {
  metric?: MetricCode | string; // 검진지표 또는 문진 항목
  value?: number | string;
  band: "OPTIMAL" | "NORMAL" | "BORDERLINE" | "ELEVATED";
  messageKey: string; // 예: "glycemic.fasting.borderline" → 템플릿/LLM 설명 키
};
```

### 5.3 규칙 설계 방식

- 임계값은 코드가 아닌 `rules/*.ts` 설정으로 분리하고, **출처(국내 검진 판정기준·학회 가이드라인)를 주석으로 명시**. 최종 수치는 의료 자문으로 검증 필요.
- 예시 (값은 초안):

| 영역     | 사용 지표                         | 규칙 예시                                                                                                                |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 체중     | BMI, 허리둘레                     | BMI 23–24.9 → ATTENTION, ≥25 → MANAGEMENT_NEEDED / 허리둘레 남≥90·여≥85 → 한 단계 상향                                   |
| 대사     | 허리둘레, 혈압, 공복혈당, TG, HDL | 대사 관련 5개 요소 중 해당 개수로 판정 (0 GOOD, 1–2 ATTENTION, ≥3 MANAGEMENT_NEEDED) — "대사증후군" 명칭은 사용하지 않음 |
| 심혈관   | 혈압, LDL, 총콜레스테롤, 흡연     | 혈압 구간 + LDL 구간 + 흡연 가중                                                                                         |
| 혈당     | 공복혈당, HbA1c                   | FBG 100–125 또는 A1c 5.7–6.4 → ATTENTION, 그 이상 → MANAGEMENT_NEEDED                                                    |
| 간       | AST, ALT, γ-GTP, 음주             | 기준 초과 개수 + 음주 동반 시 가중                                                                                       |
| 신장     | 크레아티닌, eGFR                  | eGFR 60–89 → ATTENTION(연령 고려), <60 → MANAGEMENT_NEEDED                                                               |
| 운동     | 운동횟수, 걸음수, 유산소 분, 근력 | 주 150분 유산소·주 2회 근력 기준 대비 충족률                                                                             |
| 수면     | 수면시간, 규칙성, 만족도          | 7–8시간 & 만족도 → GOOD, <6 또는 >9 → ATTENTION 이상                                                                     |
| 식습관   | 7개 식습관 문항                   | 문항별 점수 합산                                                                                                         |
| 생활습관 | 음주, 흡연, 스트레스              | 현재 흡연 → MANAGEMENT_NEEDED, 고위험 음주·고스트레스 가중                                                               |

- **DATA_INSUFFICIENT**: 영역 필수 입력 충족률 < 50%일 때. 결과 화면에서 "이 항목을 입력하면 더 정확해져요"로 안내.
- 복용약 입력 시(예: 목적 "혈압") 해당 영역 설명에 "현재 관리 중인 영역" 태그만 붙이고, 수치 판정·약물 평가는 하지 않음.

### 5.4 Priority Engine

```ts
type PriorityItem = {
  rank: 1 | 2 | 3;
  domain: DomainCode;
  priorityScore: number; // 내부값, UI 비노출
  reasons: string[]; // messageKey 목록 (근거)
  relatedDomains: DomainCode[]; // 함께 좋아지는 영역 (예: 체중 → 대사·혈당)
};
```

`priorityScore = 영역 score × 가중치(임상지표 영역 > 생활습관 영역)`
`+ 동반이상 보너스 (같은 축의 지표가 여러 개 동시에 경계 이상일 때)`
`+ 연결효과 보너스 (해당 영역 개선이 다른 관리필요 영역에 영향: 체중·운동 등)`
`+ 실천 가능성 (생활습관 영역은 행동계획으로 바로 연결 가능)`
`× 데이터 충분성 계수 (completeness)`

- 동점 시 고정된 영역 순서로 정렬 → **결정성 보장**.
- GOOD/NORMAL만 있으면 "현재 상태 유지" 중심 TOP 3(유지형 계획)를 제공.
- 질병 확률·위험도 %는 생성하지 않음.

### 5.5 LLM 입력/출력 계약

- 입력: `{ domains, priorities, planSkeleton, userContext: { ageGroup: "50대", sex } }` — **이름·이메일·생년월일 등 식별정보 미전달**.
- 출력(JSON Schema 강제): `{ summary, domainExplanations{}, priorityExplanations[], weeklyCoaching[] }`
- Safety Guard: 금지 패턴("~입니다(질병명)", "위험이 N%", "약을 중단/복용하세요", "병원에 갈 필요 없") 정규식 검사 → 위반 시 재생성 1회 → 실패 시 템플릿 문구.
- 모든 결과 화면 하단 고정 문구: "본 결과는 건강관리 참고용이며 의학적 진단이 아닙니다. 정확한 판단은 의료진과 상담하시기 바랍니다."

---

## 6. API 구조

폼 입력은 **Server Actions**, 외부 확장이 예상되는 엔드포인트는 **Route Handlers(`/api/*`)** 로 둡니다. 모든 건강정보는 POST body로만 전달.

| 구분       | 메서드 / 경로 (또는 Action)                      | 설명                                                   |
| ---------- | ------------------------------------------------ | ------------------------------------------------------ |
| Auth       | `POST /api/auth/login` · `POST /api/auth/logout` | 개발용 계정/이메일 로그인 (향후 Auth.js 교체 가능)     |
| Assessment | `createAssessment()`                             | 새 분석 시작(DRAFT 생성)                               |
|            | `saveProfile(input)`                             | 기본정보 저장                                          |
|            | `saveMeasurements(assessmentId, metrics[])`      | 검진 지표 저장 (BMI 자동계산)                          |
|            | `saveSurvey(assessmentId, answers)`              | 문진/생활습관 저장                                     |
|            | `saveMedications(assessmentId, meds[])`          | 복용약 저장                                            |
| Analysis   | `POST /api/assessments/{id}/analyze`             | 엔진 실행 → 결과 저장 → LLM 설명 생성 (멱등)           |
|            | `GET /api/assessments/{id}/result`               | 분석 결과 조회 (소유자 검증)                           |
| Plan       | `GET /api/assessments/{id}/plan`                 | 12주 계획 조회                                         |
|            | `POST /api/plan-weeks/{weekId}/check-in`         | 주간 체크 기록                                         |
| User       | `GET /api/me` · `DELETE /api/me`                 | 내 정보 · 전체 데이터 삭제                             |
| Dev        | `POST /api/dev/load-sample`                      | 가상 사용자 A~E 로드 (`NODE_ENV!=='production'`에서만) |
| 향후       | `POST /api/imports/pdf`, `/api/integrations/*`   | OCR·마이데이터·웨어러블 (MVP 미구현, 자리만 설계)      |

---

## 7. Folder Structure

```
.
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed/                     # 가상 사용자 A~E (개발 DB 전용)
│     ├─ samples/userA-good.ts … userE-complex.ts
│     └─ index.ts
├─ src/
│  ├─ app/                      # Next.js App Router
│  │  ├─ (marketing)/page.tsx   # Landing
│  │  ├─ (marketing)/about/
│  │  ├─ (auth)/login/
│  │  ├─ assessment/            # 입력 위저드 (profile/checkup/survey/lifestyle/medications/review/analyzing)
│  │  ├─ report/                # 결과 · profile · priorities · plan
│  │  ├─ dashboard/
│  │  ├─ mypage/
│  │  ├─ dev/samples/
│  │  └─ api/                   # Route Handlers
│  ├─ components/
│  │  ├─ ui/                    # Button, Card, Input, Stepper, LevelDots(●●●○○), StatusBadge …
│  │  ├─ assessment/
│  │  └─ report/
│  ├─ features/                 # 기능별 server actions + zod 스키마
│  │  ├─ assessment/
│  │  ├─ report/
│  │  └─ plan/
│  ├─ domain/                   # ★ 프레임워크 비의존 순수 로직 (단위테스트 핵심)
│  │  ├─ health-snapshot/       # 타입, 정규화, BMI 계산
│  │  ├─ analysis/
│  │  │  ├─ rules/              # 임계값 설정 (출처 주석)
│  │  │  ├─ evaluators/         # weight.ts, metabolic.ts … lifestyle.ts
│  │  │  └─ engine.ts
│  │  ├─ priority/
│  │  └─ plan/                  # 12주 템플릿 & 조립기
│  ├─ server/                   # server-only
│  │  ├─ db.ts                  # Prisma client
│  │  ├─ auth/
│  │  ├─ ai/
│  │  │  ├─ provider.ts         # LLM Provider 인터페이스
│  │  │  ├─ prompts/
│  │  │  ├─ safety-guard.ts     # 금지표현 필터
│  │  │  └─ fallback-templates.ts
│  │  ├─ adapters/              # ManualInputAdapter (MVP), PdfOcrAdapter 등 인터페이스
│  │  └─ logger.ts              # PII 마스킹 로거
│  ├─ content/                  # 용어 쉬운 설명, 영역 설명, messageKey → 한국어 문구
│  └─ lib/                      # 공통 유틸
├─ tests/
│  ├─ unit/                     # 엔진·우선순위·계획·safety guard (Vitest)
│  └─ e2e/                      # 핵심 Flow (Playwright)
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ PRIVACY_AND_COMPLIANCE.md # 법규 검토 필요사항 문서화
│  └─ RULES_REFERENCE.md        # 규칙 임계값 출처
├─ .env.example                 # DATABASE_URL, LLM_API_KEY, SESSION_SECRET (값 없음)
└─ package.json
```

---

## 8. 개발 단계별 Roadmap

| STEP | 내용                                                                                | 완료 기준                         |
| ---- | ----------------------------------------------------------------------------------- | --------------------------------- |
| 1    | 프로젝트 셋업: Next.js+TS+Tailwind, ESLint/Prettier, Vitest, Prisma, `.env.example` | `dev`/`lint`/`test` 통과          |
| 2    | 페이지 골격·라우팅·공통 레이아웃·디자인 토큰                                        | 모든 페이지 빈 화면 이동 가능     |
| 3    | DB Schema·마이그레이션·Prisma client                                                | 로컬 Postgres 마이그레이션 성공   |
| 4    | UI 구현: Landing, 입력 위저드(검증·임시저장), 공통 컴포넌트                         | 모바일(360px) 기준 입력 Flow 완주 |
| 5    | 샘플 데이터 A~E seed + 개발용 불러오기                                              | seed 실행, 5명 로드 가능          |
| 6    | Rule-based Engine + Priority Engine + 단위테스트                                    | A~E 기대 결과 스냅샷 테스트 통과  |
| 7    | AI 연동: Provider, 프롬프트, JSON 스키마, Safety Guard, Fallback                    | LLM 없이도 결과 화면 정상         |
| 8    | 결과 Dashboard (프로파일 카드·TOP3·주요 데이터)                                     | A~E 결과 화면 확인                |
| 9    | 12주 계획 + 주간 체크 + 최근 변화                                                   | 체크 기록 → 대시보드 반영         |
| 10   | 테스트: 엔진 경계값, 금지표현, E2E, 접근성, 보안 점검                               | CI 통과                           |
| 11   | 배포: Vercel + 관리형 Postgres(Neon/Supabase 등), 환경변수 설정                     | 데모 URL 동작                     |

각 STEP 종료 시 lint·타입체크·테스트 확인 후 다음 단계로 진행합니다.

---

## 9. MVP에서 제외할 기능

| 제외 기능                              | 이유 / 대비                                                |
| -------------------------------------- | ---------------------------------------------------------- |
| 의료 마이데이터, 병원 EMR, 보험사 연동 | 제휴·인증·법적 요건 필요 → `adapters/` 인터페이스만 설계   |
| 웨어러블 실시간 연동, CGM              | 기기별 SDK·동기화 복잡 → `Measurement.source` 로 확장 준비 |
| PDF 업로드·OCR                         | 정확도 검증 필요 → `PdfOcrAdapter` 자리만 확보             |
| 의약품 DB 연동, 약물 상호작용 판단     | 의료적 판단 영역 → `drugCode` 필드만 예약                  |
| 결제·유료 구독                         | 가치 검증 후                                               |
| 전문가 상담 예약·코칭                  | 운영 조직 필요                                             |
| 기업/검진센터 관리자, 복잡한 어드민    | 멀티테넌시 설계는 이후                                     |
| 대규모 회원관리·소셜 로그인            | 개발용 계정/이메일로 충분                                  |
| 질병 확률·위험도(%) 예측               | 검증되지 않은 수치 생성 금지 원칙                          |
| 푸시 알림·네이티브 앱                  | 모바일 웹 우선                                             |

---

## 10. 예상되는 기술적 위험요소

| 위험                                   | 영향                                                              | 대응                                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **규제 경계 (의료기기/의료행위 해석)** | 서비스 표현에 따라 의료기기 SW 또는 무면허 의료행위로 해석될 소지 | 진단·처방 표현 금지, "건강관리 우선순위" 용어 고정, 출시 전 법률·규제 자문 (식약처 웰니스 가이드라인 검토)               |
| **개인정보·민감정보(건강정보) 처리**   | 개인정보보호법상 민감정보 별도 동의 필요                          | 최소수집, 별도 동의 화면, 암호화 전송(HTTPS), DB 접근 통제, 삭제 기능, PII 마스킹 로거, `PRIVACY_AND_COMPLIANCE.md` 작성 |
| **LLM 제3자 전송**                     | 건강정보가 외부 API로 전송됨                                      | 식별정보 제거한 구조화 JSON만 전송, 데이터 미학습/보관 정책 확인, 처리위탁 고지                                          |
| **규칙 임계값의 정확성**               | 잘못된 기준 → 잘못된 안내                                         | 임계값 설정 분리·출처 명시·엔진 버전 기록, 의료 자문 검토 항목으로 관리                                                  |
| **LLM 환각·금지표현**                  | 진단성 문구, 결과 불일치                                          | LLM은 설명만, JSON Schema 강제, Safety Guard, Fallback 템플릿, 상태값은 엔진 값으로 덮어쓰기                             |
| **결과 일관성**                        | 같은 입력에 다른 문구                                             | 엔진 결정성 + `inputHash` 캐싱으로 동일 입력 시 저장된 설명 재사용, temperature 낮게                                     |
| **사용자 입력 오류 (단위·오타)**       | 비정상 값으로 오판정                                              | 항목별 허용 범위·단위 표시, 이상값 확인 모달, "모름" 선택지                                                              |
| **데이터 누락**                        | 결과 신뢰도 저하                                                  | DATA_INSUFFICIENT 상태와 입력 유도, 충분성 계수로 우선순위 보정                                                          |
| **LLM 지연·비용·장애**                 | 분석 화면 대기, 실패                                              | 엔진 결과 먼저 표시 후 설명 비동기 로딩, 타임아웃·재시도, 템플릿 대체                                                    |
| **Vercel 서버리스 제약**               | 함수 타임아웃, DB 커넥션 고갈                                     | 분석 단계 분리, 커넥션 풀러(Prisma Accelerate/pgbouncer) 사용                                                            |
| **중장년층 사용성**                    | 이탈                                                              | 큰 글씨·충분한 터치영역·단계별 입력·용어 툴팁, 색상+텍스트+점(●) 병행 표기                                               |

---

## 승인 요청 사항

1. 위 Architecture / DB Schema / Data Model 방향 승인 여부
2. 인증 방식: **개발용 계정(이메일+비밀번호)** vs **이메일 매직링크** — 권장: MVP 데모는 개발용 계정
3. LLM 공급자 선택 (Provider 추상화로 교체 가능)
4. 배포용 PostgreSQL 공급자 (Neon / Supabase / Vercel Postgres 등)
