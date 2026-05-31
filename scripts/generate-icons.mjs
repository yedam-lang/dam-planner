import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '..', 'public', 'icons')
mkdirSync(iconsDir, { recursive: true })

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f3e8ff"/>
      <stop offset="100%" stop-color="#ddd6fe"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="url(#bg)"/>
  <text
    x="${size / 2}"
    y="${Math.round(size * 0.68)}"
    font-family="Apple SD Gothic Neo, Malgun Gothic, Nanum Gothic, sans-serif"
    font-size="${Math.round(size * 0.52)}"
    font-weight="700"
    fill="#7c3aed"
    text-anchor="middle"
    dominant-baseline="auto">담</text>
</svg>`

for (const size of [192, 512]) {
  const buf = Buffer.from(svg(size))
  await sharp(buf)
    .resize(size, size)
    .png()
    .toFile(join(iconsDir, `icon-${size}.png`))
  console.log(`✓ icon-${size}.png`)
}
