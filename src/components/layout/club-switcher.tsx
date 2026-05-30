"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setActiveClub } from "@/server/mutations/clubs";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { MyClub } from "@/server/queries/clubs";

export function ClubSwitcher({
  clubs,
  activeClub,
}: {
  clubs: MyClub[];
  activeClub: MyClub;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleSelect = (clubId: string) => {
    if (clubId === activeClub.id) return;
    startTransition(async () => {
      await setActiveClub(clubId);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-lg font-bold hover:bg-muted"
      >
        {activeClub.name}
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {clubs.map((club) => (
          <DropdownMenuItem
            key={club.id}
            onClick={() => handleSelect(club.id)}
            className="flex items-center justify-between"
          >
            <span>{club.name}</span>
            <Check
              className={cn(
                "size-4",
                club.id === activeClub.id ? "opacity-100" : "opacity-0",
              )}
            />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(ROUTES.onboarding)}>
          <Plus className="size-4" />새 클럽 만들기
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
