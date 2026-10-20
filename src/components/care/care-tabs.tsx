"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { careTabs, routes } from "@/lib/routes";

/** 케어 하단 메뉴 — 화면 아래에 붙어 있다가 페이지 끝에서는 본문 뒤에 놓인다 */
export function CareTabs({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="GLP-1 케어 메뉴"
      className="border-border bg-surface/95 sticky bottom-0 z-10 border-t backdrop-blur"
    >
      <ul className="mx-auto grid w-full max-w-md grid-cols-6">
        {careTabs.map((tab) => {
          const active =
            tab.href === routes.care
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                  active ? "text-primary font-bold" : "text-muted"
                }`}
              >
                <span aria-hidden className="relative text-lg leading-none">
                  {tab.icon}
                  {tab.href === routes.careCoach && unread > 0 && !active && (
                    <span className="absolute -top-1 -right-2 min-w-4 rounded-full bg-rose-700 px-1 text-[0.65rem] leading-4 font-bold text-white">
                      {unread}
                    </span>
                  )}
                </span>
                {tab.label}
                {tab.href === routes.careCoach && unread > 0 && !active && (
                  <span className="sr-only"> (새 메시지 {unread}개)</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
