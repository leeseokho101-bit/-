"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, TextInput } from "@/components/form/field";
import { FormMessage } from "@/components/form/form-message";
import { SubmitButton } from "@/components/form/submit-button";
import type { FormState } from "@/lib/form-state";
import { routes } from "@/lib/routes";
import { login, signup } from "./actions";

const initial: FormState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, initial);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <FormMessage message={state.message} />
      <Field id="email" label="이메일" error={state.fieldErrors?.email}>
        <TextInput
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email}
          required
        />
      </Field>
      <Field id="password" label="비밀번호" error={state.fieldErrors?.password}>
        <TextInput
          id="password"
          type="password"
          autoComplete="current-password"
          error={state.fieldErrors?.password}
          required
        />
      </Field>
      <SubmitButton pendingText="로그인 중…">로그인</SubmitButton>
      <p className="text-muted text-center text-sm">
        처음이신가요?{" "}
        <Link
          href={
            next
              ? `${routes.signup}?next=${encodeURIComponent(next)}`
              : routes.signup
          }
          className="text-primary font-semibold underline"
        >
          계정 만들기
        </Link>
      </p>
    </form>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signup, initial);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <FormMessage message={state.message} />
      <Field
        id="displayName"
        label="이름 또는 별명"
        help="화면에 표시할 이름입니다. 실명이 아니어도 괜찮아요."
        error={state.fieldErrors?.displayName}
      >
        <TextInput
          id="displayName"
          autoComplete="nickname"
          maxLength={20}
          defaultValue={state.values?.displayName}
          error={state.fieldErrors?.displayName}
          help
          required
        />
      </Field>
      <Field id="email" label="이메일" error={state.fieldErrors?.email}>
        <TextInput
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email}
          required
        />
      </Field>
      <Field
        id="password"
        label="비밀번호"
        help="8자 이상으로 입력해 주세요."
        error={state.fieldErrors?.password}
      >
        <TextInput
          id="password"
          type="password"
          autoComplete="new-password"
          error={state.fieldErrors?.password}
          help
          required
        />
      </Field>
      <SubmitButton pendingText="가입 중…">가입하고 시작하기</SubmitButton>
      <p className="text-muted text-center text-sm">
        이미 계정이 있으신가요?{" "}
        <Link
          href={
            next
              ? `${routes.login}?next=${encodeURIComponent(next)}`
              : routes.login
          }
          className="text-primary font-semibold underline"
        >
          로그인
        </Link>
      </p>
    </form>
  );
}
