// Regenerates the PWA icons from one SVG. Run: node scripts/make-icons.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const icon = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#e24a2b"/>
  <g transform="translate(256 256) scale(${pad ? 0.72 : 1}) translate(-256 -256)">
    <rect x="132" y="150" width="248" height="212" rx="34" fill="#fffdf9" opacity="0.18"/>
    <path d="M150 266 L222 338 L366 186" fill="none" stroke="#fffdf9" stroke-width="58"
      stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

writeFileSync("src/app/icon.svg", icon(false));
const out = [
  ["public/icons/icon-192.png", 192, false],
  ["public/icons/icon-512.png", 512, false],
  ["public/icons/maskable-512.png", 512, true],
  ["src/app/apple-icon.png", 180, true],
];
for (const [file, size, pad] of out) {
  await sharp(Buffer.from(icon(pad))).resize(size, size).png().toFile(file);
}
console.log("icons written");
