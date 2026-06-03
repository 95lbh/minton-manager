import { Users, Swords, CalendarCheck, Activity } from "lucide-react";
import { getActiveClub } from "@/server/queries/clubs";
import { getMemberStats, getClubSummary } from "@/server/queries/stats";
import { GENDER_LABEL, GRADE_BY_VALUE, SKILL_GRADES } from "@/lib/constants";
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

  // ── 회원 구성 분포 (활성 회원 rows 기준) ──
  const total = rows.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const activeCount = rows.filter((r) => r.gameCount > 0).length;

  const g = { male: 0, female: 0, etc: 0 };
  for (const r of rows) {
    if (r.gender === "male") g.male++;
    else if (r.gender === "female") g.female++;
    else g.etc++;
  }
  const genderSegments = [
    { key: "male", label: "남", count: g.male, color: "bg-sky-500" },
    { key: "female", label: "여", count: g.female, color: "bg-rose-500" },
    { key: "etc", label: "기타·미지정", count: g.etc, color: "bg-slate-300" },
  ].filter((s) => s.count > 0);

  const levelMap = new Map<string, number>();
  for (const r of rows) {
    const key = r.level ? GRADE_BY_VALUE[r.level] : "미지정";
    levelMap.set(key, (levelMap.get(key) ?? 0) + 1);
  }
  const levelRows = [
    ...SKILL_GRADES.map((grade) => ({ label: grade, count: levelMap.get(grade) ?? 0 })),
    ...(levelMap.get("미지정")
      ? [{ label: "미지정", count: levelMap.get("미지정")! }]
      : []),
  ];
  const levelMax = Math.max(1, ...levelRows.map((l) => l.count));

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">통계</h1>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{club.name}</span>
        <span className="size-1 rounded-full bg-muted-foreground/40" />
        <span>회원 {summary.memberCount}명</span>
        <span className="size-1 rounded-full bg-muted-foreground/40" />
        <span>누적 {summary.totalGames}게임</span>
        <span className="size-1 rounded-full bg-muted-foreground/40" />
        <span>활동 {activeCount}명</span>
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

      {/* 회원 구성: 성별 / 급수 분포 */}
      {total > 0 && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {/* 성별 구성 */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-tight">성별 구성</h2>
              <span className="text-xs text-muted-foreground">{total}명</span>
            </div>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted">
              {genderSegments.map((s) => (
                <div
                  key={s.key}
                  className={s.color}
                  style={{ width: `${pct(s.count)}%` }}
                />
              ))}
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {genderSegments.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${s.color}`} />
                  <span>{s.label}</span>
                  <span className="ml-auto tabular-nums">
                    {s.count}명{" "}
                    <span className="text-muted-foreground">
                      ({pct(s.count)}%)
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* 급수 분포 */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-tight">급수 분포</h2>
              {/* <span className="text-xs text-muted-foreground">S → F</span> */}
            </div>
            <ul className="mt-3 space-y-1.5">
              {levelRows.map((l) => (
                <li key={l.label} className="flex items-center gap-2 text-sm">
                  <span className="w-8 shrink-0 text-center text-xs font-bold text-muted-foreground">
                    {l.label}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(l.count / levelMax) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">
                    {l.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 회원별 통계 */}
      <h2 className="mt-8 mb-2 text-sm font-bold tracking-tight">
        회원별 누적 참여
      </h2>
      <div className="overflow-x-auto rounded-xl border shadow-sm">
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
        {/* ※ 일반 운영 모드는 승패/점수를 기록하지 않으므로 참여 횟수 중심입니다. */}
      </p>
    </div>
  );
}
