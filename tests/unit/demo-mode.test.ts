import { describe, expect, it } from "vitest";
import { isPreviewDemo, isSampleDataAllowed } from "@/lib/demo-mode";

describe("가상 데이터(데모) 허용 범위", () => {
  it("로컬 개발·테스트에서는 항상 허용", () => {
    expect(isSampleDataAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(isSampleDataAllowed({ NODE_ENV: "test" })).toBe(true);
    expect(isPreviewDemo({ NODE_ENV: "development" })).toBe(false);
  });

  it("Vercel 미리보기는 DEMO_SAMPLES=on을 직접 켠 경우에만", () => {
    expect(
      isSampleDataAllowed({ NODE_ENV: "production", VERCEL_ENV: "preview" }),
    ).toBe(false);
    expect(
      isSampleDataAllowed({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        DEMO_SAMPLES: "on",
      }),
    ).toBe(true);
    expect(
      isPreviewDemo({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        DEMO_SAMPLES: "on",
      }),
    ).toBe(true);
  });

  it("운영 배포와 그 밖의 production 빌드에서는 켜도 허용하지 않는다", () => {
    expect(
      isSampleDataAllowed({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        DEMO_SAMPLES: "on",
      }),
    ).toBe(false);
    expect(
      isSampleDataAllowed({ NODE_ENV: "production", DEMO_SAMPLES: "on" }),
    ).toBe(false);
  });
});
