import { UpgradeButtons } from "@/features/auth/upgrade-buttons";

/**
 * 체험(비회원) 모드 안내 배너.
 * 익명 계정에 소셜 계정을 연결(linkIdentity)하면 데이터를 유지한 채 정식 클럽으로 전환된다.
 */
export function GuestBanner() {
  return (
    <div className="border-b border-amber-200 bg-amber-50 text-amber-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          <b>비회원 모드</b> — 일회성 클럽으로 운영 중입니다. 데이터 보관·통계는 제한될
          수 있어요. 로그인하여 정식 클럽으로 전환하세요.
        </p>
        <UpgradeButtons />
      </div>
    </div>
  );
}
