/*
 * Company Profile Viewer – Leen Elite (EN/AR)
 *
 * IMPORTANT:
 * This is deterrence, not absolute protection.
 * It blocks easy actions (right click, drag, Ctrl+S/P, print) and keeps the
 * profile as images instead of a downloadable PDF.
 */

document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('[data-profile-viewer]');
  if (!root) return;

  const lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
  const isArabic = lang.startsWith('ar');

  const base = root.getAttribute('data-base') || '';
  const ext = (root.getAttribute('data-ext') || 'webp').trim();
  const pad = Number(root.getAttribute('data-pad') || '3') || 3;

  const img = document.getElementById('pfImage');
  const pageEl = document.getElementById('pfPage');
  const totalEl = document.getElementById('pfTotal');
  const prevBtn = document.getElementById('pfPrev');
  const nextBtn = document.getElementById('pfNext');

  const zoomInBtn = document.getElementById('pfZoomIn');
  const zoomOutBtn = document.getElementById('pfZoomOut');
  const zoomResetBtn = document.getElementById('pfZoomReset');

  const toastEl = document.getElementById('pfToast');

  if (!img || !pageEl || !totalEl || !prevBtn || !nextBtn) return;

  const TOAST_TEXT = isArabic ? 'محمي بواسطة لين إليت' : 'Protected by leenelite';

  // Stage is the scroll/pan container
  const stage = root.querySelector('.pf-stage');

  let current = 1;
  let total = null;

  let zoom = 1;
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 2.6;
  const ZOOM_STEP = 0.2;

  const padNum = (n) => String(n).padStart(pad, '0');
  const srcFor = (n) => `${base}page-${padNum(n)}.${ext}`;

  const showToast = () => {
    if (!toastEl) return;
    toastEl.textContent = TOAST_TEXT;
    toastEl.classList.remove('is-show'); // restart animation
    // Force reflow to restart transition (safe)
    void toastEl.offsetWidth;
    toastEl.classList.add('is-show');
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => toastEl.classList.remove('is-show'), 1400);
  };

  // IMPORTANT:
  // Using transform: scale() makes the image look bigger but does not increase
  // its layout size, so the stage can't scroll/pan correctly.
  // We zoom by increasing image width instead, so panning works everywhere.
  const setZoom = (z) => {
    zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

    // Disable transform-zoom and switch to width-based zoom (enables true pan)
    img.style.transform = 'none';
    img.style.width = `${Math.round(zoom * 100)}%`;

    if (stage) {
      stage.dataset.canPan = zoom > 1 ? 'true' : 'false';
      // Reset scroll when going back to 1x for a clean view
      if (zoom === 1) {
        stage.scrollLeft = 0;
        stage.scrollTop = 0;
      }
    }

    root.setAttribute('data-zoom', String(zoom));
  };

  const updateControls = () => {
    prevBtn.disabled = current <= 1;
    if (total != null) nextBtn.disabled = current >= total;
    else nextBtn.disabled = false;

    pageEl.textContent = String(current);
    totalEl.textContent = total == null ? '--' : String(total);
  };

  const preloadNext = () => {
    if (total != null) return;
    const probeIndex = current + 1;

    const probe = new Image();
    probe.decoding = 'async';
    probe.loading = 'eager';
    probe.src = srcFor(probeIndex);

    probe.onerror = () => {
      // If next page doesn't exist, we discovered the end.
      if (total == null) {
        total = current;
        updateControls();
      }
    };
  };

  const loadPage = (n) => {
    const nextIndex = Math.max(1, Number(n) || 1);

    // If we know total, clamp.
    if (total != null) current = Math.min(nextIndex, total);
    else current = nextIndex;

    updateControls();

    img.classList.add('is-loading');
    img.src = srcFor(current);

    // If this page fails, fallback to previous/first.
    img.onerror = () => {
      img.classList.remove('is-loading');
      // If total is unknown, this means we tried to go beyond the last page.
      if (total == null && current > 1) {
        total = current - 1;
        current = total;
        updateControls();
        img.src = srcFor(current);
        return;
      }
      showToast();
    };

    img.onload = () => {
      img.classList.remove('is-loading');
      // Discover total gradually.
      preloadNext();
    };
  };

  // Initial
  img.setAttribute('draggable', 'false');
  setZoom(1);
  loadPage(1);

  prevBtn.addEventListener('click', () => loadPage(current - 1));
  nextBtn.addEventListener('click', () => loadPage(current + 1));

  // Keyboard arrows for navigation (nice UX)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') loadPage(current - 1);
    if (e.key === 'ArrowRight') loadPage(current + 1);
  });

  // Zoom buttons (optional)
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => setZoom(zoom + ZOOM_STEP));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => setZoom(zoom - ZOOM_STEP));
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => setZoom(1));

  // ---------------------------------------------------------------------------
  // Deterrence protections (viewer only)
  // ---------------------------------------------------------------------------

  // Prevent context menu
  document.addEventListener(
    'contextmenu',
    (e) => {
      if (!root.contains(e.target)) return;
      e.preventDefault();
      showToast();
    },
    { capture: true }
  );

  // Block Ctrl+S / Ctrl+P
  document.addEventListener(
    'keydown',
    (e) => {
      const key = (e.key || '').toLowerCase();
      if (!e.ctrlKey && !e.metaKey) return; // ctrl on Win/Linux, meta on macOS

      if (key === 's' || key === 'p') {
        e.preventDefault();
        showToast();
      }
    },
    { capture: true }
  );

  // Prevent drag & drop for images
  root.addEventListener('dragstart', (e) => {
    e.preventDefault();
    showToast();
  });

  root.addEventListener('drop', (e) => {
    e.preventDefault();
    showToast();
  });

  // Reduce selection in viewer area
  root.addEventListener('selectstart', (e) => {
    e.preventDefault();
  });

  // Prevent long-press save image on some mobile browsers (best effort)
  img.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 1) return;
    // do nothing, just attach to allow CSS -webkit-touch-callout to apply
  });

  // Optional: swipe next/prev inside viewer stage
  // When zoomed-in, we DO NOT swipe pages (gesture should pan/scroll the image).
  if (stage) {
    let startX = null;
    let startY = null;

    // Drag-to-pan for mouse (touch devices already scroll naturally)
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    stage.addEventListener('pointerdown', (e) => {
      // If zoomed in, allow panning
      if (zoom > 1) {
        // Touch: rely on native scrolling
        if (e.pointerType !== 'mouse') return;
        isDragging = true;
        stage.classList.add('is-dragging');
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        startScrollLeft = stage.scrollLeft;
        startScrollTop = stage.scrollTop;
        try { stage.setPointerCapture(e.pointerId); } catch (_) {}
        return;
      }

      // Not zoomed: enable swipe-to-next/prev
      startX = e.clientX;
      startY = e.clientY;
    });

    stage.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      stage.scrollLeft = startScrollLeft - dx;
      stage.scrollTop = startScrollTop - dy;
    });

    stage.addEventListener('pointerup', (e) => {
      if (isDragging) {
        isDragging = false;
        stage.classList.remove('is-dragging');
        return;
      }

      // If zoomed-in, ignore swipe navigation
      if (zoom > 1) {
        startX = null;
        startY = null;
        return;
      }

      if (startX == null || startY == null) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = null;
      startY = null;

      if (Math.abs(dx) < 45) return;
      if (Math.abs(dy) > 70) return;

      if (dx < 0) loadPage(current + 1);
      else loadPage(current - 1);
    });

    stage.addEventListener('pointercancel', () => {
      isDragging = false;
      stage.classList.remove('is-dragging');
      startX = null;
      startY = null;
    });
  }
});
