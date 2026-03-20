const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const archiver = require('archiver');
const cors = require('cors');
const path = require('path');
const https = require('https');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

const IS_LINUX = process.platform === 'linux';
const CHROME_PATH = IS_LINUX
  ? null  // se resuelve en tiempo de ejecución con @sparticuz/chromium
  : 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function getChromiumPath() {
  if (IS_LINUX) {
    const chromium = require('@sparticuz/chromium');
    return await chromium.executablePath();
  }
  return CHROME_PATH;
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Palabras clave que indican que una imagen NO es un producto
const LOGO_KEYWORDS = [
  'logo', 'brand', 'marca', 'manufacturer', 'fabricante', 'sprite', 'banner',
  'header', 'footer', 'icon', 'ico', 'avatar', 'placeholder', 'pixel',
  'tracking', 'analytics', 'loading', 'spinner', 'blank', 'spacer',
  'schneider-electric', 'hager', 'solera', 'legrand', 'siemens', 'abb', 'gewiss',
  '1x1', 'dot.gif', 'transparent'
];

// Patrones de URL de logos/iconos
const LOGO_URL_PATTERNS = [
  /\/logo[s]?\//i, /\/brand[s]?\//i, /\/marca[s]?\//i, /\/icon[s]?\//i,
  /\/sprite/i, /\/banner/i, /logo\.(png|jpg|svg|webp)/i,
  /favicon/i, /\.svg(\?|$)/i
];

// Alt texts que son claramente marcas/logos (nombre solo sin descripción técnica)
const BRAND_NAMES = [
  'schneider electric', 'schneider', 'hager', 'solera', 'legrand', 'siemens',
  'abb', 'gewiss', 'simon', 'niessen', 'bticino', 'jung', 'berker',
  'philips', 'osram', 'ledvance', 'finder', 'omron', 'carlo gavazzi'
];

function toSlug(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function isLogoOrBrandImage(src, alt, width, height) {
  const srcLower = (src || '').toLowerCase();
  const altLower = (alt || '').toLowerCase().trim();

  // Filtrar por URL
  if (LOGO_URL_PATTERNS.some(p => p.test(srcLower))) return true;
  if (LOGO_KEYWORDS.some(k => srcLower.includes(k))) return true;

  // Filtrar si el alt es exactamente un nombre de marca
  if (BRAND_NAMES.includes(altLower)) return true;

  // Filtrar imágenes muy pequeñas (iconos)
  if (width && height && (width < 80 || height < 80)) return true;

  // Filtrar SVGs (casi siempre iconos)
  if (srcLower.endsWith('.svg') || srcLower.includes('.svg?')) return true;

  // Filtrar píxeles de tracking
  if (srcLower.includes('pixel') || srcLower.includes('track') || srcLower.includes('1x1')) return true;

  // Filtrar data URIs vacíos o placeholder
  if (src && src.startsWith('data:image') && src.length < 200) return true;

  return false;
}

// ============ SCRAPING CON PUPPETEER ============
async function scrapeWithPuppeteer(url) {
  const executablePath = await getChromiumPath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    ignoreHTTPSErrors: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1440,900'
    ]
  });

  try {
    const page = await browser.newPage();

    // Evitar detección de bot
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1440, height: 900 });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Esperar a que aparezcan imágenes de productos
    await page.waitForTimeout(2000);

    // Scroll para cargar lazy load
    await autoScroll(page);
    await page.waitForTimeout(1500);

    // Extraer productos desde el DOM renderizado
    const products = await page.evaluate((logoKeywords, brandNames, logoUrlPatterns) => {
      const results = [];
      const seen = new Set();

      // Reconstruir regexp en el contexto del navegador
      const logoPatterns = [
        /\/logo[s]?\//i, /\/brand[s]?\//i, /\/marca[s]?\//i, /\/icon[s]?\//i,
        /\/sprite/i, /\/banner/i, /logo\.(png|jpg|svg|webp)/i,
        /favicon/i, /\.svg(\?|$)/i
      ];

      function isLogo(src, alt, el) {
        const srcLow = (src || '').toLowerCase();
        const altLow = (alt || '').toLowerCase().trim();
        if (logoKeywords.some(k => srcLow.includes(k))) return true;
        if (logoPatterns.some(p => p.test(srcLow))) return true;
        if (brandNames.includes(altLow)) return true;
        if (srcLow.endsWith('.svg') || srcLow.includes('.svg?')) return true;
        if (src && src.startsWith('data:image') && src.length < 200) return true;
        // Dimensiones renderizadas
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && (rect.width < 80 || rect.height < 80)) return true;
        return false;
      }

      function resolveUrl(src) {
        if (!src) return '';
        if (src.startsWith('data:')) return src;
        try { return new URL(src, window.location.href).href; } catch { return src; }
      }

      function cleanShopifyUrl(url) {
        return url.replace(/(_\d+x\d*|_\d*x\d+)(\.\w+)(\?|$)/, '$2$3');
      }

      function getSrc(img) {
        return img.getAttribute('data-src') ||
               img.getAttribute('data-lazy-src') ||
               img.getAttribute('data-original') ||
               img.getAttribute('data-image') ||
               img.getAttribute('srcset')?.split(',')[0]?.trim()?.split(' ')[0] ||
               img.src || '';
      }

      // Estrategia 1: buscar en contenedores de producto típicos
      const productSelectors = [
        'li.product', 'article.product', '.product-item', '.product-card',
        '.grid-item', '.item-product', '[data-product]', '[data-product-card]',
        '.catalog-product', '.product-box', '.product-wrapper',
        '.product-list-item', '.product-tile', '.product-cell',
        // Obramat / Leroy Merlin style
        '[class*="ProductCard"]', '[class*="product-card"]', '[class*="ProductItem"]',
        '[class*="product-item"]', '[class*="product_card"]', '[class*="ArticleCard"]',
        '[class*="article-card"]', '[class*="CatalogProduct"]',
        // Genérico con imagen + título
        'figure', '.card', '.item'
      ];

      for (const sel of productSelectors) {
        const containers = document.querySelectorAll(sel);
        if (containers.length < 2) continue; // necesitamos al menos 2 para ser un listado

        containers.forEach(container => {
          const img = container.querySelector('img');
          if (!img) return;

          const src = resolveUrl(cleanShopifyUrl(getSrc(img)));
          if (!src || src.startsWith('data:image') && src.length < 200) return;
          if (seen.has(src)) return;

          // Nombre: primero buscar en el contenedor, luego alt
          const nameEl = container.querySelector(
            'h1,h2,h3,h4,h5,.product-title,.product-name,.card-title,.item-title,' +
            '[class*="title"],[class*="name"],[class*="Title"],[class*="Name"]'
          );
          const name = (nameEl?.textContent?.trim() || img.alt || img.title || '').trim();
          if (!name) return;

          if (isLogo(src, img.alt, img)) return;

          seen.add(src);
          results.push({ name, src });
        });

        if (results.length >= 3) break;
      }

      // Estrategia 2 (fallback): todas las imágenes visibles con tamaño decente
      if (results.length < 3) {
        document.querySelectorAll('img').forEach(img => {
          const src = resolveUrl(cleanShopifyUrl(getSrc(img)));
          if (!src || seen.has(src)) return;
          if (isLogo(src, img.alt, img)) return;

          const rect = img.getBoundingClientRect();
          if (rect.width < 100 || rect.height < 100) return;

          const name = (img.alt || img.title || '').trim();
          if (!name) return;

          seen.add(src);
          results.push({ name, src });
        });
      }

      return results;
    }, LOGO_KEYWORDS, BRAND_NAMES, null);

    return products.map((p, idx) => ({
      id: `prod-${idx}`,
      name: p.name,
      slug: toSlug(p.name),
      originalUrl: p.src
    }));

  } finally {
    await browser.close();
  }
}

