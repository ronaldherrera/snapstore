const { Jimp } = require('jimp');
const path = require('path');

async function createIcon() {
  const size = 512;
  const img = new Jimp({ width: size, height: size, color: 0x000000ff });

  // Colores prisma
  const cyan   = 0x00e5ffff;
  const green  = 0x00ff88ff;
  const yellow = 0xffe600ff;
  const orange = 0xff6600ff;
  const white  = 0xffffffff;
  const gray   = 0xffffff99;

  // Función para dibujar una línea gruesa pixel a pixel
  function drawLine(x0, y0, x1, y1, color, thickness = 2) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0, y = y0;
    while (true) {
      for (let tx = -thickness; tx <= thickness; tx++)
        for (let ty = -thickness; ty <= thickness; ty++)
          if (x+tx >= 0 && x+tx < size && y+ty >= 0 && y+ty < size)
            img.setPixelColor(color, x+tx, y+ty);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx)  { err += dx; y += sy; }
    }
  }

  // Prisma centrado: punta arriba en (256,80), base en (140,400) y (372,400)
  const px = 256, pt = 80, bl = 140, br = 372, pb = 420;

  // Rayo entrante (izquierda)
  drawLine(20, 240, px - 30, 240, white, 2);

  // Rayos dispersados (desde el lado derecho del prisma)
  // Punto de salida aproximado: lado derecho del prisma ~(300, 260)
  const ox = 310, oy = 270;
  drawLine(ox, oy, size - 10, 60,  cyan,   3);
  drawLine(ox, oy, size - 10, 160, green,  3);
  drawLine(ox, oy, size - 10, 270, yellow, 3);
  drawLine(ox, oy, size - 10, 380, orange, 3);

  // Triángulo del prisma (3 lados)
  drawLine(px, pt, bl, pb, gray, 2); // lado izquierdo
  drawLine(px, pt, br, pb, gray, 2); // lado derecho
  drawLine(bl, pb, br, pb, gray, 2); // base

  // Guardar
  const out = path.join(__dirname, '../build/icon.png');
  await img.write(out);
  console.log('Icono guardado en:', out);
}

createIcon().catch(console.error);
