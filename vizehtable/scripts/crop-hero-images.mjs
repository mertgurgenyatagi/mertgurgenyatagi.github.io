// Asset prep: crop the leaderboard hero photos to the 800x1200 (2:3
// width:height) portrait box the hero carousel renders, using a per-photo
// focal point + zoom tuned via assets/leaderboard_hero_webps/tune.html (see
// HERO_CROP_FOCUS below — x/y match the tuner's sliders exactly). Run once
// per photo refresh; sharp is a devDependency only for this script.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC_DIR = "assets/leaderboard_hero_webps";
const OUT_DIR = "public/hero";
const OUT_WIDTH = 800;
const OUT_HEIGHT = 1200; // 3:2 height:width

// Source filename in SRC_DIR -> output filename in OUT_DIR.
const FILES = {
  "new_bellingham.jpeg": "bellingham.webp",
  "new_bruno.webp": "bruno.webp",
  "new_dembele.jpg": "dembele.webp",
  "new_haaland.webp": "haaland.webp",
  "new_kane.webp": "harry_kane.webp",
  "new_mbappe.jpg": "mbappe.webp",
  "new_musiala.jpeg": "musiala.webp",
  "new_olise.webp": "olise.webp",
  "new_pedri.jpeg": "pedri.webp",
  "new_raphinha.jpg": "raphinha.webp",
  "new_rice.jpg": "rice.webp",
  "new_rodri.jpg": "rodri.webp",
  "new_saka.jpg": "saka.webp",
  "new_valverde.jpeg": "valverde.webp",
  "new_vinijr.webp": "vinijr.webp",
  "new_wirtz.webp": "wirtz.webp",
  "new_yamal.webp": "yamal.webp",
};

// x/y are the focal point (%), zoom is the source-crop tightness (1.00 = no
// zoom) — tuned via tune.html, which simulates this exact math with a CSS
// transform so the on-screen preview matches this real crop.
const HERO_CROP_FOCUS = {
  "/hero/bellingham.webp": { x: 48, y: 6, zoom: 1.70 },
  "/hero/bruno.webp": { x: 68, y: 14, zoom: 1.00 },
  "/hero/dembele.webp": { x: 61, y: 25, zoom: 1.00 },
  "/hero/haaland.webp": { x: 44, y: 0, zoom: 1.34 },
  "/hero/harry_kane.webp": { x: 52, y: 0, zoom: 1.24 },
  "/hero/mbappe.webp": { x: 58, y: 0, zoom: 1.00 },
  "/hero/musiala.webp": { x: 28, y: 23, zoom: 1.00 },
  "/hero/olise.webp": { x: 49, y: 25, zoom: 1.00 },
  "/hero/pedri.webp": { x: 34, y: 32, zoom: 1.22 },
  "/hero/raphinha.webp": { x: 50, y: 100, zoom: 1.07 },
  "/hero/rice.webp": { x: 46, y: 31, zoom: 1.00 },
  "/hero/rodri.webp": { x: 89, y: 25, zoom: 1.00 },
  "/hero/saka.webp": { x: 80, y: 25, zoom: 1.00 },
  "/hero/valverde.webp": { x: 50, y: 0, zoom: 1.48 },
  "/hero/vinijr.webp": { x: 62, y: 25, zoom: 1.00 },
  "/hero/wirtz.webp": { x: 50, y: 25, zoom: 1.00 },
  "/hero/yamal.webp": { x: 53, y: 100, zoom: 1.12 },
};

// Mirrors object-fit:cover + object-position + a CSS transform: scale(zoom)
// anchored at the same point — the exact stack tune.html previews with. See
// that file's inline comments for the full derivation. Reducing to source
// pixels this way means "zoom" tightens the crop instead of upscaling a
// downsized image, so quality never degrades with higher zoom values.
function computeCropRect(srcW, srcH, xPct, yPct, zoom) {
  const coverScale = Math.max(OUT_WIDTH / srcW, OUT_HEIGHT / srcH);
  const dispW = srcW * coverScale;
  const dispH = srcH * coverScale;
  const focusX = dispW * (xPct / 100);
  const focusY = dispH * (yPct / 100);
  const winW = OUT_WIDTH / zoom;
  const winH = OUT_HEIGHT / zoom;

  let left = (focusX - (xPct / 100) * winW) / coverScale;
  let top = (focusY - (yPct / 100) * winH) / coverScale;
  const width = winW / coverScale;
  const height = winH / coverScale;

  left = Math.max(0, Math.min(left, srcW - width));
  top = Math.max(0, Math.min(top, srcH - height));

  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(width),
    height: Math.round(height),
  };
}

mkdirSync(OUT_DIR, { recursive: true });

for (const [srcFile, outFile] of Object.entries(FILES)) {
  const key = `/hero/${outFile}`;
  const focus = HERO_CROP_FOCUS[key];
  if (!focus) {
    console.warn(`No HERO_CROP_FOCUS entry for ${key}, skipping`);
    continue;
  }

  const srcPath = `${SRC_DIR}/${srcFile}`;
  const raw = await sharp(srcPath).metadata();
  // EXIF orientation 5-8 means the stored width/height are swapped relative
  // to the upright image — account for that before computing the crop, and
  // apply .rotate() (auto, from EXIF) in the actual pipeline below so the
  // extracted rect lines up with the upright pixels.
  const rotated = (raw.orientation ?? 1) >= 5;
  const width = rotated ? raw.height : raw.width;
  const height = rotated ? raw.width : raw.height;

  const rect = computeCropRect(width, height, focus.x, focus.y, focus.zoom);

  await sharp(srcPath)
    .rotate()
    .extract(rect)
    .resize(OUT_WIDTH, OUT_HEIGHT)
    .webp({ quality: 82 })
    .toFile(`${OUT_DIR}/${outFile}`);

  console.log(
    `${srcFile}: ${width}x${height} -> crop ${rect.width}x${rect.height} @ (${rect.left},${rect.top}) -> ${OUT_WIDTH}x${OUT_HEIGHT}`
  );
}
