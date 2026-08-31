import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharp = require('/Users/catherina/Documents/apps/metronome/node_modules/sharp');

// SVG Generators

function createBrightSightSvg(size) {
  // Lightbulb Material Symbol: path in 960x960 coordinate space
  // Bounds: x in [180, 780] (width 600, center 480), y in [-880, -80] (height 800, center -480)
  const lightbulbPath = 'M480-80q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM320-200v-80h320v80H320Zm10-120q-69-41-109.5-110T180-580q0-125 87.5-212.5T480-880q125 0 212.5 87.5T780-580q0 81-40.5 150T630-320H330Zm24-80h252q45-32 69.5-79T700-580q0-92-64-156t-156-64q-92 0-156 64t-64 156q0 54 24.5 101t69.5 79Zm126 0Z';

  // Target size ~54% of container height
  const targetH = size * 0.54;
  const scale = targetH / 800;
  const tx = (size / 2) - (480 * scale);
  const ty = (size / 2) + (480 * scale);

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="darkBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2a2e37"/>
      <stop offset="100%" stop-color="#0e1014"/>
    </linearGradient>
    <radialGradient id="radialGlow" cx="50%" cy="18%" r="65%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.09"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.02"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="glyphGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#e4e8f0"/>
    </linearGradient>
    <filter id="glyphShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${Math.max(1, size * 0.008)}" stdDeviation="${Math.max(1, size * 0.012)}" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <!-- Dark Graphite Gradient Background matching Practice Mate / Score Tone -->
  <rect width="${size}" height="${size}" fill="url(#darkBg)"/>
  <rect width="${size}" height="${size}" fill="url(#radialGlow)"/>
  <line x1="0" y1="1" x2="${size}" y2="1" stroke="#ffffff" stroke-opacity="0.06" stroke-width="1.5"/>
  
  <!-- Centered Lightbulb Glyph -->
  <g transform="translate(${tx}, ${ty}) scale(${scale})" filter="url(#glyphShadow)">
    <path d="${lightbulbPath}" fill="url(#glyphGrad)"/>
  </g>
</svg>`;
}

function createWeatherSvg(size) {
  // Material Symbols Cloud path in 24x24 viewBox:
  // x: 0 to 24 (width 24, center 12)
  // y: 4 to 20 (height 16, center 12)
  const cloudPath = 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z';

  const targetW = size * 0.58;
  const scale = targetW / 24;
  const tx = (size - 24 * scale) / 2;
  const ty = (size - 16 * scale) / 2 - (4 * scale);

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="yellowBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFCA28"/>
      <stop offset="45%" stop-color="#FFA000"/>
      <stop offset="100%" stop-color="#F57C00"/>
    </linearGradient>
    <radialGradient id="sunGlow" cx="50%" cy="18%" r="65%">
      <stop offset="0%" stop-color="#FFFDE7" stop-opacity="0.45"/>
      <stop offset="50%" stop-color="#FFE082" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#FF8F00" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#EEF2F6"/>
    </linearGradient>
    <filter id="cloudShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="${Math.max(1, size * 0.018)}" stdDeviation="${Math.max(1, size * 0.022)}" flood-color="#B24A00" flood-opacity="0.38"/>
    </filter>
  </defs>
  <!-- Warm Radiant Yellow Gradient Background -->
  <rect width="${size}" height="${size}" fill="url(#yellowBg)"/>
  <rect width="${size}" height="${size}" fill="url(#sunGlow)"/>
  <line x1="0" y1="1" x2="${size}" y2="1" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="1.5"/>
  
  <!-- Centered Cloud Glyph with warm ambient drop shadow -->
  <g transform="translate(${tx}, ${ty}) scale(${scale})" filter="url(#cloudShadow)">
    <path d="${cloudPath}" fill="url(#cloudGrad)"/>
  </g>
</svg>`;
}

async function renderSvgToPng(svgString, outPath, size) {
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  await sharp(Buffer.from(svgString))
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`Generated: ${outPath} (${size}x${size})`);
}

