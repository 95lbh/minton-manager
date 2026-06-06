import { toast } from "sonner";

/**
 * 순위/결과 텍스트를 클립보드에 복사(카카오톡 등 공유용).
 * 제목 + 줄 목록을 합쳐 붙여넣기 좋은 평문으로 만든다.
 */
export async function copyStandings(title: string, lines: string[]) {
  const text = [title, ...lines].join("\n");
  try {
    await navigator.clipboard.writeText(text);
    toast.success("결과를 복사했습니다. 붙여넣어 공유하세요.");
  } catch {
    toast.error("복사에 실패했습니다. 직접 선택해 복사하세요.");
  }
}
