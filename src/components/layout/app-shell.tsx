import { AppNav } from "@/components/layout/app-nav";
import { ClubSwitcher } from "@/components/layout/club-switcher";
import { GuestBanner } from "@/components/layout/guest-banner";
import { GuestNudge } from "@/components/layout/guest-nudge";
import { FullscreenToggle } from "@/components/layout/fullscreen-toggle";
import { Button } from "@/components/ui/button";
import { signOut } from "@/server/mutations/auth";
import type { MyClub } from "@/server/queries/clubs";

export function AppShell({
  children,
  userEmail,
  clubs,
  activeClub,
  isGuest = false,
}: {
  children: React.ReactNode;
  userEmail: string;
  clubs: MyClub[];
  activeClub: MyClub;
  isGuest?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      {isGuest && <GuestBanner />}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <ClubSwitcher clubs={clubs} activeClub={activeClub} />
          <div className="flex items-center gap-2 sm:gap-3">
            {!isGuest && (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {userEmail}
              </span>
            )}
            <FullscreenToggle />
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                {isGuest ? "나가기" : "로그아웃"}
              </Button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4">
          <AppNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {isGuest && <GuestNudge />}
        {children}
      </main>

      <footer className="border-t py-4">
        <p className="mx-auto max-w-6xl px-4 text-right text-xs text-muted-foreground">
          마이민턴 (myminton) · made by bhlee
        </p>
      </footer>
    </div>
  );
}
