import { ImageResponse } from "next/og";

// 카카오톡/슬랙/트위터 등 링크 미리보기에 쓰이는 1200×630 브랜드 배너.
// next/og(Satori)로 동적 생성 — 한글 폰트 미내장 이슈를 피하려 이미지 텍스트는 라틴 표기.
// 한글 제목/설명은 layout 메타데이터(og:title/description)로 전달된다.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "마이민턴 (myminton)";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #4281A4 0%, #2e6884 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 30,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.8)",
          }}
        >
          Badminton Club Manager
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 150,
            fontWeight: 800,
            letterSpacing: -4,
            lineHeight: 1,
          }}
        >
          myminton
        </div>
        <div
          style={{
            marginTop: 36,
            width: 140,
            height: 10,
            borderRadius: 999,
            background: "#7ED0CB",
          }}
        />
        <div
          style={{
            marginTop: 36,
            fontSize: 34,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          Attendance · Courts · Stats
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 48,
            fontSize: 30,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          myminton.com
        </div>
      </div>
    ),
    { ...size },
  );
}
