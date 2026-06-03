// honey_minton 서비스워커 — 보수적 캐싱
// 운영 도구라 '실시간 데이터'가 중요 → RSC/API는 캐시하지 않는다.
//  - 페이지 내비게이션: 네트워크 우선, 오프라인이면 offline.html 폴백
//  - 정적 자산(_next/static, 아이콘, 폰트): 캐시 우선(불변 해시 자산)
//  - 그 외: 그냥 네트워크 (stale 방지)
const CACHE = "hm-cache-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // 페이지 이동: 네트워크 우선 → 실패 시 오프라인 폴백
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  const url = new URL(req.url);
  const isStatic =
    url.pathname.startsWith("/_next/static") ||
    /\.(?:png|svg|ico|webp|woff2?)$/.test(url.pathname);

  // 정적 자산: 캐시 우선 + 백그라운드 채우기
  if (isStatic) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
  }
  // 그 외(RSC/데이터): 기본 네트워크 (캐시 안 함)
});
