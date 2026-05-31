import Link from "next/link";
import { ROUTES } from "@/lib/constants";

const CARDS: { href: string; title: string; desc: string }[] = [
  { href: ROUTES.attendance, title: "출석 관리", desc: "오늘의 출석 세션과 출석 체크" },
  { href: ROUTES.games, title: "코트/게임", desc: "코트 배정과 게임 시작·종료" },
  { href: ROUTES.members, title: "회원 관리", desc: "회원 등록·수정·삭제" },
  { href: ROUTES.stats, title: "통계", desc: "회원별·클럽별 참여 현황" },
  { href: ROUTES.tournaments, title: "대회 모드", desc: "토너먼트·대진표 (예정)" },
];

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">대시보드</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        오늘의 운영을 빠르게 시작하세요.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50"
          >
            <h2 className="font-semibold">{card.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
