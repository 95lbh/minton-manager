import Link from "next/link";
import {
  ClipboardCheck,
  LayoutGrid,
  Users,
  BarChart3,
  Trophy,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/lib/constants";
import { getActiveClub } from "@/server/queries/clubs";
import { getOnboardingProgress } from "@/server/queries/onboarding";
import { getAdFree } from "@/server/queries/prefs";
import { StartChecklist } from "@/features/dashboard/start-checklist";
import { AdUnit } from "@/components/ads/ad-unit";

const CARDS: {
  href: string;
  title: string;
  desc: string;
  icon: LucideIcon;
}[] = [
  { href: ROUTES.attendance, title: "출석 관리", desc: "회원 및 게스트 출석 체크", icon: ClipboardCheck },
  { href: ROUTES.games, title: "코트/게임", desc: "코트 배정과 게임 시작·종료", icon: LayoutGrid },
  { href: ROUTES.members, title: "회원 관리", desc: "회원 등록·수정·삭제", icon: Users },
  { href: ROUTES.stats, title: "통계", desc: "회원별·클럽별 참여 현황", icon: BarChart3 },
  { href: ROUTES.tournaments, title: "대회 모드", desc: "토너먼트·리그·청백전", icon: Trophy },
];

export default async function DashboardPage() {
  const club = await getActiveClub();
  const progress = club ? await getOnboardingProgress(club.id) : null;
  const adFree = await getAdFree();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        오늘의 운영을 빠르게 시작하세요.
      </p>

      {progress && <StartChecklist progress={progress} />}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            // 같은 목적지를 상단 네비가 이미 프리페치하므로 카드 프리페치는 중복 → 끔.
            prefetch={false}
            className="group flex items-center gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:bg-primary/[0.03]"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <card.icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold tracking-tight">{card.title}</h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {card.desc}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </div>

      {/* 광고 (env 설정 시에만 표시, 광고 제거 계정은 숨김) */}
      {!adFree && (
        <div className="mt-6">
          <AdUnit slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_DASHBOARD} />
        </div>
      )}
    </div>
  );
}
