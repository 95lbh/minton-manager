import { getActiveClub } from "@/server/queries/clubs";
import { getMembers } from "@/server/queries/members";
import { MembersManager } from "@/features/members/members-manager";

export default async function MembersPage() {
  const club = await getActiveClub();
  if (!club) return null; // 레이아웃 가드가 온보딩으로 보냄

  const members = await getMembers(club.id);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">회원 관리</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{club.name}</span>
            <span className="size-1 rounded-full bg-muted-foreground/40" />
            <span>총 {members.length}명</span>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <MembersManager members={members} />
      </div>
    </div>
  );
}
