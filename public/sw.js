// 서비스워커 kill switch.
// 과거 배포에서 등록된 SW가 내비게이션을 가로채 무한 로딩을 유발해, SW를 폐기한다.
// 이 파일을 받은 브라우저는 캐시를 비우고 자기 자신을 등록 해제한 뒤 페이지를 새로고침한다.
// (실시간 운영 데이터가 중요한 앱이라 오프라인 캐시의 이득보다 위험이 커서 SW를 쓰지 않음)
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        // 무시
      }
      try {
        await self.registration.unregister();
      } catch {
        // 무시
      }
      // 제어 중이던 탭들을 새로고침해 SW 없는 상태로 즉시 복구.
      try {
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          if ("navigate" in client) client.navigate(client.url);
        }
      } catch {
        // 무시
      }
    })(),
  );
});

// fetch 핸들러를 두지 않아 모든 요청은 네트워크로 그대로 통과한다(가로채지 않음).
