"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** 통계 기간 선택 — ?period= 쿼리로 반영(서버 컴포넌트가 읽어 집계). */
export function PeriodSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const onChange = (v: string | null) => {
    const params = new URLSearchParams(sp.toString());
    if (!v || v === "all") params.delete("period");
    else params.set("period", v);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-32" aria-label="통계 기간">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">전체 기간</SelectItem>
        <SelectItem value="30d">최근 30일</SelectItem>
        <SelectItem value="month">이번 달</SelectItem>
      </SelectContent>
    </Select>
  );
}
