import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/server/queries/auth";

/**
 * 현재 사용자의 "광고 제거" 설정. 비로그인/미설정이면 false.
 * cache()로 같은 요청 안 중복 조회 방지.
 */
export const getAdFree = cache(async function getAdFree(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_prefs")
    .select("ad_free")
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.ad_free ?? false;
});
