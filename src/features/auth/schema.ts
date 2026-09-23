import { z } from "zod";

// 공백 제거·소문자 변환 후 형식 검사
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("이메일 형식을 확인해 주세요."));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

export const signupSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "이름(별명)을 입력해 주세요.")
    .max(20, "20자 이내로 입력해 주세요."),
  email,
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .max(72, "비밀번호는 72자 이하여야 합니다."),
});
