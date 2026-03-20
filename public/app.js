// ============ STATE ============
let products = [];
let currentView = 'grid';
let renameTargetId = null;
let allSelected = false;

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('urlInput').addEventListener('keydown', e => { if (e.key === 'Enter') scrapeUrl(); });
  document.getElementById('renameInput').addEventListener('input', updateSlugPreview);
  document.getElementById('renameInput').addEventListener('keydown', e => { if (e.key === 'Enter') confirmRename(); });
});

// ============ SCRAPING ============
async function scrapeUrl() {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) { showError('Por favor ingresa una URL válida.'); return; }
  if (!url.startsWith('http')) { showError('La URL debe comenzar con http:// o https://'); return; }

  hideError(); hideWarning();
  showLoading(true);
  setSearchDisabled(true);

  try {
    const res = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (!res.ok) { showError(data.error || 'Error al escanear la página.'); return; }
    if (data.warning) showWarning(data.warning);
    if (!data.products?.length) { showError('No se encontraron productos o imágenes en la página.'); return; }

    products = data.products.map(p => ({ ...p, selected: false, removed: false, processedUrl: null }));
    renderProducts();
    showResults(true);
    toast(`${products.length} productos encontrados`, 'success');
    updateHeaderCount();
  } catch (err) {
    showError(`Error de conexión: ${err.message}`);
  } finally {
    showLoading(false);
    setSearchDisabled(false);
  }
}

// ============ RENDER ============
function renderProducts() {
  const grid = document.getElementById('productGrid');
  const active = products.filter(p => !p.removed);
  grid.innerHTML = '';
  active.forEach((p, i) => grid.appendChild(buildCard(p, i)));
  updateResultsCount();
  updateActionButtons();
}

function buildCard(p, animIdx) {
  const card = document.createElement('div');
  card.className = `product-card${p.selected ? ' selected' : ''}`;
  card.id = `card-${p.id}`;
  card.style.animationDelay = `${animIdx * 0.03}s`;

  const imgSrc = p.processedUrl || `/api/image-proxy?url=${encodeURIComponent(p.originalUrl)}`;
  const transparentClass = p.processedUrl ? ' transparent-bg' : '';
  const bgBadge = p.processedUrl ? `<div class="bg-badge">sin fondo</div>` : '';
  const bgBtnLabel = p.processedUrl ? 'Restaurar' : 'Quitar fondo';
  const bgBtnClass = p.processedUrl ? 'bg-remove active' : 'bg-remove';

  if (currentView === 'list') {
    card.innerHTML = `
      <div class="card-select">
        <input type="checkbox" class="card-checkbox" ${p.selected ? 'checked' : ''}
          onchange="toggleSelect('${p.id}', this.checked)" />
      </div>
      <div class="card-img-wrap${transparentClass}" id="imgwrap-${p.id}">
        <img class="card-img" src="${imgSrc}" alt="${escHtml(p.name)}"
          onerror="this.parentElement.innerHTML=imgPlaceholder()" loading="lazy" />
        ${bgBadge}
      </div>
      <div class="card-body">
        <div class="card-info">
          <div class="card-name" title="${escHtml(p.name)}">${escHtml(p.name)}</div>
          <div class="card-slug">${escHtml(p.slug)}</div>
        </div>
        <div class="card-actions">
          <button class="card-btn edit" onclick="openRename('${p.id}')">${iconEdit()} Renombrar</button>
          <button class="card-btn ${bgBtnClass}" id="bgbtn-${p.id}" onclick="toggleBg('${p.id}')">${iconMagic()} ${bgBtnLabel}</button>
          <button class="card-btn download" onclick="downloadSingle('${p.id}')">${iconDownload()} Descargar</button>
          <button class="card-btn-remove" onclick="removeProduct('${p.id}')" title="Quitar">${iconX()}</button>
        </div>
      </div>`;
  } else {
    card.innerHTML = `
      <div class="card-select">
        <input type="checkbox" class="card-checkbox" ${p.selected ? 'checked' : ''}
          onchange="toggleSelect('${p.id}', this.checked)" />
      </div>
      <button class="card-btn-remove" onclick="removeProduct('${p.id}')" title="Quitar">${iconX()}</button>
      <div class="card-img-wrap${transparentClass}" id="imgwrap-${p.id}">
        <img class="card-img" src="${imgSrc}" alt="${escHtml(p.name)}"
          onerror="this.parentElement.innerHTML=imgPlaceholder()" loading="lazy" />
        ${bgBadge}
      </div>
      <div class="card-body">
        <div class="card-name" title="${escHtml(p.name)}">${escHtml(p.name)}</div>
        <div class="card-slug">${escHtml(p.slug)}</div>
        <div class="card-actions">
          <button class="card-btn edit" onclick="openRename('${p.id}')">${iconEdit()} Renombrar</button>
          <button class="card-btn ${bgBtnClass}" id="bgbtn-${p.id}" onclick="toggleBg('${p.id}')">${iconMagic()} ${bgBtnLabel}</button>
          <button class="card-btn download" onclick="downloadSingle('${p.id}')">${iconDownload()} Bajar</button>
        </div>
      </div>`;
  }
  return card;
}

