import "server-only";
import {
  fromFhirObservations,
  type FhirObservation,
} from "@/domain/checkup-import/fhir";
import { fromNhisRecord } from "@/domain/checkup-import/nhis";
import type {
  ImportSource,
  RawCheckupData,
} from "@/domain/checkup-import/types";
import {
  ConnectorNotConfiguredError,
  type CheckupConnector,
  type CheckupConnectorId,
  type CheckupTransport,
  type ConnectorAuthorization,
  type ConnectorStatus,
} from "./types";

/** 응답 형식만 다르고 흐름은 같은 커넥터 */
class MappedConnector<T> implements CheckupConnector {
  constructor(
    readonly id: CheckupConnectorId,
    readonly name: string,
    readonly description: string,
    readonly source: ImportSource,
    private readonly map: (response: T) => RawCheckupData,
    private readonly transport?: CheckupTransport<T>,
  ) {}

  status(): ConnectorStatus {
    return this.transport ? "available" : "planned";
  }

  async fetchLatest(auth: ConnectorAuthorization): Promise<RawCheckupData> {
    if (!this.transport) throw new ConnectorNotConfiguredError(this.id);
    return this.map(await this.transport.fetchLatest(auth));
  }
}

/**
 * 국민건강보험공단 건강검진 결과.
 * 연동 경로 후보: 공공 마이데이터(행정안전부) / 건강보험 마이데이터 / 건강정보 고속도로(보건복지부).
 * 응답은 항목명 → 값 형태(공단 결과표 항목명)로 가정하고 fromNhisRecord로 변환한다.
 */
export function createNhisConnector(
  transport?: CheckupTransport<Record<string, unknown>>,
): CheckupConnector {
  return new MappedConnector(
    "nhis",
    "국민건강보험공단",
    "공단에서 받은 일반건강검진 결과를 불러옵니다.",
    "NHIS",
    fromNhisRecord,
    transport,
  );
}

/**
 * 건강검진센터(검진기관) 결과. 의료기관 표준인 HL7 FHIR R4 Observation(LOINC 코드)으로 받는다.
 */
export function createCheckupCenterConnector(
  transport?: CheckupTransport<FhirObservation[]>,
): CheckupConnector {
  return new MappedConnector(
    "checkup-center",
    "건강검진센터",
    "제휴 검진센터의 검진 결과를 불러옵니다.",
    "CHECKUP_CENTER",
    fromFhirObservations,
    transport,
  );
}

/**
 * 등록된 커넥터 목록. 현재는 연동 계약 전이라 transport 없이 "준비 중"으로 등록한다.
 * 연동 시: createNhisConnector(new NhisHttpTransport(...)) 처럼 transport를 넘긴다.
 */
export function listCheckupConnectors(): CheckupConnector[] {
  return [createNhisConnector(), createCheckupCenterConnector()];
}

export function getCheckupConnector(
  id: CheckupConnectorId,
): CheckupConnector | undefined {
  return listCheckupConnectors().find((c) => c.id === id);
}
