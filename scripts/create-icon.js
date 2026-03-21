const { Jimp } = require('jimp');
const path = require('path');

async function createIcon() {
  const size = 512;
  const img = new Jimp({ width: size, height: size, color: 0x000000ff });

  const cyan   = 0x00e5ffff;
  const green  = 0x00ff88ff;
  const yellow = 0xffe600ff;
  const white  = 0xffffffff;

  function drawLine(x0, y0, x1, y1, color, thickness = 3) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0, y = y0;
    while (true) {
      for (let tx = -thickness; tx <= thickness; tx++)
        for (let ty = -thickness; ty <= thickness; ty++)
          if (tx*tx + ty*ty <= thickness*thickness)  // círculo en lugar de cuadrado
            if (x+tx >= 0 && x+tx < size && y+ty >= 0 && y+ty < size)
              img.setPixelColor(color, x+tx, y+ty);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx)  { err += dx; y += sy; }
    }
  }

  // Escala 1:16 respecto al favicon (32×32 → 512×512)
  // Vértices del prisma: top=(16,4) bl=(6,28) br=(26,28) → ×16
  const top = { x: 256, y: 64  };
  const bl  = { x: 96,  y: 448 };
  const br  = { x: 416, y: 448 };

  // Punto de entrada del rayo en el lado izquierdo (y=16 → y=256)
  const enter = { x: 176, y: 256 };
  // Punto de salida en el lado derecho
  const exit  = { x: 336, y: 256 };

  // Rayo entrante
  drawLine(16, 256, enter.x, enter.y, white, 14);

  // Rayos dispersados — sólidos
  drawLine(exit.x, exit.y, 496,  144, cyan,   18);
  drawLine(exit.x, exit.y, 496,  256, green,  18);
  drawLine(exit.x, exit.y, 496,  368, yellow, 18);

  // Prisma: 3 lados con trazo grueso
  drawLine(top.x, top.y, bl.x, bl.y, white, 12);
  drawLine(top.x, top.y, br.x, br.y, white, 12);
  drawLine(bl.x,  bl.y,  br.x, br.y, white, 12);

  const out = path.join(__dirname, '../build/icon.png');
  await img.write(out);
  console.log('Icono guardado en:', out);
}

createIcon().catch(console.error);
