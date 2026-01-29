/*
 * Company Profile Viewer – Leen Elite (EN/AR)
 *
 * UX (current):
 * - Show all pages stacked with vertical scroll.
 * - Keep only two actions: Download PDF + Fullscreen.
 * - Show a simple loader on first open.
 * - Provide a clear Exit Fullscreen button (and support Esc).
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
  const toastEl = document.getElementById('pfToast');
  const downloadBtn = document.getElementById('pfDownload');
  const loaderEl = document.getElementById('pfLoader');
  const fsBtn = document.getElementById('pfFullscreen');
  const exitFsBtn = document.getElementById('pfExitFullscreen');

  if (!stage || !pagesEl) return;
  if (downloadBtn && downloadHref) downloadBtn.setAttribute('href', downloadHref);

  const TOAST_TEXT = isArabic ? 'محمي بواسطة لين إليت' : 'Protected by Leen Elite';
  const LOADING_TEXT = isArabic ? 'جارٍ التحميل…' : 'Loading…';

  const padNum = (n) => String(n).padStart(pad, '0');
  const srcFor = (n) => `${base}page-${padNum(n)}.${ext}`;

  const showToast = () => {
    if (!toastEl) return;
    toastEl.textContent = TOAST_TEXT;
    toastEl.classList.remove('is-show');
    // force reflow
    void toastEl.offsetWidth;
    toastEl.classList.add('is-show');
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => toastEl.classList.remove('is-show'), 1400);
  };

  const setLoading = (on) => {
    if (!loaderEl) return;
    loaderEl.textContent = LOADING_TEXT;
    loaderEl.classList.toggle('is-show', !!on);
    loaderEl.setAttribute('aria-hidden', on ? 'false' : 'true');
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
    for (let n = 1; n <= MAX; n += 1) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await probeImage(srcFor(n));
      if (!ok) return n - 1;
    }
    return MAX;
  };

  const buildPages = async () => {
    setLoading(true);
    pagesEl.innerHTML = '';
    stage.scrollTop = 0;
    stage.scrollLeft = 0;

    const total = await detectTotal();

    let firstImg = null;

    for (let n = 1; n <= total; n += 1) {
      const page = document.createElement('div');
      page.className = 'pf-page';
      page.dataset.page = String(n);
      page.setAttribute('role', 'listitem');

      const img = document.createElement('img');
      img.decoding = 'async';
      img.setAttribute('draggable', 'false');
      img.classList.add('is-loading');

      // First page: prioritize loading so the user sees content quickly.
      if (n === 1) {
        img.loading = 'eager';
        img.setAttribute('fetchpriority', 'high');
        firstImg = img;
      } else {
        img.loading = 'lazy';
      }

      img.alt = isArabic ? `صفحة رقم ${n} من بروفايل الشركة` : `Page ${n} of the company profile`;

      img.addEventListener('load', () => {
        img.classList.remove('is-loading');
        if (n === 1) setLoading(false);
      });
      img.addEventListener('error', () => {
        img.classList.remove('is-loading');
        if (n === 1) setLoading(false);
      });

      img.src = srcFor(n);

      page.appendChild(img);
      pagesEl.appendChild(page);
    }

    // If the first image is cached and already complete, hide the loader immediately.
    if (firstImg && firstImg.complete) setLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Fullscreen controls
  // ---------------------------------------------------------------------------

  const setFullscreenState = () => {
    const isFs = document.fullscreenElement === root;
    root.setAttribute('data-fullscreen', isFs ? 'true' : 'false');
  };

  const enterFullscreen = async () => {
    if (!document.fullscreenEnabled || !root.requestFullscreen) return;
    if (document.fullscreenElement) return;
    try {
      await root.requestFullscreen({ navigationUI: 'hide' });
    } catch (_) {}
  };

  const exitFullscreen = async () => {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch (_) {}
  };

  document.addEventListener('fullscreenchange', setFullscreenState);
  setFullscreenState();

  if (fsBtn) {
    const supported = !!document.fullscreenEnabled && !!root.requestFullscreen;
    fsBtn.disabled = !supported;
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) exitFullscreen();
      else enterFullscreen();
    });
  }

  if (exitFsBtn) {
    exitFsBtn.addEventListener('click', () => exitFullscreen());
  }

  // Esc: explicitly exit fullscreen (native Esc already works, this keeps state consistent)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.fullscreenElement) {
      exitFullscreen();
    }
  });

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

  // Initial
  buildPages();
});
