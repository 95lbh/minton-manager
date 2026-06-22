// 애드센스용 ads.txt — 환경변수(ca-pub-XXXX)가 있을 때만 유효한 줄을 반환.
// 미설정이면 204(내용 없음). 값을 채우면 www.myminton.com/ads.txt 로 자동 서빙.
export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT; // ca-pub-XXXX
  if (!client) return new Response("", { status: 204 });

  const pub = client.replace(/^ca-/, ""); // ads.txt 형식은 pub-XXXX
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "content-type": "text/plain" },
  });
}
