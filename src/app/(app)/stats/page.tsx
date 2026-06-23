import { Suspense } from "react";
import { Users, Swords, CalendarCheck, Activity } from "lucide-react";
import { getActiveClub } from "@/server/queries/clubs";
import {
  getMemberStats,
  getMemberStatsRange,
  getClubSummary,
  type ClubSummary,
} from "@/server/queries/stats";
import { GENDER_LABEL, GRADE_BY_VALUE, SKILL_GRADES } from "@/lib/constants";
import { buildAgeRows } from "@/lib/age";
import { PersonAvatar } from "@/components/person-avatar";
import { StatsShare } from "@/features/stats/stats-share";
import { PeriodSelect } from "@/features/stats/period-select";
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

const PERIODS = ["all", "30d", "month"] as const;
type Period = (typeof PERIODS)[number];

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** 기간 코드 → [from, to] 날짜 문자열. all 이면 null. */
function rangeFor(period: Period): { from: string; to: string } | null {
  if (period === "all") return null;
  const now = new Date();
  const to = ymd(now);
  if (period === "month") {
    return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  }
  const d = new Date(now);
  d.setDate(d.getDate() - 29); // 최근 30일(오늘 포함)
  return { from: ymd(d), to };
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const club = await getActiveClub();
  if (!club) return null;

  const sp = await searchParams;
  const period: Period = PERIODS.includes(sp.period as Period)
    ? (sp.period as Period)
    : "all";

  // 요약은 가벼우므로 먼저 받아 즉시 렌더. 무거운 회원별 통계는 아래에서 스트리밍.
  const summary = await getClubSummary(club.id);

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
          <div key={c.label} className="rounded-xl border bg-card p-4 shadow-sm">
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

      {/* 기간 필터 (참여 집계에 적용) */}
      <div className="mt-6 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold tracking-tight">회원 참여</h2>
        <PeriodSelect value={period} />
      </div>

      {/* 회원별 통계는 무거우므로 스트리밍(요약 먼저 보이고 이어서 채워짐) */}
      <Suspense key={period} fallback={<StatsDetailsSkeleton />}>
        <StatsDetails
          clubId={club.id}
          clubName={club.name}
          summary={summary}
          period={period}
        />
      </Suspense>
    </div>
  );
}

/** 회원별 통계 + 분포(성별/급수/나이대) — 별도 await로 스트리밍된다. */
async function StatsDetails({
  clubId,
  clubName,
  summary,
  period,
}: {
  clubId: string;
  clubName: string;
  summary: ClubSummary;
  period: Period;
}) {
  const range = rangeFor(period);
  const rows = range
    ? await getMemberStatsRange(clubId, range.from, range.to)
    : await getMemberStats(clubId);

  const total = rows.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

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

  const currentYear = new Date().getFullYear();
  const ageRows = buildAgeRows(
    rows.map((r) => r.birthYear),
    currentYear,
  );
  const ageMax = Math.max(1, ...ageRows.map((a) => a.count));

  return (
    <>
      {/* 공유 버튼 (회원 데이터 필요) */}
      <div className="mt-4 flex justify-end">
        <StatsShare clubName={clubName} summary={summary} rows={rows} />
      </div>

      {/* 회원 구성: 성별 / 급수 분포 */}
      {total > 0 && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-tight">성별 구성</h2>
              <span className="text-xs text-muted-foreground">{total}명</span>
            </div>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted">
              {genderSegments.map((s) => (
                <div key={s.key} className={s.color} style={{ width: `${pct(s.count)}%` }} />
              ))}
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {genderSegments.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${s.color}`} />
                  <span>{s.label}</span>
                  <span className="ml-auto tabular-nums">
                    {s.count}명{" "}
                    <span className="text-muted-foreground">({pct(s.count)}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-tight">급수 분포</h2>
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

      {/* 나이대 분포 */}
      {total > 0 && (
        <div className="mt-3 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight">나이대 분포</h2>
            <span className="text-xs text-muted-foreground">{currentYear}년 기준</span>
          </div>
          <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {ageRows.map((a) => (
              <li key={a.label} className="flex items-center gap-2 text-sm">
                <span className="w-14 shrink-0 text-xs font-bold text-muted-foreground">
                  {a.label}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(a.count / ageMax) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">
                  {a.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 회원별 통계 */}
      <h2 className="mt-8 mb-2 text-sm font-bold tracking-tight">회원별 참여</h2>
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
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
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
                <TableCell className="text-right tabular-nums">{r.attendCount}</TableCell>
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
    </>
  );
}

/** 스트리밍 대기 동안 보여줄 자리표시(레이아웃 이동 최소화). */
function StatsDetailsSkeleton() {
  return (
    <div className="mt-3 animate-pulse space-y-3" aria-hidden>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="h-40 rounded-xl border bg-muted/40" />
        <div className="h-40 rounded-xl border bg-muted/40" />
      </div>
      <div className="h-32 rounded-xl border bg-muted/40" />
      <div className="h-64 rounded-xl border bg-muted/40" />
    </div>
  );
}