async function generateAll() {
  console.log('--- Generating Weather Icons (Yellow Gradient) ---');
  
  // 1. Weather in practice-timer icons-export
  const weatherExportDir = path.join(__dirname, '../client/public/icons-export/weather');
  await renderSvgToPng(createWeatherSvg(180), path.join(weatherExportDir, 'apple-touch-icon.png'), 180);
  await renderSvgToPng(createWeatherSvg(192), path.join(weatherExportDir, 'icon-192x192.png'), 192);
  await renderSvgToPng(createWeatherSvg(512), path.join(weatherExportDir, 'icon-512x512.png'), 512);

  // 2. Weather in /Users/catherina/Documents/apps/weather/icons
  const weatherAppIconsDir = '/Users/catherina/Documents/apps/weather/icons';
  const weatherSizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'icon-48.png', size: 48 },
    { name: 'icon-72.png', size: 72 },
    { name: 'icon-96.png', size: 96 },
    { name: 'icon-120.png', size: 120 },
    { name: 'icon-128.png', size: 128 },
    { name: 'icon-144.png', size: 144 },
    { name: 'icon-152.png', size: 152 },
    { name: 'icon-167.png', size: 167 },
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-192x192.png', size: 192 },
    { name: 'icon-256.png', size: 256 },
    { name: 'icon-384.png', size: 384 },
    { name: 'icon-512.png', size: 512 },
    { name: 'icon-512x512.png', size: 512 },
    { name: 'icon-512-maskable.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'icon-macos-16.png', size: 16 },
    { name: 'icon-macos-32.png', size: 32 },
    { name: 'icon-macos-64.png', size: 64 },
    { name: 'icon-macos-128.png', size: 128 },
    { name: 'icon-macos-256.png', size: 256 },
    { name: 'icon-macos-512.png', size: 512 },
    { name: 'icon-macos-1024.png', size: 1024 },
  ];

  for (const { name, size } of weatherSizes) {
    await renderSvgToPng(createWeatherSvg(size), path.join(weatherAppIconsDir, name), size);
  }

  console.log('\n--- Generating Bright Sight Icons (Apple TV Dark Graphite Gradient) ---');

  // 3. Bright Sight in practice-timer icons-export
  const brightSightExportDir = path.join(__dirname, '../client/public/icons-export/bright-sight');
  await renderSvgToPng(createBrightSightSvg(180), path.join(brightSightExportDir, 'apple-touch-icon.png'), 180);
  await renderSvgToPng(createBrightSightSvg(192), path.join(brightSightExportDir, 'icon-192x192.png'), 192);
  await renderSvgToPng(createBrightSightSvg(512), path.join(brightSightExportDir, 'icon-512x512.png'), 512);

  // 4. Bright Sight in /Users/catherina/Documents/apps/bright-sight/
  const brightSightAppDir = '/Users/catherina/Documents/apps/bright-sight';
  const bsIconsDir = path.join(brightSightAppDir, 'public/icons');
  const bsPublicDir = path.join(brightSightAppDir, 'public');

  const bsIcons = [
    { path: path.join(bsIconsDir, 'apple-touch-icon.png'), size: 180 },
    { path: path.join(bsPublicDir, 'apple-touch-icon.png'), size: 180 },
    { path: path.join(bsIconsDir, 'icon-192.png'), size: 192 },
    { path: path.join(bsIconsDir, 'icon-192x192.png'), size: 192 },
    { path: path.join(bsIconsDir, 'icon-512.png'), size: 512 },
    { path: path.join(bsIconsDir, 'icon-512x512.png'), size: 512 },
    { path: path.join(bsIconsDir, 'favicon-16x16.png'), size: 16 },
    { path: path.join(bsIconsDir, 'favicon-32x32.png'), size: 32 },
    { path: path.join(bsIconsDir, 'favicon.ico'), size: 32 },
  ];

  for (const item of bsIcons) {
    await renderSvgToPng(createBrightSightSvg(item.size), item.path, item.size);
  }

  // Also write the vector favicon.svg for bright-sight
  fs.writeFileSync(path.join(bsIconsDir, 'favicon.svg'), createBrightSightSvg(32));
  console.log(`Generated: ${path.join(bsIconsDir, 'favicon.svg')} (vector 32x32)`);

  // Dist directory if it exists
  const bsDistIconsDir = path.join(brightSightAppDir, 'dist/icons');
  if (fs.existsSync(bsDistIconsDir)) {
    for (const item of bsIcons) {
      const distPath = path.join(bsDistIconsDir, path.basename(item.path));
      await renderSvgToPng(createBrightSightSvg(item.size), distPath, item.size);
    }
    fs.writeFileSync(path.join(bsDistIconsDir, 'favicon.svg'), createBrightSightSvg(32));
  }

  console.log('\n✅ All app icons successfully generated and copied to their respective project directories!');
}

generateAll().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
