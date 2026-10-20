import type { MessageView } from "@/features/coaching/service";
import { formatDateTime } from "@/features/care/format";

/** 1:1 대화. viewer 쪽 메시지는 오른쪽, 안내(SYSTEM)는 가운데 */
export function Thread({
  messages,
  viewer,
  names,
}: {
  messages: MessageView[];
  viewer: "PATIENT" | "COACH";
  names: { PATIENT: string; COACH: string };
}) {
  if (!messages.length)
    return (
      <p className="text-muted py-6 text-center text-sm">
        아직 나눈 대화가 없어요.
      </p>
    );
  return (
    <ol className="flex flex-col gap-3" aria-label="대화 내용">
      {messages.map((m) => {
        if (m.sender === "SYSTEM")
          return (
            <li
              key={m.id}
              className="text-muted bg-background mx-auto max-w-[90%] rounded-xl px-3 py-2 text-center text-xs leading-relaxed"
            >
              {m.body}
              <span className="block">{formatDateTime(m.createdAt)}</span>
            </li>
          );
        const mine = m.sender === viewer;
        return (
          <li
            key={m.id}
            className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}
          >
            <span className="text-muted text-xs">
              {mine ? "나" : names[m.sender]} · {formatDateTime(m.createdAt)}
              {viewer === "COACH" && m.medicationQuestion && (
                <span className="ml-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 text-amber-900">
                  약 관련 문의
                </span>
              )}
            </span>
            <p
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed whitespace-pre-wrap ${
                mine
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "border-border bg-surface rounded-bl-sm border"
              }`}
            >
              {m.body}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
