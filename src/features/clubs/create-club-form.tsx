"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClub } from "@/server/mutations/clubs";
import { ROUTES } from "@/lib/constants";

export function CreateClubForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("클럽 이름을 입력하세요.");
      return;
    }
    const fd = new FormData();
    fd.set("name", name.trim());
    startTransition(async () => {
      const res = await createClub(fd);
      if (res.ok) {
        toast.success("클럽이 생성되었습니다.");
        router.push(ROUTES.dashboard);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="club-name">클럽 이름</Label>
        <Input
          id="club-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={"ex) 내맘대로 배드민턴"}
          autoFocus
          maxLength={50}
        />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "생성 중…" : "클럽 만들기"}
      </Button>
    </form>
  );
}