function imgPlaceholder() {
  return `<div class="card-img-placeholder">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg><span>Sin imagen</span></div>`;
}

// ============ SELECCIÓN ============
function toggleSelect(id, checked) {
  const p = products.find(x => x.id === id);
  if (p) p.selected = checked;
  document.getElementById(`card-${id}`)?.classList.toggle('selected', checked);
  updateActionButtons();
  updateSelectAllBtn();
}

function toggleSelectAll() {
  allSelected = !allSelected;
  products.filter(p => !p.removed).forEach(p => { p.selected = allSelected; });
  renderProducts();
  updateSelectAllBtn();
}

function updateSelectAllBtn() {
  const active = products.filter(p => !p.removed);
  const sel = active.filter(p => p.selected).length;
  allSelected = sel === active.length && active.length > 0;
  document.getElementById('btnSelectAll').textContent = allSelected ? 'Deseleccionar todo' : 'Seleccionar todo';
}

// ============ QUITAR PRODUCTO ============
function removeProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  p.removed = true; p.selected = false;
  const card = document.getElementById(`card-${id}`);
  if (card) { card.classList.add('removed'); setTimeout(() => renderProducts(), 300); }
  toast(`"${p.name}" quitado`, 'info');
  updateHeaderCount();
}

function removeSelected() {
  const sel = products.filter(p => !p.removed && p.selected);
  if (!sel.length) return;
  sel.forEach(p => { p.removed = true; p.selected = false; });
  renderProducts(); updateHeaderCount(); updateSelectAllBtn();
  toast(`${sel.length} producto${sel.length !== 1 ? 's' : ''} quitado${sel.length !== 1 ? 's' : ''}`, 'info');
}

function clearAll() {
  products = [];
  showResults(false);
  document.getElementById('urlInput').value = '';
  hideError(); hideWarning();
  updateHeaderCount();
  document.getElementById('headerActions').style.display = 'none';
  document.getElementById('toleranceBar').style.display = 'none';
}

// ============ RENAME ============
function openRename(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  renameTargetId = id;
  document.getElementById('renameInput').value = p.name;
  document.getElementById('slugPreview').textContent = p.slug;
  const proxyUrl = p.processedUrl || `/api/image-proxy?url=${encodeURIComponent(p.originalUrl)}`;
  document.getElementById('modalPreview').innerHTML =
    `<img src="${proxyUrl}" alt="" style="max-width:100%;max-height:180px;object-fit:contain" onerror="this.style.display='none'" />`;
  document.getElementById('modalOverlay').style.display = 'flex';
  setTimeout(() => document.getElementById('renameInput').focus(), 100);
}

function updateSlugPreview() {
  document.getElementById('slugPreview').textContent = toSlug(document.getElementById('renameInput').value);
}

function confirmRename() {
  const input = document.getElementById('renameInput').value.trim();
  if (!input) return;
  const p = products.find(x => x.id === renameTargetId);
  if (p) { p.name = input; p.slug = toSlug(input); renderProducts(); toast('Nombre actualizado', 'success'); }
  closeModal();
}

function closeModal(event) {
  if (event && event.target !== document.getElementById('modalOverlay')) return;
  document.getElementById('modalOverlay').style.display = 'none';
  renameTargetId = null;
}

