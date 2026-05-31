import { getActiveClub } from "@/server/queries/clubs";
import { getMemberStats, getClubSummary } from "@/server/queries/stats";
import { GENDER_LABEL, GRADE_BY_VALUE } from "@/lib/constants";
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
    { label: "회원", value: summary.memberCount },
    { label: "누적 게임", value: summary.totalGames },
    { label: "오늘 출석", value: summary.todayAttendance },
    { label: "오늘 게임", value: summary.todayGames },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">통계</h1>
      <p className="mt-1 text-sm text-muted-foreground">{club.name}</p>

      {/* 요약 카드 */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4">
            <div className="text-sm text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>

      {/* 회원별 통계 */}
      <h2 className="mt-8 mb-2 text-sm font-semibold text-muted-foreground">
        회원별 누적 참여
      </h2>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead className="w-14">성별</TableHead>
              <TableHead className="w-14">등급</TableHead>
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
            {rows.map((r) => (
              <TableRow key={r.memberId}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.gender ? GENDER_LABEL[r.gender] : "-"}</TableCell>
                <TableCell>{r.level ? GRADE_BY_VALUE[r.level] : "-"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.attendCount}
                </TableCell>
                <TableCell className="text-right tabular-nums">
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
