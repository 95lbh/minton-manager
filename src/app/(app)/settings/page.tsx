import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveClub } from "@/server/queries/clubs";
import { ROUTES } from "@/lib/constants";
import { ClubSettings } from "@/features/clubs/club-settings";

export default async function SettingsPage() {
  const club = await getActiveClub();
  if (!club) redirect(ROUTES.onboarding);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = !!user && club.owner_id === user.id;

  return (
    <div>
      <h1 className="text-2xl font-bold">설정</h1>
      <p className="mt-1 text-sm text-muted-foreground">클럽 공유 및 관리</p>
      <div className="mt-6 max-w-2xl">
        <ClubSettings
          clubId={club.id}
          clubName={club.name}
          joinCode={club.join_code}
          isOwner={isOwner}
        />
      </div>
    </div>
  );
}