// ============ DESCARGAS ============
async function downloadSingle(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  toast(`Descargando "${p.slug}"...`, 'info');

  if (p.processedUrl) {
    // Imagen procesada: descarga directa desde data URL como PNG
    const a = document.createElement('a');
    a.href = p.processedUrl;
    a.download = `${p.slug}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  } else {
    const a = document.createElement('a');
    a.href = `/api/download-single?url=${encodeURIComponent(p.originalUrl)}&slug=${encodeURIComponent(p.slug)}`;
    a.download = p.slug;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
}

async function downloadZip() {
  const selected = products.filter(p => !p.removed && p.selected);
  if (!selected.length) { toast('Selecciona al menos un producto', 'error'); return; }

  const btn = document.getElementById('btnDownloadZip');
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;border-top-color:#fff;border-color:rgba(255,255,255,0.3);margin:0"></div> Preparando ZIP...`;
  toast(`Preparando ZIP con ${selected.length} imagen(es)...`, 'info');

  // Separar procesadas (data URL) de las originales
  const processed = selected.filter(p => p.processedUrl);
  const originals = selected.filter(p => !p.processedUrl);

  try {
    // Para las procesadas usamos JSZip client-side
    if (processed.length > 0 && originals.length === 0) {
      await downloadZipClientSide(selected);
    } else if (processed.length === 0) {
      // Todas originales: usar servidor
      await downloadZipServer(selected);
    } else {
      // Mixto: todo client-side con fetch para las originales
      await downloadZipClientSide(selected);
    }
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    updateActionButtons();
  }
}

async function downloadZipServer(selected) {
  const res = await fetch('/api/download-zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products: selected })
  });
  if (!res.ok) throw new Error('Error al generar el ZIP');
  const blob = await res.blob();
  triggerDownload(URL.createObjectURL(blob), 'productos.zip');
  toast(`ZIP descargado con ${selected.length} producto(s)`, 'success');
}

async function downloadZipClientSide(selected) {
  // Cargamos JSZip dinámicamente si no está disponible
  if (!window.JSZip) {
    await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
  }
  const zip = new JSZip();

  for (const p of selected) {
    try {
      let blob;
      if (p.processedUrl) {
        // data URL → blob
        blob = dataURLtoBlob(p.processedUrl);
        zip.file(`${p.slug}.png`, blob);
      } else {
        // Descargar original via proxy
        const res = await fetch(`/api/image-proxy?url=${encodeURIComponent(p.originalUrl)}`);
        blob = await res.blob();
        const ext = blob.type.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') || 'jpg';
        zip.file(`${p.slug}.${ext}`, blob);
      }
    } catch (err) {
      console.warn('Error en ZIP para', p.slug, err.message);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  triggerDownload(URL.createObjectURL(content), 'productos.zip');
  toast(`ZIP descargado con ${selected.length} producto(s)`, 'success');
}

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function dataURLtoBlob(dataURL) {
  const [header, data] = dataURL.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ============ QUITAR FONDO ============
function getTolerance() {
  return parseInt(document.getElementById('toleranceSlider').value) || 30;
}

function updateToleranceLabel(val) {
  document.getElementById('toleranceValue').textContent = val;
}

async function toggleBg(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;

  // Si ya tiene fondo quitado, restaurar original
  if (p.processedUrl) {
    p.processedUrl = null;
    updateCardImage(p);
    toast('Imagen restaurada', 'info');
    return;
  }

  // Mostrar spinner en la tarjeta
  setCardProcessing(id, true);

  try {
    const dataUrl = await removeBackground(p.originalUrl, getTolerance());
    p.processedUrl = dataUrl;
    updateCardImage(p);
    toast(`Fondo quitado: "${p.name}"`, 'success');
  } catch (err) {
    toast(`Error al quitar fondo: ${err.message}`, 'error');
  } finally {
    setCardProcessing(id, false);
  }
}

async function removeBgSelected() {
  const selected = products.filter(p => !p.removed && p.selected && !p.processedUrl);
  if (!selected.length) { toast('No hay imágenes sin procesar seleccionadas', 'info'); return; }

  const btn = document.getElementById('btnBgSelected');
  btn.disabled = true;

  toast(`Procesando ${selected.length} imagen(es)...`, 'info');
  const tolerance = getTolerance();
  let ok = 0;

  for (const p of selected) {
    setCardProcessing(p.id, true);
    try {
      p.processedUrl = await removeBackground(p.originalUrl, tolerance);
      updateCardImage(p);
      ok++;
    } catch (err) {
      console.warn('Error bg', p.slug, err.message);
    } finally {
      setCardProcessing(p.id, false);
    }
  }

  btn.disabled = false;
  toast(`Fondo quitado en ${ok} de ${selected.length} imagen(es)`, 'success');
}

// Actualiza solo la imagen y badge de una tarjeta sin re-render completo
function updateCardImage(p) {
  const wrap = document.getElementById(`imgwrap-${p.id}`);
  const btn = document.getElementById(`bgbtn-${p.id}`);
  if (!wrap) { renderProducts(); return; }

  const imgSrc = p.processedUrl || `/api/image-proxy?url=${encodeURIComponent(p.originalUrl)}`;

  if (p.processedUrl) {
    wrap.classList.add('transparent-bg');
    let badge = wrap.querySelector('.bg-badge');
    if (!badge) { badge = document.createElement('div'); badge.className = 'bg-badge'; wrap.appendChild(badge); }
    badge.textContent = 'sin fondo';
    if (btn) { btn.classList.add('active'); btn.innerHTML = `${iconMagic()} Restaurar`; }
  } else {
    wrap.classList.remove('transparent-bg');
    wrap.querySelector('.bg-badge')?.remove();
    if (btn) { btn.classList.remove('active'); btn.innerHTML = `${iconMagic()} Quitar fondo`; }
  }

  const img = wrap.querySelector('img');
  if (img) img.src = imgSrc;
}

function setCardProcessing(id, show) {
  const wrap = document.getElementById(`imgwrap-${id}`);
  if (!wrap) return;
  const existing = wrap.querySelector('.card-processing');
  if (show && !existing) {
    const div = document.createElement('div');
    div.className = 'card-processing';
    div.innerHTML = `<div class="spinner" style="width:32px;height:32px;border-top-color:#a78bfa;border-color:rgba(167,139,250,0.25)"></div>`;
    wrap.appendChild(div);
  } else if (!show && existing) {
    existing.remove();
  }
}

// ============ ALGORITMO FLOOD FILL ============
async function removeBackground(originalUrl, tolerance = 30) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const bgColor = sampleBackgroundColor(imageData);

        floodFillFromEdges(imageData, bgColor, tolerance);
        // Segunda pasada con tolerancia menor para bordes internos
        edgeSmoothPass(imageData, tolerance * 0.5);

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
  });
}

