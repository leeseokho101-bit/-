"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { careTabs, routes } from "@/lib/routes";

/** 케어 하단 메뉴 — 화면 아래에 붙어 있다가 페이지 끝에서는 본문 뒤에 놓인다 */
export function CareTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="GLP-1 케어 메뉴"
      className="border-border bg-surface/95 sticky bottom-0 z-10 border-t backdrop-blur"
    >
      <ul className="mx-auto grid w-full max-w-md grid-cols-5">
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
                <span aria-hidden className="text-lg leading-none">
                  {tab.icon}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