// Scroll automático para activar lazy load
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      const distance = 300;
      const delay = 150;
      let scrolled = 0;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        scrolled += distance;
        if (scrolled >= document.body.scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, delay);
    });
  });
}

// ============ SCRAPING CON AXIOS (fallback) ============
async function scrapeWithAxios(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    },
    timeout: 20000,
    maxRedirects: 5,
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  const $ = cheerio.load(response.data);
  const products = [];
  const seen = new Set();

  const selectors = [
    'li.product', 'article.product', '.product-item', '.product-card',
    '[data-product-card]', '.grid__item', 'figure', '.card', '.item'
  ];

  for (const sel of selectors) {
    $(sel).each((i, el) => {
      const $el = $(el);
      const img = $el.find('img').first();
      const src = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src') || '';
      const alt = img.attr('alt') || img.attr('title') || '';
      const name = $el.find('h1,h2,h3,h4,[class*="title"],[class*="name"]').first().text().trim() || alt;

      if (!src || !name || seen.has(src)) return;
      if (isLogoOrBrandImage(src, alt)) return;

      let imgUrl = src;
      if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
      else if (imgUrl.startsWith('/')) {
        const u = new URL(url);
        imgUrl = u.origin + imgUrl;
      }

      seen.add(src);
      products.push({ name, src: imgUrl });
    });
    if (products.length >= 3) break;
  }

  return products.map((p, idx) => ({
    id: `prod-${idx}`,
    name: p.name,
    slug: toSlug(p.name),
    originalUrl: p.src
  }));
}

