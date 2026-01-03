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

  const safeRemove = (el) => {
    if (!el) return;
    if (typeof el.remove === 'function') el.remove();
    else if (el.parentNode) el.parentNode.removeChild(el);
  };

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
          if (slide.image) {
            const imgUrl = `url('${slide.image}')`;
            hero.style.backgroundImage = imgUrl;
            // Expose the current slide image to CSS (for contain + blurred backdrop)
            hero.style.setProperty('--hero-bg-image', imgUrl);
          }
          hero.classList.toggle('hero-fit-contain', slide.fit === 'contain');
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
      window.setTimeout(() => safeRemove(introOverlay), 650);
    };

    let seen = false;
    try {
      seen = window.sessionStorage && window.sessionStorage.getItem('introSeen') === 'true';
    } catch {
      // sessionStorage may be blocked; treat as seen to avoid trapping the user.
      seen = true;
    }

    if (seen || prefersReducedMotion) {
      safeRemove(introOverlay);
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
      window.setTimeout(hideOverlay, 3200);

      try {
        window.sessionStorage && window.sessionStorage.setItem('introSeen', 'true');
      } catch {
        // ignore
      }
    }
  }

    // ---------------------------------------------------------------------------
  // 6b) Priority clients carousel (home)
  // ---------------------------------------------------------------------------
  const initClientsCarousel = () => {
    const root = document.querySelector('[data-clients-carousel]');
    if (!root) return;

    const viewport = root.querySelector('.clients-viewport');
    const track = root.querySelector('.clients-track');
    if (!viewport || !track) return;

    const prevBtn = root.querySelector('[data-action="prev"]');
    const nextBtn = root.querySelector('[data-action="next"]');
    const dotsEl = root.querySelector('.clients-dots');

    const total = Number(root.getAttribute('data-total') || '25');
    const logos = Array.from({ length: Math.max(1, total) }, (_, i) => {
      const n = String(i + 1).padStart(2, '0');
      return { src: `../images/clients/client-${n}.png`, alt: `Client logo ${i + 1}` };
    });

    const isRTL = (document.documentElement.getAttribute('dir') || 'ltr').toLowerCase() === 'rtl';

    const getPerSlide = () => {
      if (typeof window.matchMedia !== 'function') return 10;
      if (window.matchMedia('(max-width: 560px)').matches) return 4;
      if (window.matchMedia('(max-width: 900px)').matches) return 6;
      return 10;
    };

    let perSlide = getPerSlide();
    let slides = [];
    let index = 0;
    let autoplayId = null;

    const setDotsActive = () => {
      if (!dotsEl) return;
      const dots = Array.from(dotsEl.querySelectorAll('.clients-dot'));
      dots.forEach((d, i) => d.classList.toggle('is-active', i === index));
    };

    const goTo = (nextIndex) => {
      if (!slides.length) return;
      index = (nextIndex + slides.length) % slides.length;
      track.style.transform = `translate3d(${-index * 100}%, 0, 0)`;
      setDotsActive();
    };

    const rebuild = () => {
      perSlide = getPerSlide();
      root.setAttribute('data-layout', String(perSlide));

      slides = [];
      for (let i = 0; i < logos.length; i += perSlide) slides.push(logos.slice(i, i + perSlide));

      track.innerHTML = '';
      slides.forEach((group) => {
        const slide = document.createElement('div');
        slide.className = 'clients-slide';

        const grid = document.createElement('div');
        grid.className = 'clients-grid';

        group.forEach((l) => {
          const tile = document.createElement('div');
          tile.className = 'client-tile';

          const img = document.createElement('img');
          img.src = l.src;
          img.alt = l.alt;
          img.loading = 'lazy';
          img.decoding = 'async';
          img.draggable = false;

          tile.appendChild(img);
          grid.appendChild(tile);
        });

        slide.appendChild(grid);
        track.appendChild(slide);
      });

      if (dotsEl) {
        dotsEl.innerHTML = '';
        slides.forEach((_, i) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'clients-dot';
          btn.setAttribute('aria-label', `Go to slide ${i + 1}`);
          btn.addEventListener('click', () => {
            goTo(i);
            restartAutoplay();
          });
          dotsEl.appendChild(btn);
        });
      }

      if (index >= slides.length) index = 0;
      goTo(index);
    };

    const nextDelta = isRTL ? -1 : 1;
    const prevDelta = isRTL ? 1 : -1;

    const next = () => goTo(index + nextDelta);
    const prev = () => goTo(index + prevDelta);

    if (nextBtn) nextBtn.addEventListener('click', () => { next(); restartAutoplay(); });
    if (prevBtn) prevBtn.addEventListener('click', () => { prev(); restartAutoplay(); });

    viewport.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { prev(); restartAutoplay(); }
      if (e.key === 'ArrowRight') { next(); restartAutoplay(); }
    });

    let startX = null;
    viewport.addEventListener('pointerdown', (e) => { startX = e.clientX; });
    viewport.addEventListener('pointerup', (e) => {
      if (startX == null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) < 40) return;
      if (dx < 0) next();
      else prev();
      restartAutoplay();
    });

    const pauseAutoplay = () => {
      if (autoplayId) window.clearInterval(autoplayId);
      autoplayId = null;
    };

    const startAutoplay = () => {
      if (prefersReducedMotion) return;
      if (slides.length <= 1) return;
      if (autoplayId) return;
      autoplayId = window.setInterval(next, 3600);
    };

    const restartAutoplay = () => {
      pauseAutoplay();
      startAutoplay();
    };

    root.addEventListener('mouseenter', pauseAutoplay);
    root.addEventListener('mouseleave', startAutoplay);
    root.addEventListener('focusin', pauseAutoplay);
    root.addEventListener('focusout', startAutoplay);

    window.addEventListener(
      'resize',
      debounce(() => {
        const newPer = getPerSlide();
        if (newPer !== perSlide) rebuild();
      }, 180),
      { passive: true }
    );

    rebuild();
    startAutoplay();
  };

  initClientsCarousel();

  // ---------------------------------------------------------------------------
  // 6c) Priority clients marquee (two rows, opposite directions)
  // ---------------------------------------------------------------------------
  const initClientsMarquee = () => {
    const root = document.querySelector('[data-clients-marquee]');
    if (!root) return;

    const total = Number(root.getAttribute('data-total') || '25');
    const count = Math.max(1, total);

    const logos = Array.from({ length: count }, (_, i) => {
      const n = String(i + 1).padStart(2, '0');
      return { src: `../images/clients/client-${n}.png`, alt: `Client logo ${i + 1}` };
    });

    const rows = Array.from(root.querySelectorAll('.clients-marquee-row'));
    if (!rows.length) return;

    const rotate = (arr, by) => {
      const n = arr.length;
      if (!n) return arr;
      const k = ((by % n) + n) % n;
      return arr.slice(k).concat(arr.slice(0, k));
    };

    const buildTrack = (track, items) => {
      if (!track) return;
      track.innerHTML = '';

      // Duplicate the sequence once to allow a seamless -50% translate loop in CSS.
      const sequence = prefersReducedMotion ? items : items.concat(items);

      sequence.forEach((l) => {
        const tile = document.createElement('div');
        tile.className = 'client-tile';

        const img = document.createElement('img');
        img.src = l.src;
        img.alt = l.alt;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.draggable = false;

        tile.appendChild(img);
        track.appendChild(tile);
      });
    };

    // Split logos across the two rows (no repetition between strips).
    const splitIndex = Math.ceil(logos.length / 2);
    const topLogos = logos.slice(0, splitIndex);
    const bottomRaw = logos.slice(splitIndex);
    const bottomLogos = bottomRaw.length ? bottomRaw : topLogos;

    // Small internal rotation for the second row (within its own set) for a premium feel.
    const bottomOffset = Math.floor(bottomLogos.length / 3);
    const bottomList = bottomLogos.length > 1 ? rotate(bottomLogos, bottomOffset) : bottomLogos;

    rows.forEach((row, rowIndex) => {
      const track = row.querySelector('.clients-marquee-track');
      const dataDir = (row.getAttribute('data-dir') || '').toLowerCase();

      // Row0 = top set, Row1 = bottom set; any extra rows get the full set.
      const list = rows.length >= 2 ? (rowIndex === 1 ? bottomList : topLogos) : logos;
      buildTrack(track, list);

      // If reduced motion: allow horizontal scroll and keep content single-sequence.
      if (prefersReducedMotion) {
        row.style.overflowX = 'auto';
        row.style.webkitOverflowScrolling = 'touch';
      }

      // Safety: if a user removed data-dir in markup, default alternating directions.
      if (!dataDir) row.setAttribute('data-dir', rowIndex % 2 === 0 ? 'left' : 'right');
    });
  };

  initClientsMarquee();

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


// -----------------------------------------------------------------------------
// Projects – Option A (Full image + Hover Preview + Click Toggle)
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.project-card');
  if (!cards || !cards.length) return;

  cards.forEach((card) => {
    const btn = card.querySelector('.project-media');
    if (!btn) return;

    // Initial state
    if (!card.getAttribute('data-active')) card.setAttribute('data-active', 'A');
    btn.setAttribute('aria-pressed', card.getAttribute('data-active') === 'B' ? 'true' : 'false');

    btn.addEventListener('click', () => {
      const active = card.getAttribute('data-active') || 'A';
      const next = active === 'A' ? 'B' : 'A';
      card.setAttribute('data-active', next);
      btn.setAttribute('aria-pressed', next === 'B' ? 'true' : 'false');
    });

    // Arrow keys toggle (optional, improves accessibility)
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        btn.click();
      }
    });
  });
});
