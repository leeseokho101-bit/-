/**
 * CGM 제조사 연동(커넥터) 틀.
 *
 * 제조사별 파트너 API 계약이 필요하다 (계획서 6장 "기기 연동": 2종 이상 확보 목표).
 * 계약 전까지는 CGM 앱에서 내보낸 CSV 파일 올리기(src/domain/glp1/csv.ts)로 받는다.
 * 연동이 정해지면 fetchReadings만 구현하면 저장(importGlucose)·지표 계산 흐름은 그대로 쓴다.
 */
export type CgmConnectorStatus = "planned" | "available";

export type CgmAuthorization = {
  /** 제조사가 발급한 접근 토큰 — DB에 저장할 때는 반드시 암호화 */
  accessToken: string;
};

export interface CgmConnector {
  readonly id: string;
  readonly name: string;
  status(): CgmConnectorStatus;
  /** since 이후 측정값 */
  fetchReadings(
    auth: CgmAuthorization,
    since: Date,
  ): Promise<{ measuredAt: Date; mgdl: number }[]>;
}

export class CgmConnectorNotConfiguredError extends Error {
  constructor(readonly connectorId: string) {
    super(`cgm connector not configured: ${connectorId}`);
  }
}

function planned(id: string, name: string): CgmConnector {
  return {
    id,
    name,
    status: () => "planned",
    fetchReadings: async () => {
      throw new CgmConnectorNotConfiguredError(id);
    },
  };
}

/** 제휴 확정 전이라 제조사 이름 대신 순서로 표시한다 */
export const cgmConnectors: readonly CgmConnector[] = [
  planned("cgm-partner-1", "CGM 제조사 연동 1"),
  planned("cgm-partner-2", "CGM 제조사 연동 2"),
];
