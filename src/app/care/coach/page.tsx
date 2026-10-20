import { AutoRefresh } from "@/components/coaching/auto-refresh";
import { Thread } from "@/components/coaching/thread";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { patientChatNote, specialtyLabels } from "@/content/coaching";
import { requireEnrollment } from "@/features/care/session";
import { PatientMessageForm } from "@/features/coaching/forms";
import { getCoach, listThread, markRead } from "@/features/coaching/service";
import { routes } from "@/lib/routes";
import { db } from "@/server/db";

export const metadata = { title: "코치 | GLP-1 케어" };

export default async function CareCoachPage() {
  const { user } = await requireEnrollment(routes.careCoach);
  const enrollment = await db.careEnrollment.findUnique({
    where: { userId: user.id },
    select: { coachId: true },
  });
  const coach = enrollment?.coachId
    ? await getCoach(db, enrollment.coachId)
    : null;
  await markRead(db, user.id, "PATIENT");
  const messages = await listThread(db, user.id);

  return (
    <>
      <PageHeader
        title="담당 코치"
        description={
          coach
            ? `${specialtyLabels[coach.specialty]} ${coach.displayName} 코치가 식사·운동·생활습관을 함께 챙겨요. 보통 하루 안에 답장해요.`
            : "담당 코치를 배정하고 있어요. 먼저 메시지를 남겨 두시면 배정된 코치가 이어서 답해요."
        }
      />
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
        {patientChatNote}
      </p>
      <Card>
        <Thread
          messages={messages}
          viewer="PATIENT"
          names={{
            PATIENT: user.displayName,
            COACH: coach ? `${coach.displayName} 코치` : "코치",
          }}
        />
      </Card>
      <Card>
        <PatientMessageForm />
      </Card>
      <AutoRefresh />
    </>
  );
}
