import { doseSchedule } from "@/domain/glp1/dosing";
import { getEnrollment, listDoses } from "@/features/care/service";
import { koreaDate } from "@/features/activity/date";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * 다음 투약일부터 반복되는 캘린더 알림 파일 (.ics).
 * 푸시 알림 대신 휴대폰 기본 캘린더 알림을 쓴다. 캘린더가 다른 사람과 공유될 수 있어
 * 약 이름·용량은 넣지 않는다.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const enrollment = await getEnrollment(db, user.id);
  if (!enrollment) return new Response("Not found", { status: 404 });
  const today = koreaDate();
  const doses = await listDoses(db, user.id);
  const { nextDue } = doseSchedule(
    enrollment.drug,
    enrollment.startDate,
    doses,
    today,
  );
  const start = (nextDue < today ? today : nextDue).replace(/-/g, "");
  const stamp =
    new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const freq = enrollment.drug.intervalDays === 7 ? "WEEKLY" : "DAILY";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//health-analysis-mvp//care//KO",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:care-dose-${user.id}@health-analysis-mvp`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Asia/Seoul:${start}T090000`,
    "DURATION:PT15M",
    `RRULE:FREQ=${freq}`,
    "SUMMARY:투약일 (케어 앱에 기록하기)",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:투약일이에요. 케어 앱에 기록해 주세요.",
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="dose-reminder.ics"',
      "Cache-Control": "no-store",
    },
  });
}
