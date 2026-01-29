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

  // Conversion tracking placeholders (Google Ads / GA4 ready)
  // You can connect these to GTM/GA4 by listening for:
  // - dataLayer events (leenelite_*), or
  // - the CustomEvent 'leenelite:conversion'.
  const trackConversion = (name, payload = {}) => {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: `leenelite_${name}`, ...payload });
    } catch {
      // ignore
    }

    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', name, payload);
      }
    } catch {
      // ignore
    }

    try {
      window.dispatchEvent(new CustomEvent('leenelite:conversion', { detail: { name, ...payload } }));
    } catch {
      // ignore
    }
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
  // 1b) Mobile menu toggle (hamburger)
  // ---------------------------------------------------------------------------
  // On small screens the top navigation turns into a dropdown panel. This
  // toggle manages the open/close state with accessible aria-expanded updates.
  const navToggle = document.querySelector('.nav-toggle');
  const primaryNav = header ? header.querySelector('nav') : null;

  if (header && navToggle && primaryNav) {
    const closeMenu = () => {
      header.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    };

    const openMenu = () => {
      header.classList.add('is-open');
      navToggle.setAttribute('aria-expanded', 'true');
    };

    const toggleMenu = () => {
      const isOpen = header.classList.contains('is-open');
      if (isOpen) closeMenu();
      else openMenu();
    };

    navToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    // Close the menu when a nav item is selected (mobile)
    primaryNav.addEventListener('click', (e) => {
      if (e.target && e.target.closest('a')) closeMenu();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!header.contains(e.target)) closeMenu();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });

    // If the viewport is resized back to desktop, ensure the dropdown is closed
    window.addEventListener(
      'resize',
      debounce(() => {
        try {
          if (window.matchMedia('(min-width: 701px)').matches) closeMenu();
        } catch {
          // ignore
        }
      }, 160),
      { passive: true }
    );
  }

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
  // ---------------------------------------------------------------------------
  // 4) Hero slider (home): manual only + single left arrow + swipe
  // ---------------------------------------------------------------------------
  const hero = document.querySelector('#hero');
  if (hero && hero.dataset && hero.dataset.slides) {
    try {
      const slides = JSON.parse(hero.dataset.slides);
      if (Array.isArray(slides) && slides.length > 1) {
        const headingEl = hero.querySelector('.hero-heading');
        const subtitleEl = hero.querySelector('.hero-subtitle');
        const nextBtn = hero.querySelector('[data-hero-next]');

        const wingsIndexRaw = slides.findIndex((s) => s && s.wings);
        const wingsIndex = wingsIndexRaw >= 0 ? wingsIndexRaw : 0;

        let current = wingsIndex;
        let interacted = false;

        let startX = null;
        let startY = null;

        const applySlide = () => {
          const slide = slides[current] || {};
          if (slide.image) {
            const imgUrl = `url('${slide.image}')`;
            hero.style.backgroundImage = imgUrl;
            // Expose the current slide image to CSS (for contain + blurred backdrop)
            hero.style.setProperty('--hero-bg-image', imgUrl);
          }
          hero.classList.toggle('hero-fit-contain', slide.fit === 'contain');
          hero.classList.toggle('hero-ambition', !!slide.wings);
          if (headingEl) headingEl.textContent = slide.title || '';
          if (subtitleEl) subtitleEl.textContent = slide.subtitle || '';
        };

        const goNext = () => {
          interacted = true;
          if (nextBtn) nextBtn.classList.remove('is-attn');
          current = (current + 1) % slides.length;
          applySlide();
        };

        applySlide();

        // Attention pulse after ~8s on the wings slide (if user didn't interact).
        window.setTimeout(() => {
          if (!nextBtn) return;
          if (interacted) return;
          if (current !== wingsIndex) return;
          nextBtn.classList.add('is-attn');
        }, 8000);

        if (nextBtn) {
          nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            goNext();
          });
        }

        // Swipe support (mobile/tablet)
        hero.addEventListener('pointerdown', (e) => {
          // Ignore swipe if user starts on a link/button inside hero.
          const interactive = e.target && e.target.closest('a, button');
          if (interactive) return;
          startX = e.clientX;
          startY = e.clientY;
        });

        hero.addEventListener('pointerup', (e) => {
          if (startX == null || startY == null) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          startX = null;
          startY = null;

          // Only treat as swipe if horizontal intent is clear.
          if (Math.abs(dx) < 45) return;
          if (Math.abs(dy) > 60) return;

          goNext();
        });

        hero.addEventListener('pointercancel', () => {
          startX = null;
          startY = null;
        });
      }
    } catch {
      // Fail silently in production.
    }
  }


  // ---------------------------------------------------------------------------
  // 5) Contact form feedback (static site placeholder)
  // ---------------------------------------------------------------------------
  const contactForms = document.querySelectorAll('.contact-form');
  if (contactForms && contactForms.length) {
    const lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    const isArabic = lang.startsWith('ar');

    const getSuccessMessage = () =>
      isArabic
        ? 'شكرًا لك! تم استلام رسالتك وسنقوم بالتواصل معك قريبًا.'
        : 'Thank you! Your message has been received. We will contact you soon.';

    const getFieldLabel = (form, input) => {
      const id = input && input.id;
      if (!id) return '';
      const label = form.querySelector(`label[for="${id}"]`);
      const raw = (label ? label.textContent : '').replace(/\*/g, '').trim();
      return raw || (input.name || 'This field');
    };

    const ensureStatusEl = (form) => {
      let el = form.querySelector('.form-status');
      if (!el) {
        el = document.createElement('div');
        el.className = 'form-status';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        form.appendChild(el);
      }
      return el;
    };

    const ensureErrorEl = (input) => {
      let el = input && input.nextElementSibling;
      if (el && el.classList && el.classList.contains('contact-field-error')) return el;
      el = document.createElement('p');
      el.className = 'reserve-field-error contact-field-error';
      el.setAttribute('role', 'alert');
      el.hidden = true;
      input.insertAdjacentElement('afterend', el);
      return el;
    };

    const setInputError = (form, input, message) => {
      const err = ensureErrorEl(input);
      if (!message) {
        err.textContent = '';
        err.hidden = true;
        input.classList.remove('is-invalid');
        return;
      }
      err.textContent = message;
      err.hidden = false;
      input.classList.add('is-invalid');
    };

    contactForms.forEach((form) => {
      const inputs = Array.from(form.querySelectorAll('input[required], textarea[required], select[required]'));

      inputs.forEach((input) => {
        const clear = () => setInputError(form, input, '');
        input.addEventListener('input', clear);
        input.addEventListener('change', clear);
        input.addEventListener('blur', clear);
      });

      form.addEventListener('submit', (event) => {
        event.preventDefault();

        // Clear previous
        inputs.forEach((input) => setInputError(form, input, ''));

        let firstInvalid = null;

        inputs.forEach((input) => {
          const value = String(input.value || '').trim();
          const label = getFieldLabel(form, input);

          // Required
          if (!value) {
            const msg = isArabic ? `${label} مطلوب.` : `${label} is required.`;
            setInputError(form, input, msg);
            if (!firstInvalid) firstInvalid = input;
            return;
          }

          // Format checks
          if (input.type === 'email' && !input.checkValidity()) {
            const msg = isArabic ? 'البريد الإلكتروني غير صحيح.' : 'Email address is invalid.';
            setInputError(form, input, msg);
            if (!firstInvalid) firstInvalid = input;
          }
        });

        if (firstInvalid) {
          firstInvalid.focus();
          return;
        }

        const statusEl = ensureStatusEl(form);
        statusEl.textContent = getSuccessMessage();
        statusEl.classList.add('is-success');

        trackConversion('contact_submit', { lang: isArabic ? 'ar' : 'en', page: String(window.location.pathname || '') });

        form.reset();
      });
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
    // ---------------------------------------------------------------------------
  // 6a) Leen Elite VIP popup (EN/AR) – home only + premium minimal (2-line)
  // ---------------------------------------------------------------------------
  const initNewsletterPopup = () => {
    // Home only (English + Arabic):
    // - /en/index.html  (or /en/)
    // - /ar/index.html  (or /ar/)
    const pathname = (() => {
      try {
        return String((window.location && window.location.pathname) || '')
          .replace(/\\/g, '/')
          .toLowerCase();
      } catch {
        return '';
      }
    })();

    const isHome = /\/(en|ar)(\/index\.html)?\/?$/.test(pathname);
    if (!isHome) return;

    const lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    const isArabic = lang.startsWith('ar');

    const copy = isArabic
      ? {
          title: 'قائمة لين إليت الحصرية',
          subtitle: 'دعوات حصرية وتحديثات مختارة لأبرز فعالياتنا ومعارضنا.',
          placeholder: 'اكتب بريدك الإلكتروني',
          button: 'انضم الآن',
          success: 'تم الاشتراك بنجاح ✅',
          invalid: 'يرجى إدخال بريد إلكتروني صحيح.',
          failed: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
          closeLabel: 'إغلاق'
        }
      : {
          title: 'Leen Elite VIP List',
          subtitle: 'Exclusive invites & curated updates for our top events and exhibitions.',
          placeholder: 'Enter your email',
          button: 'Join Now',
          success: 'Subscribed successfully ✅',
          invalid: 'Please enter a valid email address.',
          failed: 'Something went wrong. Please try again.',
          closeLabel: 'Close'
        };

    const isMobile = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 680px)').matches;

    const modal = document.createElement('div');
    modal.className = `nl-modal${isMobile ? ' is-mobile' : ''}`;
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div class="nl-backdrop" data-nl-close></div>
      <div class="nl-card" role="dialog" aria-modal="true" aria-labelledby="nlTitle">
        <button class="nl-close" type="button" aria-label="${copy.closeLabel}" data-nl-close>×</button>
        <h3 class="nl-title" id="nlTitle">${copy.title}</h3>
        <p class="nl-subtitle">${copy.subtitle}</p>

        <form class="nl-form" novalidate>
          <label class="nl-field">
            <span class="nl-sr">${copy.placeholder}</span>
            <input class="nl-input" type="email" name="email" placeholder="${copy.placeholder}" autocomplete="email" inputmode="email" required />
          </label>
          <button class="nl-submit" type="submit">${copy.button}</button>
        </form>

        <p class="nl-error" role="alert" hidden></p>
        <p class="nl-success" role="status" aria-live="polite" hidden></p>
      </div>
    `;

    document.body.appendChild(modal);

    const card = modal.querySelector('.nl-card');
    const form = modal.querySelector('.nl-form');
    const input = modal.querySelector('.nl-input');
    const submitBtn = modal.querySelector('.nl-submit');
    const errorEl = modal.querySelector('.nl-error');
    const successEl = modal.querySelector('.nl-success');

    const showError = (msg) => {
      if (!errorEl) return;
      errorEl.textContent = msg;
      errorEl.hidden = false;
    };

    const clearError = () => {
      if (!errorEl) return;
      errorEl.textContent = '';
      errorEl.hidden = true;
    };

    const showSuccess = (msg) => {
      if (!successEl) return;
      successEl.textContent = msg;
      successEl.hidden = false;
    };

    const open = () => {
      if (modal.classList.contains('is-open')) return;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');

      // Lock scroll on desktop modal only.
      if (!isMobile) document.body.classList.add('nl-lock');

      window.setTimeout(() => {
        try {
          input && input.focus && input.focus();
        } catch {
          // ignore
        }
      }, 50);
    };

    const close = () => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('nl-lock');
    };

    modal.querySelectorAll('[data-nl-close]').forEach((btn) => {
      btn.addEventListener('click', close);
    });

    window.addEventListener('keydown', (e) => {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
    });

    // Show logic: open after 5 seconds (home only)
    let opened = false;
    const openOnce = () => {
      if (opened) return;
      opened = true;
      open();
    };

    window.setTimeout(openOnce, 5000);

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearError();

        const email = (input && input.value ? input.value.trim() : '').toLowerCase();

        // Basic validation
        const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
        if (!valid) {
          showError(copy.invalid);
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.classList.add('is-loading');
        }

        const isVercelDemo =
          typeof window.location === 'object' &&
          (String(window.location.hostname || '').includes('vercel.app') ||
            String(window.location.hostname || '') === 'localhost' ||
            String(window.location.hostname || '') === '127.0.0.1');

        const endpoint = isVercelDemo ? '/api/subscribe' : '/subscribe.php';

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              lang: isArabic ? 'ar' : 'en',
              page: String(window.location.pathname || '')
            })
          });

          if (!res.ok) throw new Error('request_failed');

          // Success UI
          if (form) form.style.display = 'none';
          showSuccess(copy.success);

          trackConversion('newsletter_subscribe', { lang: isArabic ? 'ar' : 'en', page: String(window.location.pathname || ''), email });
        } catch {
          showError(copy.failed);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('is-loading');
          }
        }
      });
    }

    // If user clicks the card itself (not inputs/buttons), don't close.
    if (card) {
      card.addEventListener('click', (e) => e.stopPropagation());
    }
  };

  initNewsletterPopup();


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

    const isTablet = typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 768px) and (max-width: 1024px)').matches;

    const logos = Array.from({ length: count }, (_, i) => {
      const n = String(i + 1).padStart(2, '0');
      return { src: `../images/clients/client-${n}.png`, alt: `Client logo ${i + 1}` };
    });

    const rows = Array.from(root.querySelectorAll('.clients-marquee-row'));
    if (!rows.length) return;

    if (isTablet) root.classList.add('clients-marquee--snap');

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
      const sequence = (prefersReducedMotion || isTablet) ? items : items.concat(items);

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

      // If reduced motion or tablet: allow horizontal scroll and keep content single-sequence.
      if (prefersReducedMotion || isTablet) {
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

/* -----------------------------------------------------------------------------
   Reserve Space (Demo) – Modal + Placeholder Form (no backend)
----------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('reserveModal');
  const openButtons = document.querySelectorAll('[data-open-reserve-modal]');
  if (!modal || !openButtons.length) return;

  const closeButtons = modal.querySelectorAll('[data-close-reserve-modal]');
  const form = modal.querySelector('#reserveForm');
  const hint = modal.querySelector('#reserveHint');
  const privacy = modal.querySelector('#reservePrivacy');
  const error = modal.querySelector('#reserveError');

  // Phone field (supports both legacy single input and split country+local inputs)
  const phoneCountry = modal.querySelector('input[name="phone_country"]');
  const countryDD = modal.querySelector('[data-country-dd]');
  const countryBtn = modal.querySelector('[data-country-btn]');
  const countryList = modal.querySelector('[data-country-list]');
  const phoneLocal = modal.querySelector('input[name="phone_local"]');
  const phoneFull = modal.querySelector('input[name="phone"]');
  const phoneCombo = modal.querySelector('[data-phone-combo]');

  const crInput = modal.querySelector('input[name="cr"]');
  const vatInput = modal.querySelector('input[name="vat"]');
  const sizeInput = modal.querySelector('input[name="size"]');
  const crError = modal.querySelector('[data-error-for="cr"]');
  const isArabic = (document.documentElement.lang || '').toLowerCase().startsWith('ar');
  const CR_RULE = /^[127]\d{9}$/;

  // Field labels for consistent inline messages
  const fieldLabels = {
    full_name: isArabic ? 'الاسم الكامل' : 'Full Name',
    company: isArabic ? 'اسم الشركة' : 'Company Name',
    email: isArabic ? 'البريد الإلكتروني' : 'Email',
    phone: isArabic ? 'رقم الجوال' : 'Phone',
    city: isArabic ? 'المدينة' : 'City',
    vat: isArabic ? 'الرقم الضريبي' : 'VAT Number',
    size: isArabic ? 'حجم المساحة' : 'Space Size',
    type: isArabic ? 'نوع المشاركة' : 'Participation Type',
    category: isArabic ? 'فئة المساحة' : 'Space Category'
  };

  const getLabel = (name) => fieldLabels[name] || name;

  const setFieldError = (name, message, targetEl) => {
    const el = modal.querySelector(`[data-error-for="${name}"]`);
    if (el) {
      el.textContent = message || '';
      el.hidden = !message;
    }
    if (targetEl) {
      if (message) targetEl.classList.add('is-invalid');
      else targetEl.classList.remove('is-invalid');
    }
  };

  const clearReserveErrors = () => {
    modal.querySelectorAll('.reserve-field-error').forEach((p) => {
      p.textContent = '';
      p.hidden = true;
    });
    modal.querySelectorAll('.reserve-form input.is-invalid, .reserve-form select.is-invalid, .reserve-form textarea.is-invalid').forEach((el) => {
      el.classList.remove('is-invalid');
    });
    modal.querySelectorAll('.reserve-options.is-invalid, .reserve-category.is-invalid').forEach((el) => {
      el.classList.remove('is-invalid');
    });

    modal.querySelectorAll('.phone-combo.is-invalid').forEach((el) => {
      el.classList.remove('is-invalid');
    });
  };

  const normalizeDigits = (value) => {
    // Convert Arabic-Indic and Eastern Arabic-Indic digits to Latin digits
    const map = {
      '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
      '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
    };
    return String(value || '').replace(/[٠-٩۰-۹]/g, (d) => map[d] || d);
  };

    // ---------------------------------------------------------------------------
  // Country code dropdown (Phone) – custom dropdown with FLAG IMAGES
  // ---------------------------------------------------------------------------
  // Native <select> dropdowns are rendered by the OS and are difficult to theme
  // (often showing a white list). Also, coloured flag emoji are not guaranteed
  // across all devices. To guarantee consistent UI + coloured flags, we render
  // our own dropdown list and use SVG flag images.
  const flagUrl = (iso) => `https://flagcdn.com/${String(iso || '').toLowerCase()}.svg`;

  const COUNTRY_CODES = [
    { iso: 'SA', dial: '+966', nameAr: 'السعودية', nameEn: 'Saudi Arabia' },
    { iso: 'AE', dial: '+971', nameAr: 'الإمارات', nameEn: 'United Arab Emirates' },
    { iso: 'KW', dial: '+965', nameAr: 'الكويت', nameEn: 'Kuwait' },
    { iso: 'QA', dial: '+974', nameAr: 'قطر', nameEn: 'Qatar' },
    { iso: 'BH', dial: '+973', nameAr: 'البحرين', nameEn: 'Bahrain' },
    { iso: 'OM', dial: '+968', nameAr: 'عُمان', nameEn: 'Oman' },
    { iso: 'EG', dial: '+20',  nameAr: 'مصر', nameEn: 'Egypt' },
    { iso: 'JO', dial: '+962', nameAr: 'الأردن', nameEn: 'Jordan' },
    { iso: 'LB', dial: '+961', nameAr: 'لبنان', nameEn: 'Lebanon' },
    { iso: 'IQ', dial: '+964', nameAr: 'العراق', nameEn: 'Iraq' },
    { iso: 'MA', dial: '+212', nameAr: 'المغرب', nameEn: 'Morocco' },
    { iso: 'TR', dial: '+90',  nameAr: 'تركيا', nameEn: 'Türkiye' },
    { iso: 'US', dial: '+1',   nameAr: 'الولايات المتحدة', nameEn: 'United States' },
    { iso: 'GB', dial: '+44',  nameAr: 'المملكة المتحدة', nameEn: 'United Kingdom' }
  ];

  const placeholderText = isArabic ? 'اختر الكود' : 'Select code';

  const closeCountryDD = () => {
    if (!countryDD) return;
    countryDD.classList.remove('is-open');
    if (countryBtn) countryBtn.setAttribute('aria-expanded', 'false');
  };

  const openCountryDD = () => {
    if (!countryDD) return;
    countryDD.classList.add('is-open');
    if (countryBtn) countryBtn.setAttribute('aria-expanded', 'true');
  };

  const setCountryUI = (country) => {
    if (!countryBtn) return;
    const flagWrap = countryBtn.querySelector('.country-dd__flag');
    const labelEl = countryBtn.querySelector('.country-dd__label');

    if (!country) {
      if (flagWrap) flagWrap.innerHTML = '';
      if (labelEl) labelEl.textContent = placeholderText;
      countryBtn.removeAttribute('data-iso');
      return;
    }

    if (flagWrap) {
      flagWrap.innerHTML = '';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = country.iso;
      img.src = flagUrl(country.iso);
      flagWrap.appendChild(img);
    }
    if (labelEl) labelEl.textContent = country.dial;
    countryBtn.setAttribute('data-iso', country.iso);
  };

  const setCountryValue = (dial, iso) => {
    if (!phoneCountry) return;
    const match = COUNTRY_CODES.find((c) => c.dial === dial || c.iso === iso);
    phoneCountry.value = match ? match.dial : '';
    setCountryUI(match || null);

    // Notify form logic (update full phone, clear errors)
    try {
      phoneCountry.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}

    // Mark selected option for accessibility
    if (countryList) {
      countryList.querySelectorAll('[role="option"]').forEach((opt) => {
        const isSel = opt.getAttribute('data-value') === (match ? match.dial : '');
        opt.setAttribute('aria-selected', isSel ? 'true' : 'false');
      });
    }
  };

  const buildCountryList = () => {
    if (!countryList) return;
    countryList.innerHTML = '';
    COUNTRY_CODES.forEach((c) => {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'country-dd__option';
      opt.setAttribute('role', 'option');
      opt.setAttribute('data-value', c.dial);
      opt.setAttribute('aria-selected', 'false');

      const flag = document.createElement('span');
      flag.className = 'opt-flag';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = isArabic ? c.nameAr : c.nameEn;
      img.src = flagUrl(c.iso);
      flag.appendChild(img);

      const name = document.createElement('span');
      name.className = 'opt-name';
      name.textContent = isArabic ? c.nameAr : c.nameEn;

      const dialEl = document.createElement('span');
      dialEl.className = 'opt-dial';
      dialEl.textContent = c.dial;

      opt.appendChild(flag);
      opt.appendChild(name);
      opt.appendChild(dialEl);

      opt.addEventListener('click', () => {
        setCountryValue(c.dial, c.iso);
        closeCountryDD();
      });

      countryList.appendChild(opt);
    });
  };

  const initCountryDropdown = () => {
    if (!countryDD || !countryBtn || !phoneCountry) return;

    buildCountryList();

    // Init placeholder UI (or keep an existing value if any)
    const current = String(phoneCountry.value || '').trim();
    if (current) setCountryValue(current);
    else setCountryUI(null);

    countryBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (countryDD.classList.contains('is-open')) closeCountryDD();
      else openCountryDD();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!countryDD.classList.contains('is-open')) return;
      if (countryDD.contains(e.target)) return;
      closeCountryDD();
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeCountryDD();
    });
  };

  const resetCountryDropdown = () => {
    if (phoneCountry) phoneCountry.value = '';
    if (countryDD) countryDD.classList.remove('is-open');
    if (countryBtn) countryBtn.setAttribute('aria-expanded', 'false');
    setCountryUI(null);
    if (countryDD) countryDD.classList.remove('is-invalid');
    if (countryBtn) countryBtn.classList.remove('is-invalid');
  };

  const setCrError = (message) => {
    if (!crError) return;
    if (!message) {
      crError.hidden = true;
      crError.textContent = '';
      if (crInput) crInput.classList.remove('is-invalid');
      return;
    }
    crError.textContent = message;
    crError.hidden = false;
    if (crInput) crInput.classList.add('is-invalid');
  };

  const sanitizeCRInput = () => {
    if (!crInput) return;

    const raw = normalizeDigits(crInput.value);
    let digitsOnly = raw.replace(/\D/g, '');

    // Reject any value that doesn't start with 1/2/7
    while (digitsOnly.length && !/^[127]/.test(digitsOnly)) {
      digitsOnly = digitsOnly.slice(1);
    }

    // Limit to 10 digits
    if (digitsOnly.length > 10) digitsOnly = digitsOnly.slice(0, 10);

    if (digitsOnly !== crInput.value) crInput.value = digitsOnly;
  };

  const validateCR = (showMessage = true) => {
    if (!crInput) return true;

    sanitizeCRInput();

    const value = normalizeDigits(crInput.value).replace(/\D/g, '');
    const messages = {
      required: isArabic ? 'السجل التجاري مطلوب.' : 'Commercial Registration is required.',
      length: isArabic ? 'السجل التجاري يجب أن يتكون من 10 أرقام.' : 'Commercial Registration must be exactly 10 digits.',
      start: isArabic ? 'يجب أن يبدأ السجل التجاري بـ 1 أو 2 أو 7.' : 'Commercial Registration must start with 1, 2, or 7.',
      invalid: isArabic ? 'صيغة السجل التجاري غير صحيحة.' : 'Commercial Registration format is invalid.'
    };

    if (!value) {
      if (showMessage) setCrError(messages.required);
      return false;
    }

    if (value.length !== 10) {
      if (showMessage) setCrError(messages.length);
      return false;
    }

    if (!/^[127]/.test(value)) {
      if (showMessage) setCrError(messages.start);
      return false;
    }

    if (!CR_RULE.test(value)) {
      if (showMessage) setCrError(messages.invalid);
      return false;
    }

    setCrError('');
    return true;
  };

  if (crInput) {
    crInput.addEventListener('input', () => {
      const before = crInput.value;
      sanitizeCRInput();

      // If the user attempted an invalid character/start, show a clear warning.
      if (crInput.value !== before) {
        const msg = isArabic ? 'يُسمح بـ 10 أرقام فقط ويجب أن يبدأ بـ 1 أو 2 أو 7.' : 'Only 10 digits are allowed and it must start with 1, 2, or 7.';
        setCrError(msg);
      } else if (crError && !crError.hidden) {
        validateCR(true);
      }
    });

    crInput.addEventListener('blur', () => validateCR(true));
  }


  const openModal = () => {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    const focusTarget = modal.querySelector('.reserve-form input, .reserve-form select, .reserve-form textarea');
    if (focusTarget) focusTarget.focus();
  };

  const closeModal = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (hint) hint.hidden = true;
    if (error) error.hidden = true;
    if (form) form.reset();
    // Reset the custom country dropdown UI (hidden input is reset by form.reset, UI is not)
    resetCountryDropdown();
    clearReserveErrors();
    setCrError('');
  };

  openButtons.forEach((btn) => btn.addEventListener('click', openModal));
  closeButtons.forEach((btn) => btn.addEventListener('click', closeModal));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  if (privacy) {
    privacy.addEventListener('change', () => {
      if (error) error.hidden = true;
      privacy.classList.remove('is-invalid');
    });
  }

  if (form) {
    // Live-clear inline errors when the user edits fields
    const hasPhoneSplit = !!(form.querySelector('[name="phone_country"]') && form.querySelector('[name="phone_local"]'));
    const simpleFieldNames = hasPhoneSplit
      ? ['full_name', 'company', 'email', 'city']
      : ['full_name', 'company', 'email', 'phone', 'city'];
    simpleFieldNames.forEach((name) => {
      const input = form.querySelector(`[name="${name}"]`);
      if (!input) return;
      const clear = () => setFieldError(name, '', input);
      input.addEventListener('input', clear);
      input.addEventListener('change', clear);
    });

    const updatePhoneFull = () => {
      if (!hasPhoneSplit || !phoneFull) return;
      const cc = String(phoneCountry?.value || '').trim();
      const local = normalizeDigits(phoneLocal?.value || '').trim();
      phoneFull.value = cc && local ? `${cc} ${local}`.trim() : '';
    };

    const sanitizeDigitsOnly = (el, maxLen) => {
      if (!el) return;
      const raw = normalizeDigits(el.value);
      let digits = String(raw || '').replace(/\D/g, '');
      if (typeof maxLen === 'number' && maxLen > 0 && digits.length > maxLen) digits = digits.slice(0, maxLen);
      if (digits !== el.value) el.value = digits;
    };

    const validateVAT = (showMessage = true) => {
      if (!vatInput) return true;
      sanitizeDigitsOnly(vatInput, 15);
      const value = String(vatInput.value || '').trim();
      const msgRequired = isArabic ? 'الرقم الضريبي مطلوب.' : 'VAT number is required.';
      const msgInvalid = isArabic ? 'الرقم الضريبي يجب أن يتكون من 15 رقمًا.' : 'VAT number must be 15 digits.';
      if (!value) {
        if (showMessage) setFieldError('vat', msgRequired, vatInput);
        return false;
      }
      if (!/^\d{15}$/.test(value)) {
        if (showMessage) setFieldError('vat', msgInvalid, vatInput);
        return false;
      }
      setFieldError('vat', '', vatInput);
      return true;
    };

    const validateSize = (showMessage = true) => {
      if (!sizeInput) return true;
      const raw = String(sizeInput.value || '').trim();
      const msgRequired = isArabic ? 'حجم المساحة مطلوب.' : 'Space size is required.';
      const msgInvalid = isArabic ? 'يرجى إدخال رقم أكبر من 0.' : 'Please enter a number greater than 0.';
      if (!raw) {
        if (showMessage) setFieldError('size', msgRequired, sizeInput);
        return false;
      }
      const num = Number(raw);
      if (!Number.isFinite(num) || num <= 0) {
        if (showMessage) setFieldError('size', msgInvalid, sizeInput);
        return false;
      }
      setFieldError('size', '', sizeInput);
      return true;
    };

    const validatePhoneLocal = (showMessage = true) => {
      if (!hasPhoneSplit) return true;
      if (!phoneCountry || !phoneLocal) return true;

      sanitizeDigitsOnly(phoneLocal, 14);
      const cc = String(phoneCountry.value || '').trim();
      const local = String(phoneLocal.value || '').trim();

      const msgRequired = isArabic ? 'رقم الجوال مطلوب.' : 'Phone is required.';
      const msgInvalid = isArabic ? 'يرجى إدخال رقم جوال صحيح.' : 'Please enter a valid phone number.';

      if (!cc || !local) {
        if (showMessage) {
          if (!cc) {
            if (countryDD) countryDD.classList.add('is-invalid');
            if (countryBtn) countryBtn.classList.add('is-invalid');
          }
          if (!local) phoneLocal.classList.add('is-invalid');
          if (phoneCombo) phoneCombo.classList.add('is-invalid');
          setFieldError('phone', msgRequired, phoneCombo || phoneLocal || countryBtn || countryDD);
        }
        return false;
      }

      // Basic numeric length check (most countries: 6-14 digits for national number)
      if (!/^\d{6,14}$/.test(local)) {
        if (showMessage) {
          phoneLocal.classList.add('is-invalid');
          if (phoneCombo) phoneCombo.classList.add('is-invalid');
          setFieldError('phone', msgInvalid, phoneCombo || phoneLocal);
        }
        return false;
      }

      // Optional KSA heuristic: mobile starts with 5 and 9 digits (5XXXXXXXX)
      if (cc === '+966' && !/^5\d{8}$/.test(local)) {
        if (showMessage) {
          phoneLocal.classList.add('is-invalid');
          if (phoneCombo) phoneCombo.classList.add('is-invalid');
          setFieldError('phone', msgInvalid, phoneCombo || phoneLocal);
        }
        return false;
      }

      clearPhoneError();
      updatePhoneFull();
      return true;
    };



    const clearPhoneError = () => {
      if (!hasPhoneSplit) return;
      if (countryDD) countryDD.classList.remove('is-invalid');
      if (countryBtn) countryBtn.classList.remove('is-invalid');
      if (phoneLocal) phoneLocal.classList.remove('is-invalid');
      if (phoneCombo) phoneCombo.classList.remove('is-invalid');
      setFieldError('phone', '', phoneCombo || phoneLocal || phoneCountry);
    };

    if (hasPhoneSplit) {
      initCountryDropdown();
      updatePhoneFull();
      if (phoneCountry) {
        phoneCountry.addEventListener('change', () => {
          updatePhoneFull();
          clearPhoneError();
        });
      }
      if (phoneLocal) {
        phoneLocal.addEventListener('input', () => {
          sanitizeDigitsOnly(phoneLocal, 14);
          updatePhoneFull();
          clearPhoneError();
        });
        phoneLocal.addEventListener('change', () => {
          sanitizeDigitsOnly(phoneLocal, 14);
          updatePhoneFull();
          clearPhoneError();
        });
      }
    }

    // Live sanitize numeric-only fields
    if (vatInput) {
      vatInput.addEventListener('input', () => {
        sanitizeDigitsOnly(vatInput, 15);
        // If an error is visible, re-validate on the fly
        const err = modal.querySelector('[data-error-for="vat"]');
        if (err && !err.hidden) validateVAT(true);
      });
      vatInput.addEventListener('blur', () => validateVAT(true));
    }

    if (sizeInput) {
      sizeInput.addEventListener('input', () => {
        // allow decimals, but keep built-in input; just clear error as the user edits
        const err = modal.querySelector('[data-error-for="size"]');
        if (err && !err.hidden) validateSize(true);
      });
      sizeInput.addEventListener('blur', () => validateSize(true));
    }

    const clearGroupError = (name, containerSelector) => {
      const container = form.querySelector(containerSelector);
      setFieldError(name, '', container);
      if (container) container.classList.remove('is-invalid');
    };

    form.querySelectorAll('input[name="type"]').forEach((el) => el.addEventListener('change', () => clearGroupError('type', '.reserve-options--type')));
    form.querySelectorAll('input[name="category"]').forEach((el) => el.addEventListener('change', () => clearGroupError('category', '.reserve-category')));

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      if (hint) hint.hidden = true;
      if (error) error.hidden = true;
      clearReserveErrors();
      let firstInvalid = null;

      // Validate fields (do NOT stop at the first error; highlight everything)

      // Validate required simple fields (all except notes)
      simpleFieldNames.forEach((name) => {
        const input = form.querySelector(`[name="${name}"]`);
        if (!input) return;
        const value = String(input.value || '').trim();

        if (!value) {
          const msg = isArabic ? `${getLabel(name)} مطلوب.` : `${getLabel(name)} is required.`;
          setFieldError(name, msg, input);
          if (!firstInvalid) firstInvalid = input;
          return;
        }

        if (name === 'email' && !input.checkValidity()) {
          const msg = isArabic ? 'البريد الإلكتروني غير صحيح.' : 'Email address is invalid.';
          setFieldError(name, msg, input);
          if (!firstInvalid) firstInvalid = input;
        }
      });
      // Validate phone
      if (hasPhoneSplit) {
        const ok = validatePhoneLocal(true);
        if (!ok && !firstInvalid) {
          const cc = String(phoneCountry?.value || '').trim();
          firstInvalid = !cc ? (phoneCountry || phoneLocal) : (phoneLocal || phoneCountry);
        }
      }

      // Validate Commercial Registration (CR)
      const crOk = validateCR(true);
      if (!crOk && !firstInvalid && crInput) firstInvalid = crInput;

      // Validate VAT format (15 digits)
      const vatOk = validateVAT(true);
      if (!vatOk && !firstInvalid && vatInput) firstInvalid = vatInput;

      // Validate size (> 0)
      const sizeOk = validateSize(true);
      if (!sizeOk && !firstInvalid && sizeInput) firstInvalid = sizeInput;

      // Legacy single phone field format (if present)
      if (!hasPhoneSplit) {
        const legacy = form.querySelector('input[name="phone"]');
        if (legacy) {
          const val = normalizeDigits(String(legacy.value || '')).replace(/\s+/g, '');
          if (val && !/^\+?\d{6,16}$/.test(val)) {
            const msg = isArabic ? 'يرجى إدخال رقم جوال صحيح.' : 'Please enter a valid phone number.';
            setFieldError('phone', msg, legacy);
            if (!firstInvalid) firstInvalid = legacy;
          }
        }
      }

      // Validate radio groups (defensive)
      const validateRadioGroup = (name, containerSelector) => {
        const radios = Array.from(form.querySelectorAll(`input[name="${name}"]`));
        if (!radios.length) return;
        const ok = radios.some((r) => r.checked);
        if (ok) {
          clearGroupError(name, containerSelector);
          return;
        }
        const container = form.querySelector(containerSelector);
        if (container) container.classList.add('is-invalid');
        const msg = isArabic ? `${getLabel(name)} مطلوب.` : `${getLabel(name)} is required.`;
        setFieldError(name, msg, container);
        if (!firstInvalid) firstInvalid = radios[0];
      };

      validateRadioGroup('type', '.reserve-options--type');
      validateRadioGroup('category', '.reserve-category');

      // Require privacy consent (demo logic)
      if (privacy && !privacy.checked) {
        if (error) error.hidden = false;
        privacy.classList.add('is-invalid');
        if (!firstInvalid) firstInvalid = privacy;
      }

      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      if (hint) hint.hidden = false;
    });
  }


  // ---------------------------------------------------------------------------
  // Click tracking placeholders (phone / WhatsApp)
  // ---------------------------------------------------------------------------
  document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
    link.addEventListener('click', () => {
      trackConversion('phone_click', { href: link.getAttribute('href'), page: String(window.location.pathname || '') });
    });
  });

  document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp"]').forEach((link) => {
    link.addEventListener('click', () => {
      trackConversion('whatsapp_click', { href: link.getAttribute('href'), page: String(window.location.pathname || '') });
    });
  });

});
