const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function createIcon() {
  const size = 512;

  // SVG del icono a tamaño completo (mismo diseño que el favicon, escalado a 512x512)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
    <defs>
      <linearGradient id="r1" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#00e5ff" stop-opacity="1"/>
        <stop offset="100%" stop-color="#00e5ff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="r2" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#00ff88" stop-opacity="1"/>
        <stop offset="100%" stop-color="#00ff88" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="r3" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#ffe600" stop-opacity="1"/>
        <stop offset="100%" stop-color="#ffe600" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="r4" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#ff6600" stop-opacity="1"/>
        <stop offset="100%" stop-color="#ff6600" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <!-- Fondo negro con esquinas redondeadas -->
    <rect width="100" height="100" rx="22" fill="#000"/>
    <!-- Prisma triangular (detrás) -->
    <polygon points="50,14 22,82 78,82" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
    <!-- Rayo entrante (izquierda) -->
    <line x1="2" y1="59" x2="50" y2="59" stroke="rgba(255,255,255,0.7)" stroke-width="5.5" stroke-linecap="round"/>
    <!-- Rayos de luz dispersada (delante del prisma) -->
    <line x1="50" y1="59" x2="98" y2="26" stroke="url(#r1)" stroke-width="6.5" stroke-linecap="round"/>
    <line x1="50" y1="59" x2="98" y2="43" stroke="url(#r2)" stroke-width="6.5" stroke-linecap="round"/>
    <line x1="50" y1="59" x2="98" y2="62" stroke="url(#r3)" stroke-width="6.5" stroke-linecap="round"/>
    <line x1="50" y1="59" x2="98" y2="79" stroke="url(#r4)" stroke-width="6.5" stroke-linecap="round"/>
  </svg>`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>* { margin:0; padding:0; } body { background:#000; width:${size}px; height:${size}px; overflow:hidden; }</style>
</head>
<body>${svg}</body>
</html>`;

  // Detectar Chrome/Chromium disponible
  const chromePaths = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.CHROME_PATH,
  ].filter(Boolean);

  let executablePath;
  for (const p of chromePaths) {
    if (fs.existsSync(p)) { executablePath = p; break; }
  }
  if (!executablePath) {
    // Intentar @sparticuz/chromium
    const chromium = require('@sparticuz/chromium');
    executablePath = await chromium.executablePath();
  }

  const browser = await puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size });
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const out = path.join(__dirname, '../build/icon.png');
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: size, height: size } });
  await browser.close();

  console.log('Icono guardado en:', out);
}

createIcon().catch(console.error);
