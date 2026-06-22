"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/server/queries/auth";
import type { ActionResult } from "@/server/types";

/** 현재 계정의 광고 제거 on/off. (비밀 토글에서 호출) */
export async function setAdFree(adFree: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: { message: "로그인이 필요합니다." } };

  const supabase = await createClient();
  const { error } = await supabase.from("user_prefs").upsert({
    user_id: user.id,
    ad_free: adFree,
    updated_at: new Date().toISOString(),
  });

  if (error)
    return {
      ok: false,
      error: { message: "설정 저장에 실패했습니다.", detail: error.message },
    };

  // 광고는 여러 화면에 걸쳐 있으므로 레이아웃 단위로 갱신.
  revalidatePath("/", "layout");
  return { ok: true };
}
