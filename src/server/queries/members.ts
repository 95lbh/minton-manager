import { createClient } from "@/lib/supabase/server";
import type { ClubMember } from "@/types/db";

/** 클럽 회원 목록. includeInactive=false 면 active 만. */
export async function getMembers(
  clubId: string,
  includeInactive = true,
): Promise<ClubMember[]> {
  const supabase = await createClient();
  let query = supabase
    .from("club_members")
    .select("*")
    .eq("club_id", clubId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (!includeInactive) query = query.eq("status", "active");

  const { data, error } = await query;
  if (error || !data) return [];
  return data as ClubMember[];
}
