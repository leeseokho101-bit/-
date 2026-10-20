import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { mealRiseLabels, mealTypeLabels } from "@/content/care";
import { addDaysIso, kstDate, kstDayStart, kstTime } from "@/domain/glp1/time";
import { deleteMealAction } from "@/features/care/actions";
import { formatDay } from "@/features/care/format";
import { MealForm } from "@/features/care/meal-form";
import { CARE_EDITABLE_DAYS } from "@/features/care/schemas";
import { listMeals } from "@/features/care/service";
import { requireEnrollment } from "@/features/care/session";
import { routes } from "@/lib/routes";
import { isMealPhotoAvailable } from "@/server/ai/meal-reader";
import { db } from "@/server/db";

export const metadata = { title: "식사 기록 | GLP-1 케어" };

const RECENT_DAYS = 7;

export default async function CareMealsPage() {
  const { user, today, now } = await requireEnrollment(routes.careMeals);
  const meals = await listMeals(
    db,
    user.id,
    kstDayStart(addDaysIso(today, -(RECENT_DAYS - 1))),
    kstDayStart(addDaysIso(today, 1)),
  );
  const byDay = new Map<string, typeof meals>();
  for (const m of meals) {
    const d = kstDate(m.eatenAt);
    byDay.set(d, [...(byDay.get(d) ?? []), m]);
  }

  return (
    <>
      <PageHeader
        title="식사 기록"
        description="먹은 음식을 기록하면 식후 혈당 반응과 이어서 보여드려요. 식사량이 줄어도 단백질은 끼니마다 챙겨 주세요."
      />
      <Card>
        <MealForm
          today={today}
          earliest={addDaysIso(today, -(CARE_EDITABLE_DAYS - 1))}
          nowTime={kstTime(now)}
          photoAvailable={isMealPhotoAvailable()}
        />
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="meal-history">
        <h2 id="meal-history" className="text-lg font-bold">
          최근 {RECENT_DAYS}일
        </h2>
        {byDay.size === 0 && (
          <p className="text-muted text-sm">아직 기록이 없어요.</p>
        )}
        {[...byDay.entries()].map(([day, list]) => {
          const protein = list.reduce((a, m) => a + (m.proteinG ?? 0), 0);
          const kcal = list.reduce((a, m) => a + (m.kcal ?? 0), 0);
          return (
            <div key={day} className="flex flex-col gap-2">
              <p className="flex justify-between text-sm">
                <span className="font-semibold">{formatDay(day)}</span>
                <span className="text-muted">
                  {kcal ? `${kcal.toLocaleString()}kcal · ` : ""}단백질{" "}
                  {protein}g
                </span>
              </p>
              <ul className="flex flex-col gap-2">
                {list.map((m) => (
                  <li
                    key={m.id}
                    className="border-border bg-surface flex flex-col gap-1 rounded-xl border px-4 py-3 text-sm"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {kstTime(m.eatenAt)} {mealTypeLabels[m.mealType]}
                        {m.source === "PHOTO_AI" && (
                          <span className="text-muted ml-1 text-xs font-normal">
                            (사진 추정)
                          </span>
                        )}
                      </span>
                      <form action={deleteMealAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          type="submit"
                          className="text-muted min-h-10 px-2 underline"
                          aria-label={`${kstTime(m.eatenAt)} 식사 기록 삭제`}
                        >
                          삭제
                        </button>
                      </form>
                    </span>
                    <span>{m.items.map((i) => i.name).join(", ")}</span>
                    <span className="text-muted">
                      {[
                        m.kcal !== null && `${m.kcal}kcal`,
                        m.carbsG !== null && `탄수화물 ${m.carbsG}g`,
                        m.proteinG !== null && `단백질 ${m.proteinG}g`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {m.response && (
                      <span className="bg-background rounded-lg px-3 py-2">
                        식후 혈당 +{m.response.rise}mg/dL ·{" "}
                        {mealRiseLabels[m.response.band]} (최고{" "}
                        {m.response.peak}, {m.response.minutesToPeak}분 뒤)
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </>
  );
}
