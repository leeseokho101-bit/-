"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 새 메시지를 보도록 화면이 보이는 동안 주기적으로 새로고침 (실시간 연결 대신) */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
