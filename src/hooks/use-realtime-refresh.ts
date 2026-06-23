"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * 해당 클럽의 지정 테이블 변경을 Supabase Realtime으로 구독하고,
 * 변경이 감지되면 서버 컴포넌트를 다시 불러온다(router.refresh).
 *
 * - 여러 스태프가 동시에 운영할 때 코트/대기열/출석이 라이브로 동기화된다.
 * - 본인 액션도 이벤트로 돌아오지만 refresh는 멱등이라 무해(디바운스로 폭주 방지).
 * - postgres_changes는 테이블 RLS(is_club_member)를 그대로 적용 → 타 클럽 데이터 안 받음.
 * - 전제: 대상 테이블이 supabase_realtime 퍼블리케이션에 포함(0017 마이그레이션).
 * - 무거운 supabase-js는 effect 안에서 동적 로드한다(첫 렌더/번들에서 분리 → 3G 체감↑).
 *   실시간 구독은 비핵심이라 하이드레이션 직후 잠깐 뒤 붙어도 무방.
 */
export function useRealtimeRefresh(
  clubId: string | undefined,
  tables: readonly string[],
) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tablesKey = tables.join(",");

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;
    // 언마운트 시 정리할 핸들(동적 로드 후 채워짐).
    let cleanup: (() => void) | null = null;

    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      if (cancelled) return; // import 사이에 언마운트됨
      const supabase = createClient();
      const channel = supabase.channel(`rt:${clubId}:${tablesKey}`);

      const scheduleRefresh = () => {
        if (timer.current) clearTimeout(timer.current);
        // 게임 시작 등 한 동작이 여러 행을 바꿔도 한 번만 새로고침.
        timer.current = setTimeout(() => router.refresh(), 250);
      };

      for (const table of tablesKey.split(",")) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `club_id=eq.${clubId}` },
          scheduleRefresh,
        );
      }
      channel.subscribe();

      cleanup = () => void supabase.removeChannel(channel);
    })();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      cleanup?.();
    };
  }, [clubId, tablesKey, router]);
}
