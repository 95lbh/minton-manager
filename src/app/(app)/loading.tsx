/**
 * 탭 전환 시 즉시 표시되는 스켈레톤(공통).
 * 헤더/내비는 레이아웃이라 유지되고, 콘텐츠 영역만 이 골격 → 실제 데이터로 스트리밍된다.
 * 클릭 직후 빈 화면 대기 없이 즉각적인 반응을 준다.
 */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-hidden>
      {/* 제목 + 메타 */}
      <div className="h-7 w-40 rounded-md bg-muted" />
      <div className="mt-2 h-4 w-64 rounded bg-muted/70" />

      {/* 요약 카드 줄 */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border bg-muted/40" />
        ))}
      </div>

      {/* 본문 카드 그리드 */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border bg-muted/40" />
        ))}
      </div>
    </div>
  );
}
