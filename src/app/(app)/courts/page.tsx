import { getActiveClub } from "@/server/queries/clubs";
import { getCourts } from "@/server/queries/courts";
import { CourtsManager } from "@/features/courts/courts-manager";

export default async function CourtsPage() {
  const club = await getActiveClub();
  if (!club) return null;

  const courts = await getCourts(club.id);

  return (
    <div>
      <h1 className="text-2xl font-bold">코트 관리</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {club.name} · 코트 {courts.length}개
      </p>
      <div className="mt-6">
        <CourtsManager courts={courts} />
      </div>
    </div>
  );
}
