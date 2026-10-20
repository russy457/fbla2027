/**
 * Build responsive editorial photos from the licensed source images.
 * Keep originals outside public/ so Firebase Hosting serves only WebP files.
 */
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import sharp from "sharp";

const sourceDir = fileURLToPath(new URL("../assets/source-images/", import.meta.url));
const outputDir = fileURLToPath(new URL("../public/images/", import.meta.url));
const files = (await readdir(sourceDir)).filter((name) => name.endsWith(".jpg"));

for (const file of files) {
  const source = join(sourceDir, file);
  const stem = file.slice(0, -4);
  // The textured garden hero stays sharp at desktop width without a large first download.
  const fullWidth = stem === "home-garden" ? 1600 : 1800;
  const fullQuality = stem === "home-garden" ? 74 : 82;
  const full = await sharp(source)
    .rotate()
    .resize({ width: fullWidth, height: 1800, fit: "inside", withoutEnlargement: true })
    .webp({ quality: fullQuality, effort: 6 })
    .toFile(join(outputDir, `${stem}.webp`));
  const thumb = await sharp(source)
    .rotate()
    .resize({ width: 640, height: 960, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80, effort: 6 })
    .toFile(join(outputDir, `${stem}-thumb.webp`));
  console.log(`${stem}: ${Math.round(full.size / 1024)} KB full, ${Math.round(thumb.size / 1024)} KB thumbnail`);
}
