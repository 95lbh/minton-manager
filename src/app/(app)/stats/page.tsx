import { Users, Swords, CalendarCheck, Activity } from "lucide-react";
import { getActiveClub } from "@/server/queries/clubs";
import { getMemberStats, getClubSummary } from "@/server/queries/stats";
import { GENDER_LABEL, GRADE_BY_VALUE } from "@/lib/constants";
import { PersonAvatar } from "@/components/person-avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

export default async function StatsPage() {
  const club = await getActiveClub();
  if (!club) return null;

  const [summary, rows] = await Promise.all([
    getClubSummary(club.id),
    getMemberStats(club.id),
  ]);

  const cards = [
    { label: "회원", value: summary.memberCount, icon: Users, accent: false },
    { label: "누적 게임", value: summary.totalGames, icon: Swords, accent: false },
    { label: "오늘 출석", value: summary.todayAttendance, icon: CalendarCheck, accent: true },
    { label: "오늘 게임", value: summary.todayGames, icon: Activity, accent: true },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">통계</h1>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{club.name}</span>
        <span className="size-1 rounded-full bg-muted-foreground/40" />
        <span>회원 {summary.memberCount}명</span>
        <span className="size-1 rounded-full bg-muted-foreground/40" />
        <span>누적 {summary.totalGames}게임</span>
      </div>

      {/* 요약 카드 */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border bg-card p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{c.label}</div>
              <c.icon
                className={`size-4 ${c.accent ? "text-accent" : "text-muted-foreground/50"}`}
              />
            </div>
            <div
              className={`mt-1 text-3xl font-bold tabular-nums ${c.accent ? "text-accent" : ""}`}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {/* 회원별 통계 */}
      <h2 className="mt-8 mb-2 text-sm font-bold tracking-tight">
        회원별 누적 참여
      </h2>
      <div className="overflow-hidden rounded-xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead>이름</TableHead>
              <TableHead className="w-14">성별</TableHead>
              <TableHead className="w-20 text-right">출석</TableHead>
              <TableHead className="w-20 text-right">게임</TableHead>
              <TableHead className="w-24 text-right">최근 참여</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  아직 회원이 없습니다.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r, i) => (
              <TableRow key={r.memberId}>
                <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                  {i + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <PersonAvatar
                      gender={r.gender}
                      label={r.level ? GRADE_BY_VALUE[r.level] : null}
                      className="size-8"
                    />
                    <span className="font-medium">{r.name}</span>
                  </div>
                </TableCell>
                <TableCell>{r.gender ? GENDER_LABEL[r.gender] : "-"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.attendCount}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {r.gameCount}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatDate(r.lastPlayedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        ※ 일반 운영 모드는 승패/점수를 기록하지 않으므로 참여 횟수 중심입니다.
      </p>
    </div>
  );
}
