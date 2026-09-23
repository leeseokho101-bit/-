import { describe, expect, it } from "vitest";
import {
  formDataToObject,
  flattenToFormValues,
} from "@/features/assessment/form-data";
import {
  checkupFormSchema,
  exerciseSleepFormSchema,
  lifestyleFormSchema,
  medicationsFormSchema,
  profileFormSchema,
} from "@/features/assessment/schemas";
import { surveyAnswersSchema } from "@/domain/health-snapshot/survey";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

const errorsOf = (r: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) =>
  Object.fromEntries(
    (r.error?.issues ?? []).map((i) => [i.path.join("."), i.message]),
  );

describe("formDataToObject", () => {
  it("점(.) 표기를 중첩 객체로 바꾸고 빈 값은 제외한다", () => {
    const obj = formDataToObject(
      fd({ "sleep.avgHours": "7", "sleep.bedtime": "", sex: "MALE" }),
    );
    expect(obj).toEqual({ sleep: { avgHours: "7" }, sex: "MALE" });
  });

  it("숫자 인덱스 키는 배열로 만든다 (빈 행은 제외)", () => {
    const obj = formDataToObject(
      fd({
        "meds.1.name": "B",
        "meds.0.name": "A",
        "meds.0.purpose": "혈압",
        "meds.2.name": "",
      }),
    );
    expect(obj).toEqual({
      meds: [{ name: "A", purpose: "혈압" }, { name: "B" }],
    });
  });

  it("flattenToFormValues는 역변환한다", () => {
    expect(
      flattenToFormValues({
        exercise: { strengthTraining: true, dailySteps: 5000 },
      }),
    ).toEqual({
      "exercise.strengthTraining": "yes",
      "exercise.dailySteps": "5000",
    });
  });
});

describe("profileFormSchema", () => {
  const valid = {
    displayName: "홍길동",
    sex: "MALE",
    birthDate: "1970-05-01",
    HEIGHT: "172.5",
    WEIGHT: "80",
  };

  it("유효한 입력을 숫자/날짜로 변환한다", () => {
    const r = profileFormSchema.parse(valid);
    expect(r.HEIGHT).toBe(172.5);
    expect(r.birthDate.toISOString().slice(0, 10)).toBe("1970-05-01");
    expect(r.WAIST).toBeUndefined();
  });

  it("필수 항목 누락 시 항목별 안내 문구를 준다", () => {
    const r = profileFormSchema.safeParse({ displayName: "a" });
    const e = errorsOf(r);
    expect(e.sex).toBe("성별을 선택해 주세요.");
    expect(e.birthDate).toBe("생년월일을 입력해 주세요.");
    expect(e.HEIGHT).toBe("키를 입력해 주세요.");
    expect(e.WEIGHT).toBe("체중을 입력해 주세요.");
  });

  it("범위를 벗어나거나 숫자가 아니면 오류", () => {
    const e = errorsOf(
      profileFormSchema.safeParse({ ...valid, HEIGHT: "1720", WEIGHT: "abc" }),
    );
    expect(e.HEIGHT).toContain("120~220");
    expect(e.WEIGHT).toBe("숫자로 입력해 주세요.");
  });

  it("미성년자 생년월일은 거부한다", () => {
    const thisYear = new Date().getFullYear();
    const e = errorsOf(
      profileFormSchema.safeParse({
        ...valid,
        birthDate: `${thisYear - 10}-01-01`,
      }),
    );
    expect(e.birthDate).toContain("만 19세");
  });
});

describe("checkupFormSchema", () => {
  it("모든 항목이 선택 입력이다", () => {
    expect(checkupFormSchema.safeParse({}).success).toBe(true);
  });

  it("이완기 혈압이 수축기보다 높으면 오류", () => {
    const e = errorsOf(checkupFormSchema.safeParse({ SBP: "80", DBP: "120" }));
    expect(e.DBP).toContain("수축기 혈압보다 낮아야");
  });

  it("단위 오타 수준의 값은 거부한다", () => {
    expect(checkupFormSchema.safeParse({ HBA1C: "57" }).success).toBe(false);
    expect(checkupFormSchema.parse({ HBA1C: "5.7" }).HBA1C).toBe(5.7);
  });
});

describe("survey forms", () => {
  it("운동·수면 응답을 변환하고 도메인 스키마를 통과한다", () => {
    const r = exerciseSleepFormSchema.parse({
      exercise: {
        sessionsPerWeek: "3",
        dailySteps: "6,500",
        strengthTraining: "no",
      },
      sleep: { avgHours: "6.5", bedtime: "23:30", satisfaction: "2" },
    });
    expect(r.exercise).toEqual({
      sessionsPerWeek: 3,
      dailySteps: 6500,
      strengthTraining: false,
    });
    expect(r.sleep.satisfaction).toBe(2);
    expect(surveyAnswersSchema.safeParse(r).success).toBe(true);
  });

  it("비흡연자·비음주자의 양 정보는 저장하지 않는다", () => {
    const r = lifestyleFormSchema.parse({
      smoking: { status: "FORMER", cigarettesPerDay: "10" },
      alcohol: { frequency: "NEVER", drinksPerOccasion: "3" },
    });
    expect(r.smoking).toEqual({ status: "FORMER" });
    expect(r.alcohol).toEqual({ frequency: "NEVER" });
  });

  it("복용약: 이름 없는 행은 무시하고, '없음' 선택 시 목록을 비운다", () => {
    expect(
      medicationsFormSchema.parse({
        meds: [{ name: "가상약A", purpose: "혈압" }, { purpose: "x" }],
      }),
    ).toEqual({ none: false, meds: [{ name: "가상약A", purpose: "혈압" }] });
    expect(
      medicationsFormSchema.parse({ none: "yes", meds: [{ name: "가상약A" }] }),
    ).toEqual({
      none: true,
      meds: [],
    });
  });
});
