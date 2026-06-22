import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveClub, listClubAdmins } from "@/server/queries/clubs";
import { ROUTES } from "@/lib/constants";
import { ClubSettings } from "@/features/clubs/club-settings";
import { ClubLogoSettings } from "@/features/clubs/club-logo-settings";
import { DataResetSettings } from "@/features/settings/data-reset";
import { DataTransferSettings } from "@/features/settings/data-transfer";
import { DevTools } from "@/features/settings/dev-tools";
import { AdFreeSecret } from "@/features/settings/ad-free-secret";
import { getAdFree } from "@/server/queries/prefs";

export default async function SettingsPage() {
  const club = await getActiveClub();
  if (!club) redirect(ROUTES.onboarding);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = !!user && club.owner_id === user.id;

  // 임시(비회원) 클럽은 공유 기능을 숨기므로 관리자 목록 조회 생략.
  const admins = club.is_temporary ? [] : await listClubAdmins(club.id);
  const adFree = await getAdFree();

  return (
    <div>
      <h1 className="text-2xl font-bold">설정</h1>
      <p className="mt-1 text-sm text-muted-foreground">클럽 공유 및 관리</p>
      <div className="mt-6 max-w-2xl space-y-6">
        <ClubLogoSettings
          clubId={club.id}
          clubName={club.name}
          logoUrl={club.logo_url}
        />
        <ClubSettings
          clubId={club.id}
          clubName={club.name}
          joinCode={club.join_code}
          isOwner={isOwner}
          isTemporary={club.is_temporary}
          currentUserId={user?.id ?? ""}
          admins={admins}
        />
        <DataTransferSettings isOwner={isOwner} />
        <DataResetSettings isOwner={isOwner} />
        <DevTools />
        <AdFreeSecret adFree={adFree} />
      </div>
    </div>
  );
}
