import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/constants";

/** 로그인 화면은 첫 진입 랜딩(`/`)으로 통합되었다. 기존 링크 호환용 별칭. */
export default function LoginPage() {
  redirect(ROUTES.home);
}
