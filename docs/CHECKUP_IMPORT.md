# 건강검진 데이터 가져오기 (사진 판독 · 외부 연동)

직접 입력이 어려운 사용자를 위해 건강검진 수치를 **자동으로 채우는 두 가지 경로**를 둔다.

| 경로                        | 상태                         | 저장 출처(`Measurement.source`) |
| --------------------------- | ---------------------------- | ------------------------------- |
| 결과표 사진 판독            | **사용 가능** (API Key 필요) | `PHOTO_OCR`                     |
| 국민건강보험공단 연동       | 준비 중 (틀만 구현)          | `NHIS`                          |
| 건강검진센터(검진기관) 연동 | 준비 중 (틀만 구현)          | `CHECKUP_CENTER`                |

모든 경로는 같은 흐름을 탄다.

```
출처별 원본 ──► 변환기(mapper) ──► 공통 형식 RawCheckupData
                                        │
                                normalizeCheckup()  단위 변환·허용 범위·혈압 순서·검진일 검사
                                        │
                              사용자 확인 화면 (수정·삭제 가능)
                                        │
                          applyImportedCheckup()  가져온 항목만 저장, BMI 재계산, 출처 기록
```

- 판정은 하지 않는다. 가져온 값은 직접 입력한 값과 똑같이 분석 엔진(`src/domain/analysis`)이 판정한다.
- 허용 범위 밖·알 수 없는 단위의 값은 **버리고 경고**를 보여준다 (잘못 읽은 값이 저장되지 않도록).
- 가져온 항목만 덮어쓰고, 없는 항목은 지우지 않는다 (직접 입력한 값 보존).
- 사용자가 건강검진 화면에서 값을 그대로 두고 저장하면 출처가 유지되고, 고친 값만 `MANUAL`로 바뀐다.

## 1. 결과표 사진 판독

### 사용자 흐름

1. 건강검진 단계 → **📷 결과표 사진으로 입력** (`/assessment/checkup/photo`)
2. 사진 촬영·선택 + 전송 안내 동의 체크 → **사진에서 수치 읽기**
3. 확인 화면: 읽은 값이 채워진 입력칸 + 경고. 고치거나 지운 뒤 **확인했어요, 저장**
4. 건강검진 화면으로 돌아와 "사진에서 읽어 온 값 N개" 안내와 함께 표시

사진 판독은 **확인 후 저장**한다. 한 글자만 잘못 읽어도 관리 우선순위가 달라질 수 있어서, AI가 읽은 값을 바로 저장하지 않고 사용자가 한 번 보고 누르게 했다.

### 구현

| 위치                                           | 역할                                                            |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `src/features/checkup-import/photo-import.tsx` | 브라우저에서 사진을 긴 변 2000px JPEG로 줄여 업로드, 확인 폼    |
| `src/features/checkup-import/actions.ts`       | Server Action: 판독(`readPhotoAction`)·저장(`saveImportAction`) |
| `src/features/checkup-import/service.ts`       | 형식·크기·하루 횟수 확인 → 판독 → 검증, 저장                    |
| `src/server/ai/checkup-reader.ts`              | Claude 비전 + 구조화 출력(JSON Schema)으로 수치만 받음          |
| `src/server/ai/prompts.ts`                     | `CHECKUP_PHOTO_SYSTEM_PROMPT` (참고치 열 제외, 추측 금지 등)    |
| `src/domain/checkup-import/*`                  | 공통 형식·단위 변환·검증 (순수 함수, 단위 테스트)               |

- 모델: `LLM_MODEL`(기본 `claude-opus-5`), effort `medium`, 정책 거절 시 서버 측 자동 대체(fallbacks).
- `ANTHROPIC_API_KEY`가 없으면 사진 버튼을 숨기고 직접 입력만 안내한다.
- 제한: JPG·PNG·WEBP(파일 시그니처로 확인), 4MB 이하, 사용자당 24시간 10회 (`PHOTO_DAILY_LIMIT`).
- 실행 시간: 사진 페이지 `maxDuration = 90`초.

