"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form/form-message";
import { SubmitButton } from "@/components/form/submit-button";
import { Card } from "@/components/ui/card";
import { consentItems } from "@/content/consent";
import { startAssessment } from "./start-actions";

function Checkbox({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 py-1">
      <input
        type="checkbox"
        name={name}
        className="accent-primary mt-1 size-5 shrink-0"
      />
      <span className="leading-relaxed">{children}</span>
    </label>
  );
}

export function StartAssessmentForm({
  needsConsent,
  hasDraft,
}: {
  needsConsent: boolean;
  hasDraft: boolean;
}) {
  const [state, action] = useActionState(startAssessment, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      {needsConsent && (
        <Card>
          <h2 className="mb-3 font-bold">
            개인정보·건강정보 수집 및 이용 안내
          </h2>
          <dl className="flex flex-col gap-3 text-sm leading-relaxed">
            {consentItems.map((item) => (
              <div key={item.title}>
                <dt className="font-semibold">{item.title}</dt>
                <dd className="text-muted">{item.body}</dd>
              </div>
            ))}
          </dl>
          <div className="border-border mt-4 flex flex-col gap-1 border-t pt-4">
            <Checkbox name="consentPrivacy">
              [필수] 개인정보 수집·이용에 동의합니다.
            </Checkbox>
            <Checkbox name="consentHealth">
              [필수] 민감정보(건강정보) 수집·이용에 동의합니다.
            </Checkbox>
          </div>
        </Card>
      )}
      <FormMessage message={state.message} />
      <SubmitButton pendingText="준비 중…">
        {needsConsent
          ? "동의하고 시작하기"
          : hasDraft
            ? "이어서 입력하기"
            : "새 분석 시작하기"}
      </SubmitButton>
    </form>
  );
}
