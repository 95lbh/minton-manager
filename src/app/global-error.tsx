"use client";

import { useEffect } from "react";

/**
 * 루트 레이아웃까지 깨졌을 때의 최후 방어선(흰 화면 방지).
 * Tailwind/폰트가 안 떴을 수 있어 인라인 스타일만 사용한다.
 * error는 콘솔로 남긴다(서버 오류는 Vercel 함수 로그, 클라이언트는 브라우저 콘솔).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            문제가 발생했어요
          </h1>
          <p style={{ marginTop: 8, color: "#64748b", fontSize: 14 }}>
            잠시 후 다시 시도해 주세요. 계속되면 새로고침해 주세요.
          </p>
          {error.digest && (
            <p style={{ marginTop: 8, color: "#94a3b8", fontSize: 12 }}>
              오류 코드: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#4281A4",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