// ============ RUTAS ============
app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL requerida' });
  if (!url.startsWith('http')) return res.status(400).json({ error: 'URL debe empezar por http:// o https://' });

  try {
    console.log(`[Scrape] ${url}`);
    let products = [];
    let method = 'puppeteer';

    try {
      products = await scrapeWithPuppeteer(url);
      console.log(`[Puppeteer] ${products.length} productos`);
    } catch (puppErr) {
      console.warn('[Puppeteer] Error, usando axios fallback:', puppErr.message);
      method = 'axios';
      products = await scrapeWithAxios(url);
      console.log(`[Axios] ${products.length} productos`);
    }

    if (products.length === 0) {
      return res.json({
        products: [],
        warning: 'No se encontraron productos. La página puede tener protección anti-bot avanzada o una estructura no reconocida.'
      });
    }

    res.json({ products, method });
  } catch (err) {
    console.error('[Error]', err.message);
    res.status(500).json({ error: `Error al acceder a la URL: ${err.message}` });
  }
});

// Proxy imagen
app.get('/api/image-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('URL requerida');

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*',
        'Referer': (() => { try { return new URL(url).origin; } catch { return ''; } })()
      },
      timeout: 15000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(response.data);
  } catch {
    res.status(404).send('Imagen no disponible');
  }
});

// Descarga individual
app.get('/api/download-single', async (req, res) => {
  const { url, slug } = req.query;
  if (!url) return res.status(400).send('URL requerida');

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*',
        'Referer': (() => { try { return new URL(url).origin; } catch { return ''; } })()
      },
      timeout: 15000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    const ext = contentType.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') || 'jpg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${slug || 'imagen'}.${ext}"`);
    res.send(Buffer.from(response.data));
  } catch {
    res.status(404).send('No se pudo descargar');
  }
});

// Descarga ZIP
app.post('/api/download-zip', async (req, res) => {
  const { products } = req.body;
  if (!products?.length) return res.status(400).json({ error: 'Sin productos' });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="productos.zip"');

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);

  for (const product of products) {
    try {
      const response = await axios.get(product.originalUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*,*/*',
          'Referer': (() => { try { return new URL(product.originalUrl).origin; } catch { return ''; } })()
        },
        timeout: 15000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      });

      const contentType = response.headers['content-type'] || 'image/jpeg';
      const ext = contentType.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') || 'jpg';
      archive.append(Buffer.from(response.data), { name: `${product.slug}.${ext}` });
    } catch (err) {
      console.error(`[ZIP] Error ${product.slug}:`, err.message);
    }
  }

  await archive.finalize();
});

app.listen(PORT, () => {
  console.log(`\n✅ Servidor en http://localhost:${PORT}\n`);
});
