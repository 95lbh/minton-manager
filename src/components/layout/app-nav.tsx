"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardCheck,
  LayoutGrid,
  Users,
  BarChart3,
  Trophy,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: ROUTES.dashboard, label: "대시보드", icon: LayoutDashboard },
  { href: ROUTES.attendance, label: "출석", icon: ClipboardCheck },
  { href: ROUTES.games, label: "코트/게임", icon: LayoutGrid },
  { href: ROUTES.members, label: "회원", icon: Users },
  { href: ROUTES.stats, label: "통계", icon: BarChart3 },
  { href: ROUTES.tournaments, label: "대회", icon: Trophy },
  { href: ROUTES.settings, label: "설정", icon: Settings },
];

/** 탭 순서(스와이프 이동 등에서 공용으로 사용). */
export const NAV_ROUTES = NAV_ITEMS.map((i) => i.href);

export function AppNav() {
  const pathname = usePathname();

  return (
    // -mb-px: 활성 탭의 밑줄이 헤더 하단 테두리(트랙) 위에 얹히게 한다.
    <nav className="-mb-px flex gap-0.5 overflow-x-auto">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0 transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground/60 group-hover:text-foreground",
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
