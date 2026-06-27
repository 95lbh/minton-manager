"use client";

import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/server/types";

/**
 * Server Action 호출 공통 헬퍼.
 * 매니저마다 흩어져 있던 `run()`(useTransition + 성공/실패 토스트 + 옵티미스틱) 패턴을 통일한다.
 *
 * - optimistic: 트랜잭션 시작 직후(await 전) 즉시 적용할 낙관적 갱신.
 * - onSuccess(data): 성공 후 콜백(예: 제외 인원 안내, 폼 닫기).
 * - success: 성공 토스트 메시지(없으면 토스트 생략).
 * - onError: 기본은 error.message 토스트. 커스텀 처리 시 지정.
 */
export function useServerAction() {
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    <T>(
      fn: () => Promise<ActionResult<T>>,
      opts?: {
        success?: string;
        optimistic?: () => void;
        onSuccess?: (data: T | undefined) => void;
        onError?: (message: string) => void;
      },
    ) => {
      startTransition(async () => {
        if (opts?.optimistic) opts.optimistic();
        const res = await fn();
        if (res.ok) {
          if (opts?.success) toast.success(opts.success);
          opts?.onSuccess?.(res.data);
        } else if (opts?.onError) {
          opts.onError(res.error.message);
        } else {
          toast.error(res.error.message);
        }
      });
    },
    [],
  );

  return { pending, run };
}
