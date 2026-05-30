import { createClient } from "@/lib/supabase/server";
import type { Court } from "@/types/db";

/** 클럽 코트 목록 (정렬 순서대로). */
export async function getCourts(clubId: string): Promise<Court[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courts")
    .select("*")
    .eq("club_id", clubId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as Court[];
}
