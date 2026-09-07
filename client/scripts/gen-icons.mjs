/**
 * Regenerates PWA icons in client/public/ from scripts/icon.svg.
 * Run: npm run icons  (from the client workspace)
 */
import sharp from "sharp";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dir = (p) => fileURLToPath(new URL(p, import.meta.url));
const svg = await readFile(dir("./icon.svg"));
const pub = dir("../public/");
await mkdir(pub, { recursive: true });

// maskable: 80% safe zone, so paint the logo on a full-bleed gradient at 78% scale
const maskable = Buffer.from(
  `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
     <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#8b5cf6"/>
     </linearGradient></defs>
     <rect width="512" height="512" fill="url(#g)"/>
     <g transform="translate(56 56) scale(0.78)">
       <path d="M120 360V150M120 360h272M120 360l86-96 64 54 118-160"
         fill="none" stroke="#fff" stroke-width="34"
         stroke-linecap="round" stroke-linejoin="round"/>
     </g>
   </svg>`
);

const jobs = [
  ["pwa-192x192.png", svg, 192, null],
  ["pwa-512x512.png", svg, 512, null],
  ["maskable-512x512.png", maskable, 512, null],
  ["apple-touch-icon.png", svg, 180, { r: 79, g: 70, b: 229 }],
];

for (const [name, source, size, flatten] of jobs) {
  let img = sharp(source).resize(size, size);
  if (flatten) img = img.flatten({ background: flatten });
  await img.png().toFile(pub + name);
  console.log("wrote", name);
}

await writeFile(pub + "favicon.svg", svg);
console.log("wrote favicon.svg");
