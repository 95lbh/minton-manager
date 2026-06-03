// PWA 아이콘 생성: SVG(셔틀콕 마크) → public/*.png
// 실행: node scripts/gen-icons.mjs  (sharp 필요 — 이미 설치됨)
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");

// Cerulean(#4281A4) 배경 + 흰 셔틀콕. 풀블리드 배경이라 maskable 안전.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#4281A4"/>
  <g fill="#ffffff">
    <path d="M210 318 L158 170 Q160 150 182 154 Q256 138 330 154 Q352 150 354 170 L302 318 Z"/>
    <circle cx="256" cy="344" r="48"/>
  </g>
  <g stroke="#4281A4" stroke-width="7" stroke-linecap="round" opacity="0.9">
    <line x1="256" y1="316" x2="256" y2="150"/>
    <line x1="232" y1="316" x2="200" y2="158"/>
    <line x1="280" y1="316" x2="312" y2="158"/>
  </g>
</svg>`;

const buf = Buffer.from(svg);
const targets = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
];

for (const [name, size] of targets) {
  await sharp(buf).resize(size, size).png().toFile(join(pub, name));
  console.log("✓", name, `${size}x${size}`);
}
console.log("아이콘 생성 완료");
