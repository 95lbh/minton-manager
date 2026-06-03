import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/constants";

/** OAuth 콜백: 인가 코드를 세션으로 교환한 뒤 원래 목적지로 이동. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // 오픈 리다이렉트 방어: 내부 경로(/...)만 허용, 프로토콜-상대(//, /\) 차단.
  const rawRedirect = searchParams.get("redirect") ?? ROUTES.dashboard;
  const redirect =
    rawRedirect.startsWith("/") &&
    !rawRedirect.startsWith("//") &&
    !rawRedirect.startsWith("/\\")
      ? rawRedirect
      : ROUTES.dashboard;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 익명 계정에 소셜 계정을 연결(linkIdentity)해 정식 전환한 경우,
      // 본인이 만든 임시 클럽을 정식 클럽으로 승격한다.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && !user.is_anonymous) {
        await supabase
          .from("clubs")
          .update({ is_temporary: false })
          .eq("owner_id", user.id)
          .eq("is_temporary", true);
      }
      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  return NextResponse.redirect(`${origin}${ROUTES.home}?error=auth`);
}
