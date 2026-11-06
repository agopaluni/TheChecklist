// Regenerates every app icon from assets/logo.png (square, black background).
// Run: node scripts/make-icons.mjs
import sharp from "sharp";

const logo = "assets/logo.png";
const black = { r: 0, g: 0, b: 0, alpha: 1 };

// Plain icons: the logo as-is.
for (const [file, size] of [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["src/app/apple-icon.png", 180], // iOS rounds the corners itself
  ["src/app/icon.png", 64], // favicon
  ["public/logo-mark.png", 96], // header mark
]) {
  await sharp(logo).resize(size, size).png().toFile(file);
}

// Maskable (Android crops it to a circle or squircle): shrink into the safe zone.
const inner = Math.round(512 * 0.7);
await sharp({ create: { width: 512, height: 512, channels: 4, background: black } })
  .composite([{ input: await sharp(logo).resize(inner, inner).toBuffer(), gravity: "center" }])
  .png()
  .toFile("public/icons/maskable-512.png");

console.log("icons written");
