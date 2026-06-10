"use client";

import { useRef, useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ClubSummary, MemberStatRow } from "@/server/queries/stats";
import { GRADE_BY_VALUE } from "@/lib/constants";

// 공유 카드는 화면 밖에서 렌더 후 PNG로 캡처한다.
// html-to-image가 oklch(Tailwind v4 테마색)에서 불안정할 수 있어 카드 내부는 인라인 hex로 고정한다.
const BRAND = "#4281A4";
const MALE = "#0ea5e9";
const FEMALE = "#f43f5e";
const ETC = "#cbd5e1";

function formatToday(): string {
  return new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function StatsShare({
  clubName,
  summary,
  rows,
}: {
  clubName: string;
  summary: ClubSummary;
  rows: MemberStatRow[];
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const total = rows.length;
  const g = { male: 0, female: 0, etc: 0 };
  for (const r of rows) {
    if (r.gender === "male") g.male++;
    else if (r.gender === "female") g.female++;
    else g.etc++;
  }
  const genderSegs = [
    { label: "남", count: g.male, color: MALE },
    { label: "여", count: g.female, color: FEMALE },
    { label: "기타", count: g.etc, color: ETC },
  ].filter((s) => s.count > 0);

  const topRows = rows.filter((r) => r.gameCount > 0).slice(0, 10);

  const stats = [
    { label: "회원", value: summary.memberCount },
    { label: "누적 게임", value: summary.totalGames },
    { label: "오늘 출석", value: summary.todayAttendance },
    { label: "오늘 게임", value: summary.todayGames },
  ];

  async function handleShare() {
    const node = cardRef.current;
    if (!node || busy) return;
    setBusy(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });
      const fileName = `${clubName}-통계-${new Date().toISOString().slice(0, 10)}.png`;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: "image/png" });

      // 모바일: 공유 시트(카카오톡 등)로 바로 전달. 불가하면 다운로드.
      if (
        typeof navigator !== "undefined" &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({ files: [file], title: `${clubName} 통계` });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = fileName;
        a.click();
        toast.success("이미지를 저장했어요.");
      }
    } catch (err) {
      // 사용자가 공유 시트를 취소한 경우는 조용히 무시.
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error("이미지 생성에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleShare} disabled={busy}>
        {busy ? (
          <Loader2 className="mr-1 size-4 animate-spin" />
        ) : (
          <Share2 className="mr-1 size-4" />
        )}
        이미지로 공유
      </Button>

      {/* 화면 밖 캡처용 카드 (사용자에게 보이지 않음) */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: -10000,
          top: 0,
          pointerEvents: "none",
        }}
      >
        <div
          ref={cardRef}
          style={{
            width: 480,
            background: "#ffffff",
            color: "#0f172a",
            fontFamily:
              "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          }}
        >
          {/* 헤더 */}
          <div style={{ background: BRAND, color: "#fff", padding: "20px 24px" }}>
            <div style={{ fontSize: 13, opacity: 0.85, letterSpacing: 0.5 }}>
              마이민턴 · myminton
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>
              {clubName}
            </div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
              {formatToday()} 기준
            </div>
          </div>

          <div style={{ padding: "20px 24px" }}>
            {/* 요약 4지표 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 10,
              }}
            >
              {stats.map((s) => (
                <div
                  key={s.label}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "12px 8px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#64748b" }}>{s.label}</div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      marginTop: 2,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            {/* 성별 구성 */}
            {total > 0 && (
              <div style={{ marginTop: 18 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 8,
                    color: "#334155",
                  }}
                >
                  성별 구성 ({total}명)
                </div>
                <div
                  style={{
                    display: "flex",
                    height: 12,
                    borderRadius: 999,
                    overflow: "hidden",
                    background: "#f1f5f9",
                  }}
                >
                  {genderSegs.map((s) => (
                    <div
                      key={s.label}
                      style={{
                        width: `${(s.count / total) * 100}%`,
                        background: s.color,
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                  {genderSegs.map((s) => (
                    <div
                      key={s.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: "#475569",
                      }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: s.color,
                          display: "inline-block",
                        }}
                      />
                      {s.label} {s.count}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 참여 TOP */}
            {topRows.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 8,
                    color: "#334155",
                  }}
                >
                  참여 TOP {topRows.length}
                </div>
                <div>
                  {topRows.map((r, i) => (
                    <div
                      key={r.memberId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "7px 0",
                        borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
                        fontSize: 14,
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          textAlign: "center",
                          fontWeight: 700,
                          color: i < 3 ? BRAND : "#94a3b8",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ fontWeight: 600 }}>{r.name}</span>
                      {r.level && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#64748b",
                            border: "1px solid #e2e8f0",
                            borderRadius: 6,
                            padding: "1px 6px",
                          }}
                        >
                          {GRADE_BY_VALUE[r.level]}
                        </span>
                      )}
                      <span
                        style={{
                          marginLeft: "auto",
                          color: "#64748b",
                          fontSize: 12,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        출석 {r.attendCount}
                      </span>
                      <span
                        style={{
                          width: 60,
                          textAlign: "right",
                          fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {r.gameCount}게임
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div
            style={{
              borderTop: "1px solid #e2e8f0",
              padding: "12px 24px",
              fontSize: 12,
              color: "#94a3b8",
              textAlign: "center",
            }}
          >
            www.myminton.com 으로 우리 동호회를 관리하세요
          </div>
        </div>
      </div>
    </>
  );
}
