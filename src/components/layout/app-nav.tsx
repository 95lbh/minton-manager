"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: ROUTES.dashboard, label: "대시보드" },
  { href: ROUTES.attendance, label: "출석" },
  { href: ROUTES.games, label: "코트/게임" },
  { href: ROUTES.members, label: "회원" },
  { href: ROUTES.courts, label: "코트관리" },
  { href: ROUTES.stats, label: "통계" },
  { href: ROUTES.tournaments, label: "대회" },
  { href: ROUTES.settings, label: "설정" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
