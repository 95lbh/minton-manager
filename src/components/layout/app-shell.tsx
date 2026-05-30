import { AppNav } from "@/components/layout/app-nav";
import { ClubSwitcher } from "@/components/layout/club-switcher";
import { Button } from "@/components/ui/button";
import { signOut } from "@/server/mutations/auth";
import type { MyClub } from "@/server/queries/clubs";

export function AppShell({
  children,
  userEmail,
  clubs,
  activeClub,
}: {
  children: React.ReactNode;
  userEmail: string;
  clubs: MyClub[];
  activeClub: MyClub;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <ClubSwitcher clubs={clubs} activeClub={activeClub} />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {userEmail}
            </span>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                로그아웃
              </Button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-2">
          <AppNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