// Muestrea color de fondo tomando los 4 esquinas y los bordes
function sampleBackgroundColor(imageData) {
  const { data, width, height } = imageData;
  const samples = [];
  const corners = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
    [Math.floor(width / 2), 0], [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)], [Math.floor(width / 2), height - 1]
  ];
  for (const [x, y] of corners) {
    const i = (y * width + x) * 4;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  // Color más frecuente entre muestras (mediana)
  const avg = samples.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]], [0, 0, 0]);
  return avg.map(v => Math.round(v / samples.length));
}

// Flood fill BFS desde todas las esquinas y bordes
function floodFillFromEdges(imageData, bgColor, tolerance) {
  const { data, width, height } = imageData;
  const visited = new Uint8Array(width * height);
  const queue = [];

  // Añadir todos los píxeles del borde
  for (let x = 0; x < width; x++) { queue.push(x, 0); queue.push(x, height - 1); }
  for (let y = 1; y < height - 1; y++) { queue.push(0, y); queue.push(width - 1, y); }

  // BFS iterativo
  let qi = 0;
  while (qi < queue.length) {
    const x = queue[qi++];
    const y = queue[qi++];
    const idx = y * width + x;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const pi = idx * 4;
    if (data[pi + 3] === 0) continue; // ya transparente

    const dist = colorDist(data[pi], data[pi + 1], data[pi + 2], bgColor[0], bgColor[1], bgColor[2]);
    if (dist > tolerance) continue;

    data[pi + 3] = 0; // transparente

    if (x > 0)         { queue.push(x - 1, y); }
    if (x < width - 1) { queue.push(x + 1, y); }
    if (y > 0)         { queue.push(x, y - 1); }
    if (y < height - 1){ queue.push(x, y + 1); }
  }
}