### 개인정보

- 사진은 메모리에서만 쓰고 **DB·로그·파일로 저장하지 않는다**.
- 출력 형식(JSON Schema)에 이름·주민등록번호 필드가 없어 식별정보를 돌려받지 않는다.
- 사진은 Anthropic(미국)으로 전송된다 → 사용할 때마다 전송 안내에 동의를 받는다. 이름·주민등록번호를 가리고 찍도록 안내한다.
- `checkup_imports` 표에는 시각·출처·상태·항목 수·실패 종류만 남는다 (값·이미지 없음). 회원 삭제 시 함께 삭제된다.

### 비용

사진 1장 = Claude API 호출 1회(이미지 입력 약 1.5~2천 토큰 + 출력 수백 토큰). 하루 10회 제한으로 사용자당 비용 상한을 둔다. Anthropic Console에서 월 사용 한도를 함께 설정할 것.

## 2. 외부 연동 (건강보험공단 · 검진센터) — 향후 연결용 틀

현재는 **연결하지 않는다**. 연동처가 정해지면 실제 API 호출부(transport)만 구현해 끼우면 되도록 나머지를 준비해 두었다.

| 위치                                            | 내용                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `src/server/integrations/checkup/types.ts`      | `CheckupConnector`, `CheckupTransport`, `ConnectorAuthorization` 인터페이스 |
| `src/server/integrations/checkup/connectors.ts` | 공단·검진센터 커넥터, 등록 목록(`listCheckupConnectors`)                    |
| `src/domain/checkup-import/nhis.ts`             | 공단 결과표 항목명 → 지표 (`신장`, `식전혈당`, `혈압 "120/80"` 등)          |
| `src/domain/checkup-import/fhir.ts`             | HL7 FHIR R4 Observation(LOINC 코드) → 지표                                  |

지금 화면에는 "국민건강보험공단·건강검진센터 결과 자동 불러오기는 준비 중이에요"로만 표시된다.

### 연동할 때 할 일

1. **연동 경로 확정** (사업·법무 검토 필요)
   - 건강보험공단: 공공 마이데이터(행정안전부) / 의료·건강 마이데이터 / 보건복지부 '건강정보 고속도로(나의건강기록)' 등. 대부분 본인 인증(간편인증)과 기관 제휴·심사가 필요하다.
   - 검진센터: 제휴 검진기관과 API 계약. 표준 FHIR를 쓰면 `fromFhirObservations`를 그대로 쓴다.
2. **transport 구현**: `CheckupTransport.fetchLatest(auth)` — 실제 HTTP 호출. 응답 필드명이 다르면 `NHIS_FIELD_ALIASES`에 별칭만 추가.
3. **등록**: `listCheckupConnectors()`에서 `createNhisConnector(new NhisTransport(...))`처럼 transport를 넘기면 상태가 `available`로 바뀐다.
4. **연결 상태 저장 표**(예: `CheckupConnection` — 사용자·연동처·동의 시각·마지막 동기화) 추가. 접근 토큰은 **반드시 암호화**해 저장하고, 주민등록번호는 저장하지 않는다.
5. **화면**: 연결하기(인증) → 불러오기 → 사진 판독과 같은 **확인 화면** → `applyImportedCheckup(tx, assessmentId, data, connector.source)`.
6. **동의**: 연동처별 제3자 제공·수집 동의 문구 (법률 검토).

## 3. 테스트

- `tests/unit/checkup-import.test.ts`: 단위 변환, 검증, 공단·FHIR 변환, 이미지 형식, 판독기 요청 형식, 확인 폼, 커넥터
- `tests/integration/checkup-import.test.ts`: 판독 기록·하루 제한·실패 기록, 확인 저장(출처·BMI·기존 값 보존), 본인·1회 저장, 회원 삭제 시 삭제
- `tests/e2e/checkup-photo.spec.ts`: API Key가 없을 때 직접 입력으로 안내
