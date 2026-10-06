import Link from "next/link";
import { StepPage } from "@/components/assessment/step-page";
import {
  FormSection,
  InputField,
  NumberField,
} from "@/components/form/controls";
import { StepForm } from "@/components/form/step-form";
import { Card } from "@/components/ui/card";
import {
  METRIC_GROUPS,
  METRICS,
  metricsByGroup,
} from "@/domain/health-snapshot/metrics";
import { saveCheckup } from "@/features/assessment/actions";
import { loadStep } from "@/features/assessment/load-step";
import { CHECKUP_INPUT_CODES } from "@/features/assessment/schemas";
import { assessmentStepPath, routes } from "@/lib/routes";
import { ButtonLink } from "@/components/ui/button-link";
import { isCheckupPhotoAvailable } from "@/server/ai/checkup-reader";
import { db } from "@/server/db";
import { listCheckupConnectors } from "@/server/integrations/checkup/connectors";

export const metadata = { title: "건강검진 | 입체적 건강분석" };

const inputCodes = new Set<string>(CHECKUP_INPUT_CODES);

export default async function CheckupStepPage() {
  const { assessmentId, inputs, prevHref } = await loadStep("checkup");
  const photoCount = await db.measurement.count({
    // BMI는 자동 계산값이라 제외
    where: { assessmentId, source: "PHOTO_OCR", metric: { not: "BMI" } },
  });
  const photoAvailable = isCheckupPhotoAvailable();
  const plannedConnectors = listCheckupConnectors().filter(
    (c) => c.status() === "planned",
  );
  const defaults: Record<string, string> = {};
  if (inputs.checkupDate)
    defaults.checkupDate = inputs.checkupDate.toISOString().slice(0, 10);
  for (const code of CHECKUP_INPUT_CODES) {
    if (inputs.metrics[code] !== undefined)
      defaults[code] = String(inputs.metrics[code]);
  }
  const { HEIGHT, WEIGHT, BMI } = inputs.metrics;

  return (
    <StepPage slug="checkup">
      <Card>
        <p className="font-semibold">입력이 번거로우신가요?</p>
        {photoAvailable ? (
          <>
            <p className="text-muted mt-1 text-sm leading-relaxed">
              결과표를 사진으로 찍으면 수치를 읽어 채워 드려요.
            </p>
            <ButtonLink href={routes.checkupPhoto} className="mt-3 w-full">
              📷 결과표 사진으로 입력
            </ButtonLink>
          </>
        ) : (
          // API Key가 없으면 기능을 숨기지 않고 "준비 중"으로 보여준다 (설정 누락을 알아차릴 수 있게)
          <p className="text-muted mt-1 text-sm leading-relaxed">
            📷 결과표 사진으로 입력하는 기능은 준비 중이에요. 지금은 아래에 직접
            입력해 주세요.
          </p>
        )}
        {plannedConnectors.length > 0 && (
          <p className="text-muted mt-3 text-xs">
            {plannedConnectors.map((c) => c.name).join("·")} 결과 자동
            불러오기는 준비 중이에요.
          </p>
        )}
      </Card>
      {photoCount > 0 && (
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900"
        >
          사진에서 읽어 온 값 {photoCount}개가 들어 있어요. 결과표와 한 번 더
          비교해 주세요.
        </p>
      )}
      <Card className="bg-primary/5 border-primary/20">
        <p className="leading-relaxed">
          건강검진 결과표를 옆에 두고 입력해 주세요.{" "}
          <strong>모르는 항목은 비워두셔도 괜찮아요.</strong> 입력한 항목이
          많을수록 분석이 정확해집니다.
        </p>
      </Card>
      <StepForm action={saveCheckup} defaults={defaults} prevHref={prevHref}>
        <InputField
          name="checkupDate"
          label="검진 받은 날짜"
          type="date"
          optional
        />
        {METRIC_GROUPS.map(({ group, label }) => (
          <FormSection key={group} title={label} collapsible>
            {group === "BODY" && (
              <div className="bg-background flex flex-col gap-2 rounded-xl p-3 text-center text-sm">
                <dl className="grid grid-cols-3 gap-2">
                  {[
                    { label: "키", value: HEIGHT, unit: "cm" },
                    { label: "체중", value: WEIGHT, unit: "kg" },
                    { label: "BMI", value: BMI, unit: "" },
                  ].map((m) => (
                    <div key={m.label}>
                      <dt className="text-muted">{m.label}</dt>
                      <dd className="font-semibold">
                        {m.value !== undefined ? `${m.value}${m.unit}` : "-"}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-muted text-xs">
                  키·체중은{" "}
                  <Link
                    href={assessmentStepPath("profile")}
                    className="underline"
                  >
                    기본정보
                  </Link>
                  에서 수정할 수 있고, BMI는 자동 계산됩니다.
                </p>
              </div>
            )}
            {metricsByGroup(group)
              .filter((m) => inputCodes.has(m.code))
              .map((m) => (
                <NumberField
                  key={m.code}
                  name={m.code}
                  label={m.label}
                  unit={m.unit}
                  decimals={m.decimals}
                  help={m.help}
                  optional
                />
              ))}
          </FormSection>
        ))}
        <p className="text-muted text-xs">
          ※ {METRICS.HBA1C.label} 등 검진 항목에 없는 값은 비워두세요.
        </p>
      </StepForm>
    </StepPage>
  );
}