// Suavizado de bordes: pone semi-transparentes los píxeles adyacentes al área eliminada
function edgeSmoothPass(imageData, tolerance) {
  const { data, width, height } = imageData;
  const copy = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      if (copy[idx + 3] === 0) continue;

      // Contar vecinos transparentes
      let transparentNeighbors = 0;
      const neighbors = [
        ((y - 1) * width + x) * 4, ((y + 1) * width + x) * 4,
        (y * width + (x - 1)) * 4, (y * width + (x + 1)) * 4
      ];
      for (const ni of neighbors) { if (copy[ni + 3] === 0) transparentNeighbors++; }

      if (transparentNeighbors > 0) {
        // Reducir alpha proporcionalmente al número de vecinos transparentes
        data[idx + 3] = Math.max(0, data[idx + 3] - (transparentNeighbors * 40));
      }
    }
  }
}

function colorDist(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

// ============ VISTA ============
function setView(view) {
  currentView = view;
  document.getElementById('productGrid').classList.toggle('list-view', view === 'list');
  document.getElementById('viewGrid').classList.toggle('active', view === 'grid');
  document.getElementById('viewList').classList.toggle('active', view === 'list');
  renderProducts();
}

// ============ UI HELPERS ============
function showLoading(show) { document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none'; }
function showResults(show) {
  document.getElementById('resultsSection').style.display = show ? 'block' : 'none';
  document.getElementById('headerActions').style.display = show ? 'flex' : 'none';
  document.getElementById('countBadge').style.display = show ? 'inline' : 'none';
  document.getElementById('btnClear').style.display = show ? 'inline-block' : 'none';
}
function setSearchDisabled(d) {
  document.getElementById('btnScrape').disabled = d;
  document.getElementById('urlInput').disabled = d;
}
function showError(msg) { const el = document.getElementById('errorBox'); el.textContent = msg; el.style.display = 'block'; }
function hideError() { document.getElementById('errorBox').style.display = 'none'; }
function showWarning(msg) {
  const el = document.getElementById('warningBox');
  el.innerHTML = `<span>${msg}</span>
    <a href="https://github.com/ronaldherrera/snapstore/releases/latest/download/SnapStore.Setup.1.0.0.exe" target="_blank" rel="noopener" class="warning-download-btn">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Descargar versión local
    </a>`;
  el.style.display = 'block';
}
function hideWarning() { document.getElementById('warningBox').style.display = 'none'; }

function updateResultsCount() {
  const n = products.filter(p => !p.removed).length;
  document.getElementById('resultsCount').textContent = `${n} producto${n !== 1 ? 's' : ''}`;
}
function updateHeaderCount() {
  const n = products.filter(p => !p.removed).length;
  document.getElementById('countBadge').textContent = `${n} PRODUCTOS`;
}

function updateActionButtons() {
  const sel = products.filter(p => !p.removed && p.selected);
  const count = sel.length;
  const unprocessed = sel.filter(p => !p.processedUrl).length;

  document.getElementById('zipCount').textContent = count;
  document.getElementById('removeCount').textContent = count;
  document.getElementById('bgCount').textContent = unprocessed;

  document.getElementById('btnDownloadZip').style.display = count > 0 ? 'inline-flex' : 'none';
  document.getElementById('btnRemoveSelected').style.display = count > 0 ? 'inline-flex' : 'none';
  document.getElementById('btnBgSelected').style.display = count > 0 ? 'inline-flex' : 'none';

  // Mostrar barra de tolerancia cuando hay selección o hay algún producto procesado
  const anyBg = products.some(p => !p.removed && p.processedUrl);
  document.getElementById('toleranceBar').style.display = (count > 0 || anyBg) ? 'flex' : 'none';
}

// ============ UTILS ============
function toSlug(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s\-_]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
}
function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toast(msg, type = 'info') {
  const icons = {
    success: `<svg class="toast-icon success" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg class="toast-icon error" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info: `<svg class="toast-icon info" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8"/><line x1="12" y1="12" x2="12" y2="16"/></svg>`
  };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icons[type] || ''}<span>${escHtml(msg)}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateX(20px)'; el.style.transition='0.3s ease'; setTimeout(() => el.remove(), 300); }, 3500);
}

// ============ ICONOS ============
function iconEdit() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
}
function iconDownload() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
}
function iconX() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
}
function iconMagic() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5"/></svg>`;
}
