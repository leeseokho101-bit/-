import type {
  ImportSource,
  RawCheckupData,
} from "@/domain/checkup-import/types";

/**
 * 외부 검진 데이터 연동(커넥터) 공통 인터페이스.
 *
 * 연동처가 정해지면 transport(실제 API 호출)만 구현해 끼우면 된다.
 * 응답 → 공통 형식 변환(mapper)과 이후 검증·저장 흐름은 이미 준비되어 있다.
 * 흐름: transport.fetch → mapper → normalizeCheckup → applyImportedCheckup
 */
export type CheckupConnectorId = "nhis" | "checkup-center";

/** 사용자가 연동에 동의·인증한 결과 (간편인증·마이데이터 토큰 등). 연동 방식 확정 후 구체화 */
export type ConnectorAuthorization = {
  /** 연동처가 발급한 접근 토큰 — DB에 저장할 때는 반드시 암호화 */
  accessToken: string;
  /** 연동처의 사용자 식별값 (주민등록번호 사용 금지) */
  subject?: string;
};

export interface CheckupTransport<TResponse> {
  fetchLatest(auth: ConnectorAuthorization): Promise<TResponse>;
}

export type ConnectorStatus =
  /** 연동 준비 중 (transport 미구현 또는 설정 없음) */
  | "planned"
  /** 사용 가능 */
  | "available";

export interface CheckupConnector {
  readonly id: CheckupConnectorId;
  readonly name: string;
  readonly description: string;
  readonly source: ImportSource;
  status(): ConnectorStatus;
  /** 최신 검진 결과를 공통 형식으로 가져온다 */
  fetchLatest(auth: ConnectorAuthorization): Promise<RawCheckupData>;
}

export class ConnectorNotConfiguredError extends Error {
  constructor(readonly connectorId: CheckupConnectorId) {
    super(`checkup connector not configured: ${connectorId}`);
  }
}
