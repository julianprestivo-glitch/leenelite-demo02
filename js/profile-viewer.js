/*
 * Company Profile Viewer – Leen Elite (EN/AR)
 *
 * UX requirements:
 * - Show ALL pages stacked in one scrollable viewer.
 * - Next/Previous navigation between pages.
 * - Zoom in/out (layout-based zoom so panning works).
 * - Fixed download button.
 *
 * NOTE: Any “protection” here is deterrence only.
 */

document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('[data-profile-viewer]');
  if (!root) return;

  const lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
  const isArabic = lang.startsWith('ar');

  const base = root.getAttribute('data-base') || '';
  const ext = (root.getAttribute('data-ext') || 'webp').trim();
  const pad = Number(root.getAttribute('data-pad') || '3') || 3;
  const downloadHref = root.getAttribute('data-download') || '';

  const stage = root.querySelector('.pf-stage');
  const pagesEl = document.getElementById('pfPages');

  const pageEl = document.getElementById('pfPage');
  const totalEl = document.getElementById('pfTotal');
  const prevBtn = document.getElementById('pfPrev');
  const nextBtn = document.getElementById('pfNext');
  const zoomInBtn = document.getElementById('pfZoomIn');
  const zoomOutBtn = document.getElementById('pfZoomOut');
  const zoomResetBtn = document.getElementById('pfZoomReset');
  const toastEl = document.getElementById('pfToast');
  const downloadBtn = document.getElementById('pfDownload');

  if (!stage || !pagesEl || !pageEl || !totalEl || !prevBtn || !nextBtn) return;

  if (downloadBtn && downloadHref) downloadBtn.setAttribute('href', downloadHref);

  const TOAST_TEXT = isArabic ? 'محمي بواسطة لين إليت' : 'Protected by Leen Elite';

  let current = 1;
  let total = 0;

  let zoom = 1;
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 2.6;
  const ZOOM_STEP = 0.2;

  const padNum = (n) => String(n).padStart(pad, '0');
  const srcFor = (n) => `${base}page-${padNum(n)}.${ext}`;

  const showToast = () => {
    if (!toastEl) return;
    toastEl.textContent = TOAST_TEXT;
    toastEl.classList.remove('is-show');
    void toastEl.offsetWidth;
    toastEl.classList.add('is-show');
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => toastEl.classList.remove('is-show'), 1400);
  };

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const setZoom = (z) => {
    zoom = clamp(Number(z) || 1, ZOOM_MIN, ZOOM_MAX);
    root.style.setProperty('--pf-zoom', String(zoom));

    stage.dataset.canPan = zoom > 1 ? 'true' : 'false';
    if (zoom === 1) stage.scrollLeft = 0;

    root.setAttribute('data-zoom', String(zoom));
  };

  const updateControls = () => {
    prevBtn.disabled = current <= 1;
    nextBtn.disabled = total ? current >= total : false;
    pageEl.textContent = String(current);
    totalEl.textContent = total ? String(total) : '--';
  };

  const probeImage = (src) =>
    new Promise((resolve) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => resolve(true);
      im.onerror = () => resolve(false);
      im.src = src;
    });

  const detectTotal = async () => {
    // Safety cap to avoid infinite loops if a server returns 200 for missing images.
    const MAX = 80;

    // Fast sequential probing. We keep it simple and reliable.
    for (let n = 1; n <= MAX; n += 1) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await probeImage(srcFor(n));
      if (!ok) return n - 1;
    }
    return MAX;
  };

  const buildPages = async () => {
    pagesEl.innerHTML = '';
    total = await detectTotal();
    updateControls();

    for (let n = 1; n <= total; n += 1) {
      const page = document.createElement('div');
      page.className = 'pf-page';
      page.dataset.page = String(n);
      page.setAttribute('role', 'listitem');

      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.setAttribute('draggable', 'false');
      img.alt = isArabic ? `صفحة ${n} من بروفايل الشركة` : `Company profile page ${n}`;
      img.src = srcFor(n);

      page.appendChild(img);
      pagesEl.appendChild(page);
    }

    // Track the most visible page inside the stage
    const io = new IntersectionObserver(
      (entries) => {
        let best = null;
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
        });
        if (!best) return;
        const n = Number(best.target.getAttribute('data-page') || '1') || 1;
        if (n !== current) {
          current = n;
          updateControls();
        }
      },
      {
        root: stage,
        threshold: [0.55, 0.7, 0.85]
      }
    );

    pagesEl.querySelectorAll('.pf-page').forEach((el) => io.observe(el));
  };

  const scrollToPage = (n) => {
    if (!total) return;
    current = clamp(Number(n) || 1, 1, total);
    updateControls();

    const target = pagesEl.querySelector(`.pf-page[data-page="${current}"]`);
    if (!target) return;
    // Scroll within the stage container
    target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  };

  // Initial
  setZoom(1);
  updateControls();
  buildPages().then(() => scrollToPage(1));

  prevBtn.addEventListener('click', () => scrollToPage(current - 1));
  nextBtn.addEventListener('click', () => scrollToPage(current + 1));

  // Keyboard arrows for navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') scrollToPage(current - 1);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') scrollToPage(current + 1);
  });

  // Zoom buttons
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => setZoom(zoom + ZOOM_STEP));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => setZoom(zoom - ZOOM_STEP));
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => setZoom(1));

  // ---------------------------------------------------------------------------
  // Deterrence protections (viewer area only)
  // ---------------------------------------------------------------------------

  document.addEventListener(
    'contextmenu',
    (e) => {
      if (!root.contains(e.target)) return;
      e.preventDefault();
      showToast();
    },
    { capture: true }
  );

  document.addEventListener(
    'keydown',
    (e) => {
      const key = (e.key || '').toLowerCase();
      if (!e.ctrlKey && !e.metaKey) return;
      if (key === 's' || key === 'p') {
        e.preventDefault();
        showToast();
      }
    },
    { capture: true }
  );

  root.addEventListener('dragstart', (e) => {
    e.preventDefault();
    showToast();
  });

  root.addEventListener('drop', (e) => {
    e.preventDefault();
    showToast();
  });

  root.addEventListener('selectstart', (e) => {
    e.preventDefault();
  });

  // Drag-to-pan for mouse when zoomed (touch devices use native scrolling)
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startScrollLeft = 0;
  let startScrollTop = 0;

  stage.addEventListener('pointerdown', (e) => {
    if (zoom <= 1) return;
    if (e.pointerType !== 'mouse') return;
    isDragging = true;
    stage.classList.add('is-dragging');
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    startScrollLeft = stage.scrollLeft;
    startScrollTop = stage.scrollTop;
    try {
      stage.setPointerCapture(e.pointerId);
    } catch (_) {}
  });

  stage.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    stage.scrollLeft = startScrollLeft - dx;
    stage.scrollTop = startScrollTop - dy;
  });

  stage.addEventListener('pointerup', () => {
    if (!isDragging) return;
    isDragging = false;
    stage.classList.remove('is-dragging');
  });

  stage.addEventListener('pointercancel', () => {
    isDragging = false;
    stage.classList.remove('is-dragging');
  });
});
