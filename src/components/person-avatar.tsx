import { cn } from "@/lib/utils";

// 성별 톤: 남=하늘, 여=로즈, 그 외=중립. 앱 전역에서 사람 표시에 공통 사용.
const GENDER_AVATAR: Record<string, string> = {
  male: "bg-sky-100 text-sky-700 border-sky-200",
  female: "bg-rose-100 text-rose-700 border-rose-200",
};

export function genderAvatarClass(gender?: string | null) {
  return gender && GENDER_AVATAR[gender]
    ? GENDER_AVATAR[gender]
    : "bg-muted text-muted-foreground border-border";
}

/** 성별 톤 원형 아바타. label(보통 급수 글자)을 안에 표시. 크기/글자는 className으로 조정. */
export function PersonAvatar({
  gender,
  label,
  className,
}: {
  gender?: string | null;
  label?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
        genderAvatarClass(gender),
        className,
      )}
    >
      {label && label.length > 0 ? label : "·"}
    </div>
  );
}
