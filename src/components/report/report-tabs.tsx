"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { reportTabs } from "@/lib/routes";

export function ReportTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="분석 결과 메뉴" className="-mx-5 overflow-x-auto px-5">
      <ul className="flex gap-2 whitespace-nowrap">
        {reportTabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-muted"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
