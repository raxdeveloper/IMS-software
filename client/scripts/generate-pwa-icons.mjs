/**
 * Generates PNG icons from an inline SVG (blue background + simple eye motif).
 * Run: node scripts/generate-pwa-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/icons");
fs.mkdirSync(outDir, { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1e40af"/>
  <circle cx="256" cy="240" r="110" fill="#ffffff" opacity="0.95"/>
  <ellipse cx="215" cy="240" rx="32" ry="48" fill="#1e40af"/>
  <ellipse cx="297" cy="240" rx="32" ry="48" fill="#1e40af"/>
  <ellipse cx="256" cy="248" rx="90" ry="38" fill="none" stroke="#1e40af" stroke-width="10"/>
</svg>`;

const buf = Buffer.from(svg);
for (const size of [192, 512]) {
  await sharp(buf).resize(size, size).png().toFile(path.join(outDir, `icon-${size}.png`));
  console.log(`Wrote icon-${size}.png`);
}
