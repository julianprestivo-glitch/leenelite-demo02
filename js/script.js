/*
 * Leen Elite – Front-end UX Enhancements
 *
 * This script is intentionally lightweight and defensive.
 * It avoids assumptions about page structure and gracefully degrades.
 *
 * Features:
 * - Sync CSS --header-h to the real header height to prevent overlaps.
 * - Optional right-click protection (toggle via data-disable-contextmenu).
 * - Side-nav section highlighting (home).
 * - Optional hero slider via #hero[data-slides].
 * - Contact form friendly inline feedback (static site placeholder).
 * - Intro overlay plays once per session (with click-to-skip).
 * - Section reveal animation (IntersectionObserver).
 */

document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------------------
  // 1) Header height sync (prevents fixed header overlap on all pages)
  // ---------------------------------------------------------------------------
  const header = document.querySelector('.top-nav');
  const setHeaderHeightVar = () => {
    if (!header) return;
    const h = Math.ceil(header.getBoundingClientRect().height);
    if (h > 0) {
      document.documentElement.style.setProperty('--header-h', `${h}px`);
    }
  };

  // Tiny debounce to avoid doing layout reads too often.
  const debounce = (fn, wait = 120) => {
    let t;
    return (...args) => {
      window.clearTimeout(t);
      t = window.setTimeout(() => fn(...args), wait);
    };
  };

  setHeaderHeightVar();
  window.addEventListener('resize', debounce(setHeaderHeightVar, 150), { passive: true });
  // Fonts/icons can slightly change layout after first paint; re-sync shortly after.
  window.setTimeout(setHeaderHeightVar, 200);

  // ---------------------------------------------------------------------------
  // 2) Right-click protection (toggleable)
  // ---------------------------------------------------------------------------
  // To disable on any page: set <html data-disable-contextmenu="false"> ...
  const contextMenuFlag = (document.documentElement.getAttribute('data-disable-contextmenu') || 'true')
    .toLowerCase()
    .trim();
  const disableContextMenu = !(contextMenuFlag === 'false' || contextMenuFlag === '0' || contextMenuFlag === 'off');

  if (disableContextMenu) {
    document.addEventListener(
      'contextmenu',
      (e) => {
        // Keep UX sane: allow right-click on inputs/textareas/contenteditable.
        const allow = e.target && e.target.closest('input, textarea, [contenteditable="true"]');
        if (!allow) e.preventDefault();
      },
      { capture: true }
    );
  }

  // ---------------------------------------------------------------------------
  // 3) Side navigation highlighting (home only)
  // ---------------------------------------------------------------------------
  const navLinks = document.querySelectorAll('.side-nav a');
  const sections = document.querySelectorAll('main section[id]');
  const onScroll = () => {
    if (!navLinks.length || !sections.length) return;

    const scrollPosition = window.scrollY + window.innerHeight * 0.5;
    for (let i = 0; i < sections.length; i += 1) {
      const section = sections[i];
      const top = section.offsetTop;
      const bottom = top + section.offsetHeight;
      if (scrollPosition >= top && scrollPosition < bottom) {
        navLinks.forEach((link) => link.classList.remove('active'));
        if (navLinks[i]) navLinks[i].classList.add('active');
        break;
      }
    }
  };

  if (navLinks.length) {
    window.addEventListener('scroll', debounce(onScroll, 50), { passive: true });
    onScroll();
  }

  // ---------------------------------------------------------------------------
  // 4) Optional hero slider (home only)
  // ---------------------------------------------------------------------------
  const hero = document.querySelector('#hero');
  if (!prefersReducedMotion && hero && hero.dataset && hero.dataset.slides) {
    try {
      const slides = JSON.parse(hero.dataset.slides);
      if (Array.isArray(slides) && slides.length > 1) {
        let current = 0;
        const headingEl = hero.querySelector('.hero-heading');
        const subtitleEl = hero.querySelector('.hero-subtitle');

        const applySlide = () => {
          const slide = slides[current] || {};
          if (slide.image) hero.style.backgroundImage = `url('${slide.image}')`;
          if (headingEl) headingEl.textContent = slide.title || '';
          if (subtitleEl) subtitleEl.textContent = slide.subtitle || '';
        };

        applySlide();
        window.setInterval(() => {
          current = (current + 1) % slides.length;
          applySlide();
        }, 6000);
      }
    } catch {
      // Fail silently in production.
    }
  }

  // ---------------------------------------------------------------------------
  // 5) Contact form feedback (static site placeholder)
  // ---------------------------------------------------------------------------
  const contactForm = document.querySelector('.contact-form');
  if (contactForm) {
    const lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    const getMessage = () =>
      lang.startsWith('ar')
        ? 'شكرًا لك! تم استلام رسالتك وسنقوم بالتواصل معك قريبًا.'
        : 'Thank you! Your message has been received. We will contact you soon.';

    const ensureStatusEl = () => {
      let el = contactForm.querySelector('.form-status');
      if (!el) {
        el = document.createElement('div');
        el.className = 'form-status';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        contactForm.appendChild(el);
      }
      return el;
    };

    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const statusEl = ensureStatusEl();
      statusEl.textContent = getMessage();
      statusEl.classList.add('is-success');

      contactForm.reset();
    });
  }

  // ---------------------------------------------------------------------------
  // 6) Intro overlay (home only): short + once per session + click-to-skip
  // ---------------------------------------------------------------------------
  const introOverlay = document.getElementById('intro-overlay');
  if (introOverlay) {
    const hideOverlay = () => {
      introOverlay.classList.add('fade-out');
      window.setTimeout(() => introOverlay.remove(), 650);
    };

    let seen = false;
    try {
      seen = window.sessionStorage && window.sessionStorage.getItem('introSeen') === 'true';
    } catch {
      // sessionStorage may be blocked; treat as seen to avoid trapping the user.
      seen = true;
    }

    if (seen || prefersReducedMotion) {
      introOverlay.remove();
    } else {
      // Allow user to skip immediately
      introOverlay.addEventListener('click', hideOverlay, { once: true });
      window.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') hideOverlay();
        },
        { once: true }
      );

      // Auto-hide quickly for better UX
      window.setTimeout(hideOverlay, 1400);

      try {
        window.sessionStorage && window.sessionStorage.setItem('introSeen', 'true');
      } catch {
        // ignore
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 7) Section reveal
  // ---------------------------------------------------------------------------
  const fadeSections = document.querySelectorAll('.section-fade');
  if (fadeSections.length) {
    if (prefersReducedMotion || typeof window.IntersectionObserver !== 'function') {
      fadeSections.forEach((el) => el.classList.add('visible'));
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12 }
      );
      fadeSections.forEach((el) => observer.observe(el));
    }
  }

  // ---------------------------------------------------------------------------
  // 8) Make all images non-draggable
  // ---------------------------------------------------------------------------
  document.querySelectorAll('img').forEach((img) => img.setAttribute('draggable', 'false'));
});
