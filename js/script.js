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

/* -----------------------------------------------------------------------------
   Visual viewport height helper (mobile keyboard + address bar safe)
   Sets CSS var: --vvh = 1% of the visual viewport height in px.
----------------------------------------------------------------------------- */
(() => {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const root = document.documentElement;
    const set = () => {
      const h = (window.visualViewport && window.visualViewport.height) ? window.visualViewport.height : window.innerHeight;
      if (!h || !root) return;
      root.style.setProperty('--vvh', `${h * 0.01}px`);
    };
    const onResize = () => window.requestAnimationFrame(set);
    set();
    window.addEventListener('resize', onResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onResize, { passive: true });
      window.visualViewport.addEventListener('scroll', onResize, { passive: true });
    }
  } catch {
    // ignore
  }
})();


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

  // Simple environment check (local file preview vs deployed)
  const isLocalPreview = () => {
    try {
      const host = String(window.location.hostname || '');
      const proto = String(window.location.protocol || '');
      return proto === 'file:' || host === 'localhost' || host === '127.0.0.1';
    } catch {
      return true;
    }
  };

  const postJson = async (url, payload) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    return { ok: !!(data && data.ok), status: res.status, data };
  };

  // Expose helpers for other modules on this page
  try {
    window.leeneliteTrackConversion = trackConversion;
    window.leeneliteIsLocalPreview = isLocalPreview;
    window.leenelitePostJson = postJson;
  } catch {
    // ignore
  }

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
  // 4) Hero slider (home): AUTO + smooth crossfade + swipe (no manual arrow)
  // ---------------------------------------------------------------------------
  const hero = document.querySelector('#hero');
  if (hero && hero.dataset && hero.dataset.slides) {
    try {
      const slides = JSON.parse(hero.dataset.slides);
      if (Array.isArray(slides) && slides.length > 0) {
        const headingEl = hero.querySelector('.hero-heading');
        const subtitleEl = hero.querySelector('.hero-subtitle');

        const wingsIndexRaw = slides.findIndex((s) => s && s.wings);
        const wingsIndex = wingsIndexRaw >= 0 ? wingsIndexRaw : 0;

        let current = wingsIndex;

        // Crossfade layers (keeps hero.style.backgroundImage in sync for section blending)
        let layerA = hero.querySelector('.hero-bg-layer.layer-a');
        let layerB = hero.querySelector('.hero-bg-layer.layer-b');
        let activeLayer = null;

        const ensureLayers = () => {
          if (layerA && layerB) return;
          layerA = document.createElement('div');
          layerB = document.createElement('div');
          layerA.className = 'hero-bg-layer layer-a is-active';
          layerB.className = 'hero-bg-layer layer-b';
          // Insert behind existing layers
          hero.insertBefore(layerA, hero.firstChild);
          hero.insertBefore(layerB, hero.firstChild);
          activeLayer = layerA;
        };

        const clampMs = (ms, min = 4000, max = 60000) => {
          const n = Number(ms);
          if (!Number.isFinite(n)) return null;
          return Math.max(min, Math.min(max, n));
        };

        const getSlideDuration = () => {
          const s = slides[current] || {};
          const d = clampMs(s.duration, 4000, 60000);
          // Default: 12s (as requested)
          return d != null ? d : 12000;
        };

        const applySlide = () => {
          const slide = slides[current] || {};
          if (slide.image) {
            const imgUrl = `url('${slide.image}')`;

            // Keep background image on the section itself (used by seamless section blending)
            hero.style.backgroundImage = imgUrl;

            // Expose to CSS (blurred backdrop helper)
            hero.style.setProperty('--hero-bg-image', imgUrl);

            // Crossfade visual layer
            ensureLayers();
            const nextLayer = activeLayer === layerA ? layerB : layerA;
            if (nextLayer) {
              nextLayer.style.backgroundImage = imgUrl;
              nextLayer.classList.add('is-active');
              if (activeLayer && activeLayer !== nextLayer) activeLayer.classList.remove('is-active');
              activeLayer = nextLayer;
            }
          }

          hero.classList.toggle('hero-fit-contain', slide.fit === 'contain');
          hero.classList.toggle('hero-ambition', !!slide.wings);

          if (headingEl) headingEl.textContent = slide.title || '';
          if (subtitleEl) subtitleEl.textContent = slide.subtitle || '';
        };

        let timer = null;
        const scheduleNext = () => {
          if (prefersReducedMotion) return;
          if (timer) window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            current = (current + 1) % slides.length;
            applySlide();
            scheduleNext();
          }, getSlideDuration());
        };

        const goNext = () => {
          if (!slides.length) return;
          current = (current + 1) % slides.length;
          applySlide();
          scheduleNext();
        };

        applySlide();
        scheduleNext();

        // Swipe support (mobile/tablet)
        let startX = null;
        let startY = null;

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
    const dir = (document.documentElement.getAttribute('dir') || '').toLowerCase();
    const isArabic = lang.startsWith('ar') || dir === 'rtl';

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

      form.addEventListener('submit', async (event) => {
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

        // Local preview: keep friendly placeholder without sending
        if (isLocalPreview()) {
          statusEl.textContent = getSuccessMessage();
          statusEl.classList.add('is-success');
          trackConversion('contact_submit', { lang: isArabic ? 'ar' : 'en', page: String(window.location.pathname || ''), mode: 'local' });
          form.reset();
          return;
        }

        // Deployed (SiteGround): send to backend endpoint
        statusEl.textContent = isArabic ? 'جارٍ الإرسال…' : 'Sending…';
        statusEl.classList.remove('is-success');
        statusEl.classList.remove('is-error');

        const payload = {
          name: String(form.querySelector('[name="name"]')?.value || '').trim(),
          email: String(form.querySelector('[name="email"]')?.value || '').trim(),
          phone: String(form.querySelector('[name="phone"]')?.value || '').trim(),
          message: String(form.querySelector('[name="message"]')?.value || '').trim(),
          // Honeypot (must stay empty)
          website: String(form.querySelector('[name="website"]')?.value || '').trim(),
          lang: isArabic ? 'ar' : 'en',
          page: String(window.location.pathname || '')
        };

        try {
          const { ok } = await postJson('/contact.php', payload);
          if (!ok) throw new Error('send_failed');
          statusEl.textContent = getSuccessMessage();
          statusEl.classList.add('is-success');
          trackConversion('contact_submit', { lang: isArabic ? 'ar' : 'en', page: String(window.location.pathname || ''), mode: 'server' });
          form.reset();
        } catch (err) {
          statusEl.textContent = isArabic ? 'حدث خطأ أثناء الإرسال. حاول مرة أخرى.' : 'Something went wrong while sending. Please try again.';
          statusEl.classList.add('is-error');
        }
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
  // 6a) Exhibitor Toolkit popup (EN/AR) – home only, premium compact
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

    const isHome = /(\/)(en|ar)(\/index\.html)?\/?$/.test(pathname);
    if (!isHome) return;

    // Avoid showing too often
    const SEEN_KEY = 'leenelite_newsletter_seen_v1';
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {}

    const lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    const dir = (document.documentElement.getAttribute('dir') || '').toLowerCase();
    const isArabic = lang.startsWith('ar') || dir === 'rtl';

    const isMobile =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 680px)').matches;

    const isVercelDemo =
      typeof window.location === 'object' &&
      (String(window.location.hostname || '').includes('vercel.app') ||
        String(window.location.hostname || '') === 'localhost' ||
        String(window.location.hostname || '') === '127.0.0.1');

    const copy = isArabic
      ? {
          title: 'اشترك ليصلك كل جديد',
          kicker: 'تحديثات • فعاليات • معارض • عروض خاصة',
          subcopy:
            'سجل بريدك الإلكتروني لتصلك أهم الأخبار والتحديثات الخاصة بخدماتنا — بدون رسائل مزعجة.',
          start: 'اشترك الآن',
          placeholder: 'اكتب بريدك الإلكتروني',
          submit: 'تأكيد الاشتراك',
          success: 'تم الاشتراك بنجاح ✅',
          noteProd: 'سيصلك إشعار بأهم التحديثات فور صدورها.',
          noteDemo: 'ملاحظة: إرسال البريد مفعل على نسخة الاستضافة الرسمية.',
          invalid: 'يرجى إدخال بريد إلكتروني صحيح.',
          failed: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
          closeLabel: 'إغلاق'
        }
      : {
          title: 'Stay in the loop',
          kicker: 'Updates • Events • Exhibitions • Offers',
          subcopy:
            'Subscribe with your email to receive important news and updates about our services—no spam.',
          start: 'Subscribe',
          placeholder: 'Email address',
          submit: 'Confirm subscription',
          success: 'Subscribed successfully ✅',
          noteProd: 'You’ll receive important updates as they happen.',
          noteDemo: 'Note: Email delivery is enabled on the live hosting version.',
          invalid: 'Please enter a valid email address.',
          failed: 'Something went wrong. Please try again.',
          closeLabel: 'Close'
        };

    const deliveryNote = isVercelDemo ? copy.noteDemo : copy.noteProd;

    const modal = document.createElement('div');
    modal.className = `nl-modal${isMobile ? ' is-mobile' : ''}`;
    modal.setAttribute('aria-hidden', 'true');

    const mainHtml = `
      <div class="nl-main">
        <h3 class="nl-title" id="nlTitle">${copy.title}</h3>
        <p class="nl-kicker">${copy.kicker}</p>
        <p class="nl-subcopy">${copy.subcopy}</p>

        <div class="nl-step nl-step-1 is-active">
          <button class="nl-submit nl-start" type="button" data-nl-start>${copy.start}</button>
        </div>

        <div class="nl-step nl-step-2" hidden>
          <form class="nl-form" novalidate>
            <div class="nl-row is-stacked">
              <label class="nl-field">
                <span class="nl-sr">${copy.placeholder}</span>
                <input class="nl-input" type="email" name="email" placeholder="${copy.placeholder}"
                  autocomplete="email" inputmode="email" required>
              </label>
              <button class="nl-submit" type="submit" disabled>${copy.submit}</button>
            </div>
          </form>
        </div>

        <p class="nl-error" role="alert" hidden></p>
        <p class="nl-success" role="status" aria-live="polite" hidden></p>
        <p class="nl-note" hidden></p>
      </div>
    `;

    modal.innerHTML = `
      <div class="nl-backdrop" data-nl-close></div>
      <div class="nl-card" role="dialog" aria-modal="true" aria-labelledby="nlTitle">
        <button class="nl-close" type="button" aria-label="${copy.closeLabel}" data-nl-close>×</button>
        ${mainHtml}
      </div>
    `;

document.body.appendChild(modal);

    const card = modal.querySelector('.nl-card');
    const step1 = modal.querySelector('.nl-step-1');
    const step2 = modal.querySelector('.nl-step-2');
    const startBtn = modal.querySelector('[data-nl-start]');
    const form = modal.querySelector('.nl-form');
    const input = modal.querySelector('.nl-input');
    const submitBtn = form ? form.querySelector('.nl-submit') : null;
    const errorEl = modal.querySelector('.nl-error');
    const successEl = modal.querySelector('.nl-success');
    const noteEl = modal.querySelector('.nl-note');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

    const showNote = (msg) => {
      if (!noteEl) return;
      noteEl.textContent = msg;
      noteEl.hidden = false;
    };

    const clearSuccess = () => {
      if (successEl) {
        successEl.textContent = '';
        successEl.hidden = true;
      }
      if (noteEl) {
        noteEl.textContent = '';
        noteEl.hidden = true;
      }
    };

    const isValidEmail = () => {
      const email = (input && input.value ? String(input.value).trim() : '');
      return emailRegex.test(email);
    };

    const updateCtaState = () => {
      if (!submitBtn) return;
      submitBtn.disabled = !isValidEmail();
    };

    const resetSteps = () => {
      clearError();
      clearSuccess();
      if (form) form.style.display = '';
      if (step1) step1.classList.add('is-active');
      if (step2) {
        step2.hidden = true;
        step2.classList.remove('is-active');
      }
      if (input) input.value = '';
      updateCtaState();
    };

    const goToStep2 = () => {
      clearError();
      clearSuccess();
      if (step1) step1.classList.remove('is-active');
      if (step2) {
        step2.hidden = false;
        step2.classList.add('is-active');
      }
      window.setTimeout(() => {
        try {
          input && input.focus && input.focus();
        } catch {
          // ignore
        }
      }, 40);
      updateCtaState();
    };

    const open = () => {
      if (modal.classList.contains('is-open')) return;
      resetSteps();
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('nl-lock');
    };

    const close = () => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('nl-lock');
      try {
        localStorage.setItem(SEEN_KEY, '1');
      } catch {}
    };

    modal.querySelectorAll('[data-nl-close]').forEach((btn) => btn.addEventListener('click', close));
    window.addEventListener('keydown', (e) => {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
    });

    if (card) card.addEventListener('click', (e) => e.stopPropagation());

    if (startBtn) startBtn.addEventListener('click', goToStep2);

    if (input) input.addEventListener('input', () => {
      clearError();
      updateCtaState();
    });

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearError();
        clearSuccess();

        const email = (input && input.value ? String(input.value).trim().toLowerCase() : '');
        if (!emailRegex.test(email)) {
          showError(copy.invalid);
          updateCtaState();
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.classList.add('is-loading');
        }

        const endpoint = isVercelDemo ? '/api/subscribe' : '/subscribe.php';

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              lang: isArabic ? 'ar' : 'en',
              page: String(window.location.pathname || ''),
              source: 'newsletter_popup'
            })
          });

          if (!res.ok) throw new Error('request_failed');

          showSuccess(copy.success);
          showNote(deliveryNote);

          // Auto close after a short moment
          window.setTimeout(close, 1800);

          if (typeof trackConversion === 'function') {
            trackConversion('newsletter_updates', { lang: isArabic ? 'ar' : 'en', page: String(window.location.pathname || ''), email });
          }
        } catch {
          showError(copy.failed);
          if (submitBtn) submitBtn.disabled = false;
        } finally {
          if (submitBtn) submitBtn.classList.remove('is-loading');
          updateCtaState();
        }
      });
    }

    // Show after a short delay (home only)
    window.setTimeout(open, 5000);
  };;

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

  // Reuse shared helpers (defined earlier in this script)
  const trackConversion = (window && window.leeneliteTrackConversion) ? window.leeneliteTrackConversion : (() => {});
  const isLocalPreview = (window && window.leeneliteIsLocalPreview) ? window.leeneliteIsLocalPreview : (() => true);
  const postJson = (window && window.leenelitePostJson) ? window.leenelitePostJson : (async () => ({ ok: false }));


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
    cr: isArabic ? 'السجل التجاري' : 'Commercial Registration',
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
    { iso: 'SA', dial: '+966' },
    { iso: 'AF', dial: '+93' },
    { iso: 'AL', dial: '+355' },
    { iso: 'DZ', dial: '+213' },
    { iso: 'AS', dial: '+1684' },
    { iso: 'AO', dial: '+244' },
    { iso: 'AI', dial: '+1264' },
    { iso: 'AG', dial: '+1268' },
    { iso: 'AR', dial: '+54' },
    { iso: 'AM', dial: '+374' },
    { iso: 'AW', dial: '+297' },
    { iso: 'AU', dial: '+61' },
    { iso: 'AT', dial: '+43' },
    { iso: 'AZ', dial: '+994' },
    { iso: 'BS', dial: '+1242' },
    { iso: 'BH', dial: '+973' },
    { iso: 'BD', dial: '+880' },
    { iso: 'BB', dial: '+1246' },
    { iso: 'BY', dial: '+375' },
    { iso: 'BE', dial: '+32' },
    { iso: 'BZ', dial: '+501' },
    { iso: 'BJ', dial: '+229' },
    { iso: 'BM', dial: '+1441' },
    { iso: 'BT', dial: '+975' },
    { iso: 'BO', dial: '+591' },
    { iso: 'BA', dial: '+387' },
    { iso: 'BW', dial: '+267' },
    { iso: 'BR', dial: '+55' },
    { iso: 'IO', dial: '+246' },
    { iso: 'BN', dial: '+673' },
    { iso: 'BG', dial: '+359' },
    { iso: 'BF', dial: '+226' },
    { iso: 'BI', dial: '+257' },
    { iso: 'CV', dial: '+238' },
    { iso: 'KH', dial: '+855' },
    { iso: 'CM', dial: '+237' },
    { iso: 'CA', dial: '+1' },
    { iso: 'KY', dial: '+1345' },
    { iso: 'CF', dial: '+236' },
    { iso: 'TD', dial: '+235' },
    { iso: 'CL', dial: '+56' },
    { iso: 'CN', dial: '+86' },
    { iso: 'CX', dial: '+61' },
    { iso: 'CC', dial: '+61' },
    { iso: 'CO', dial: '+57' },
    { iso: 'KM', dial: '+269' },
    { iso: 'CG', dial: '+242' },
    { iso: 'CD', dial: '+243' },
    { iso: 'CK', dial: '+682' },
    { iso: 'CR', dial: '+506' },
    { iso: 'HR', dial: '+385' },
    { iso: 'CU', dial: '+53' },
    { iso: 'CY', dial: '+357' },
    { iso: 'CZ', dial: '+420' },
    { iso: 'CI', dial: '+225' },
    { iso: 'DK', dial: '+45' },
    { iso: 'DJ', dial: '+253' },
    { iso: 'DM', dial: '+1767' },
    { iso: 'DO', dial: '+1809' },
    { iso: 'EC', dial: '+593' },
    { iso: 'EG', dial: '+20' },
    { iso: 'SV', dial: '+503' },
    { iso: 'GQ', dial: '+240' },
    { iso: 'ER', dial: '+291' },
    { iso: 'EE', dial: '+372' },
    { iso: 'SZ', dial: '+268' },
    { iso: 'ET', dial: '+251' },
    { iso: 'FK', dial: '+500' },
    { iso: 'FO', dial: '+298' },
    { iso: 'FJ', dial: '+679' },
    { iso: 'FI', dial: '+358' },
    { iso: 'FR', dial: '+33' },
    { iso: 'GF', dial: '+594' },
    { iso: 'PF', dial: '+689' },
    { iso: 'GA', dial: '+241' },
    { iso: 'GM', dial: '+220' },
    { iso: 'GE', dial: '+995' },
    { iso: 'DE', dial: '+49' },
    { iso: 'GH', dial: '+233' },
    { iso: 'GI', dial: '+350' },
    { iso: 'GR', dial: '+30' },
    { iso: 'GL', dial: '+299' },
    { iso: 'GD', dial: '+1473' },
    { iso: 'GP', dial: '+590' },
    { iso: 'GU', dial: '+1671' },
    { iso: 'GT', dial: '+502' },
    { iso: 'GG', dial: '+44' },
    { iso: 'GN', dial: '+224' },
    { iso: 'GW', dial: '+245' },
    { iso: 'GY', dial: '+592' },
    { iso: 'HT', dial: '+509' },
    { iso: 'HN', dial: '+504' },
    { iso: 'HK', dial: '+852' },
    { iso: 'HU', dial: '+36' },
    { iso: 'IS', dial: '+354' },
    { iso: 'IN', dial: '+91' },
    { iso: 'ID', dial: '+62' },
    { iso: 'IR', dial: '+98' },
    { iso: 'IQ', dial: '+964' },
    { iso: 'IE', dial: '+353' },
    { iso: 'IM', dial: '+44' },
    { iso: 'IT', dial: '+39' },
    { iso: 'JM', dial: '+1876' },
    { iso: 'JP', dial: '+81' },
    { iso: 'JE', dial: '+44' },
    { iso: 'JO', dial: '+962' },
    { iso: 'KZ', dial: '+76' },
    { iso: 'KE', dial: '+254' },
    { iso: 'KI', dial: '+686' },
    { iso: 'KP', dial: '+850' },
    { iso: 'KR', dial: '+82' },
    { iso: 'KW', dial: '+965' },
    { iso: 'KG', dial: '+996' },
    { iso: 'LA', dial: '+856' },
    { iso: 'LV', dial: '+371' },
    { iso: 'LB', dial: '+961' },
    { iso: 'LS', dial: '+266' },
    { iso: 'LR', dial: '+231' },
    { iso: 'LY', dial: '+218' },
    { iso: 'LI', dial: '+423' },
    { iso: 'LT', dial: '+370' },
    { iso: 'LU', dial: '+352' },
    { iso: 'MO', dial: '+853' },
    { iso: 'MG', dial: '+261' },
    { iso: 'MW', dial: '+265' },
    { iso: 'MY', dial: '+60' },
    { iso: 'MV', dial: '+960' },
    { iso: 'ML', dial: '+223' },
    { iso: 'MT', dial: '+356' },
    { iso: 'MH', dial: '+692' },
    { iso: 'MQ', dial: '+596' },
    { iso: 'MR', dial: '+222' },
    { iso: 'MU', dial: '+230' },
    { iso: 'YT', dial: '+262' },
    { iso: 'MX', dial: '+52' },
    { iso: 'FM', dial: '+691' },
    { iso: 'MD', dial: '+373' },
    { iso: 'MC', dial: '+377' },
    { iso: 'MN', dial: '+976' },
    { iso: 'MS', dial: '+1664' },
    { iso: 'MA', dial: '+212' },
    { iso: 'MZ', dial: '+258' },
    { iso: 'NA', dial: '+264' },
    { iso: 'NR', dial: '+674' },
    { iso: 'NP', dial: '+977' },
    { iso: 'NL', dial: '+31' },
    { iso: 'NC', dial: '+687' },
    { iso: 'NZ', dial: '+64' },
    { iso: 'NI', dial: '+505' },
    { iso: 'NE', dial: '+227' },
    { iso: 'NG', dial: '+234' },
    { iso: 'NU', dial: '+683' },
    { iso: 'NF', dial: '+672' },
    { iso: 'MK', dial: '+389' },
    { iso: 'MP', dial: '+1670' },
    { iso: 'NO', dial: '+47' },
    { iso: 'OM', dial: '+968' },
    { iso: 'PK', dial: '+92' },
    { iso: 'PW', dial: '+680' },
    { iso: 'PA', dial: '+507' },
    { iso: 'PG', dial: '+675' },
    { iso: 'PY', dial: '+595' },
    { iso: 'PE', dial: '+51' },
    { iso: 'PH', dial: '+63' },
    { iso: 'PN', dial: '+64' },
    { iso: 'PL', dial: '+48' },
    { iso: 'PT', dial: '+351' },
    { iso: 'PR', dial: '+1787' },
    { iso: 'QA', dial: '+974' },
    { iso: 'RO', dial: '+40' },
    { iso: 'RU', dial: '+7' },
    { iso: 'RW', dial: '+250' },
    { iso: 'RE', dial: '+262' },
    { iso: 'SH', dial: '+290' },
    { iso: 'KN', dial: '+1869' },
    { iso: 'LC', dial: '+1758' },
    { iso: 'PM', dial: '+508' },
    { iso: 'VC', dial: '+1784' },
    { iso: 'WS', dial: '+685' },
    { iso: 'SM', dial: '+378' },
    { iso: 'ST', dial: '+239' },
    { iso: 'SN', dial: '+221' },
    { iso: 'RS', dial: '+381' },
    { iso: 'SC', dial: '+248' },
    { iso: 'SL', dial: '+232' },
    { iso: 'SG', dial: '+65' },
    { iso: 'SK', dial: '+421' },
    { iso: 'SI', dial: '+386' },
    { iso: 'SB', dial: '+677' },
    { iso: 'SO', dial: '+252' },
    { iso: 'ZA', dial: '+27' },
    { iso: 'GS', dial: '+500' },
    { iso: 'SS', dial: '+211' },
    { iso: 'ES', dial: '+34' },
    { iso: 'LK', dial: '+94' },
    { iso: 'SD', dial: '+249' },
    { iso: 'SR', dial: '+597' },
    { iso: 'SJ', dial: '+4779' },
    { iso: 'SE', dial: '+46' },
    { iso: 'CH', dial: '+41' },
    { iso: 'SY', dial: '+963' },
    { iso: 'TW', dial: '+886' },
    { iso: 'TJ', dial: '+992' },
    { iso: 'TZ', dial: '+255' },
    { iso: 'TH', dial: '+66' },
    { iso: 'TL', dial: '+670' },
    { iso: 'TG', dial: '+228' },
    { iso: 'TK', dial: '+690' },
    { iso: 'TO', dial: '+676' },
    { iso: 'TT', dial: '+1868' },
    { iso: 'TN', dial: '+216' },
    { iso: 'TR', dial: '+90' },
    { iso: 'TM', dial: '+993' },
    { iso: 'TV', dial: '+688' },
    { iso: 'UG', dial: '+256' },
    { iso: 'UA', dial: '+380' },
    { iso: 'AE', dial: '+971' },
    { iso: 'GB', dial: '+44' },
    { iso: 'US', dial: '+1' },
    { iso: 'UY', dial: '+598' },
    { iso: 'UZ', dial: '+998' },
    { iso: 'VU', dial: '+678' },
    { iso: 'VE', dial: '+58' },
    { iso: 'VN', dial: '+84' },
    { iso: 'WF', dial: '+681' },
    { iso: 'EH', dial: '+212' },
    { iso: 'YE', dial: '+967' },
    { iso: 'ZM', dial: '+260' },
    { iso: 'ZW', dial: '+263' },
  ];

  const placeholderText = isArabic ? 'اختر الكود' : 'Select code';


  const displayNames =
    typeof Intl !== 'undefined' && Intl.DisplayNames
      ? new Intl.DisplayNames([isArabic ? 'ar' : 'en'], { type: 'region' })
      : null;

  const getCountryName = (iso) => {
    const code = String(iso || '').toUpperCase();
    if (displayNames) {
      try {
        return displayNames.of(code) || code;
      } catch {
        // ignore
      }
    }
    return code;
  };


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
      // Fallback for networks where the flag CDN is slow/blocked.
      img.onerror = () => {
        try {
          flagWrap.innerHTML = `<span class="flag-fallback">${country.iso}</span>`;
        } catch (_) {}
      };
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
      img.alt = getCountryName(c.iso);
      img.src = flagUrl(c.iso);
      img.onerror = () => {
        try {
          flag.innerHTML = `<span class="flag-fallback">${c.iso}</span>`;
        } catch (_) {}
      };
      flag.appendChild(img);

      const name = document.createElement('span');
      name.className = 'opt-name';
      name.textContent = getCountryName(c.iso);

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
    else setCountryValue('+966', 'SA');

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
      // Optional when the selected country is not Saudi Arabia
      if (crInput && !crInput.required) {
        setCrError('');
        return true;
      }
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
        // Optional when the selected country is not Saudi Arabia
        if (vatInput && !vatInput.required) {
          setFieldError('vat', '', vatInput);
          return true;
        }
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

      const setReq = (el, required) => {
        if (!el) return;
        el.required = !!required;
        el.setAttribute('aria-required', required ? 'true' : 'false');
      };

      const toggleReqStars = (selector, on) => {
        modal.querySelectorAll(selector).forEach((el) => {
          el.style.display = on ? '' : 'none';
        });
      };

      const applyKsaRequirements = () => {
        const cc = String(phoneCountry?.value || '').trim();
        const isKsa = cc === '+966';

        // CR + VAT required ONLY for Saudi numbers
        setReq(crInput, isKsa);
        setReq(vatInput, isKsa);

        toggleReqStars('[data-req-cr]', isKsa);
        toggleReqStars('[data-req-vat]', isKsa);

        // If not required, clear visible errors (but still validate if user typed)
        if (!isKsa) {
          setCrError('');
          setFieldError('vat', '', vatInput);
          if (crInput) crInput.classList.remove('is-invalid');
          if (vatInput) vatInput.classList.remove('is-invalid');
        }
      };

      // Initial state (default country is Saudi Arabia)
      applyKsaRequirements();

      if (phoneCountry) {
        phoneCountry.addEventListener('change', () => {
          updatePhoneFull();
          clearPhoneError();
          applyKsaRequirements();
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

    form.addEventListener('submit', async (e) => {
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

      // Local preview: show success UI without sending
      if (isLocalPreview()) {
        if (hint) {
          hint.textContent = isArabic ? 'تم استلام طلبك ✅ (وضع المعاينة المحلية)' : 'Request received ✅ (local preview)';
          hint.hidden = false;
        }
        trackConversion('reserve_submit', { lang: isArabic ? 'ar' : 'en', page: String(window.location.pathname || ''), mode: 'local' });
        try { form.reset(); } catch {}
        return;
      }

      // Deployed (SiteGround): send to backend endpoint
      const submitBtn = form.querySelector('.reserve-submit');
      if (submitBtn) submitBtn.disabled = true;

      const payload = {
        full_name: String(form.querySelector('[name="full_name"]')?.value || '').trim(),
        company: String(form.querySelector('[name="company"]')?.value || '').trim(),
        email: String(form.querySelector('[name="email"]')?.value || '').trim(),
        // Phone: prefer computed full phone if present, else try build from split
        phone: (() => {
          const full = String(form.querySelector('[name="phone"]')?.value || '').trim();
          if (full) return full;
          const cc = String(form.querySelector('[name="phone_country"]')?.value || '').trim();
          const local = String(form.querySelector('[name="phone_local"]')?.value || '').trim();
          return (cc || '') + (local ? ' ' + local : '');
        })(),
        phone_country: String(form.querySelector('[name="phone_country"]')?.value || '').trim(),
        phone_local: String(form.querySelector('[name="phone_local"]')?.value || '').trim(),
        city: String(form.querySelector('[name="city"]')?.value || '').trim(),
        cr: String(form.querySelector('[name="cr"]')?.value || '').trim(),
        vat: String(form.querySelector('[name="vat"]')?.value || '').trim(),
        size: String(form.querySelector('[name="size"]')?.value || '').trim(),
        type: String(form.querySelector('input[name="type"]:checked')?.value || '').trim(),
        category: String(form.querySelector('input[name="category"]:checked')?.value || '').trim(),
        notes: String(form.querySelector('[name="notes"]')?.value || '').trim(),
        privacy_consent: !!(privacy && privacy.checked),
        website: String(form.querySelector('[name="website"]')?.value || '').trim(),
        lang: isArabic ? 'ar' : 'en',
        page: String(window.location.pathname || '')
      };

      try {
        if (hint) {
          hint.textContent = isArabic ? 'جارٍ إرسال الطلب…' : 'Sending request…';
          hint.hidden = false;
        }
        const { ok } = await postJson('/reserve.php', payload);
        if (!ok) throw new Error('send_failed');

        if (hint) {
          hint.textContent = isArabic ? 'تم استلام طلب الحجز بنجاح ✅' : 'Booking request received successfully ✅';
          hint.hidden = false;
        }
        trackConversion('reserve_submit', { lang: isArabic ? 'ar' : 'en', page: String(window.location.pathname || ''), mode: 'server' });
        try { form.reset(); } catch {}
      } catch (err) {
        if (error) {
          error.textContent = isArabic ? 'حدث خطأ أثناء الإرسال. حاول مرة أخرى.' : 'Something went wrong while sending. Please try again.';
          error.hidden = false;
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
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


/* -----------------------------------------------------------------------------
   Brochure PDF Modal (Upcoming Exhibitions)
----------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('brochureModal');
  const openButtons = document.querySelectorAll('[data-open-pdf-modal]');
  if (!modal || !openButtons.length) return;

  const closeTriggers = modal.querySelectorAll('[data-close-pdf-modal]');
  const frame = modal.querySelector('[data-pdf-frame]');
  const titleEl = modal.querySelector('#brochureTitle');
  const downloadEl = modal.querySelector('[data-pdf-download]');
  const fullscreenBtn = modal.querySelector('[data-pdf-fullscreen]');

  const syncBodyModalOpen = () => {
    const anyOpen = !!document.querySelector('.reserve-modal.is-open, .pdf-modal.is-open');
    if (anyOpen) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
  };

  const openModal = (btn) => {
    const src = btn.getAttribute('data-pdf-src') || '';
    const title = btn.getAttribute('data-pdf-title') || '';

    if (titleEl && title) titleEl.textContent = title;
    if (downloadEl && src) downloadEl.setAttribute('href', src);

    // Set iframe src at open-time to avoid unnecessary loads on initial page render
    if (frame) frame.src = src ? `${src}#view=FitH` : '';

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    syncBodyModalOpen();

    const focusTarget = modal.querySelector('[data-close-pdf-modal][aria-label]') || modal.querySelector('[data-close-pdf-modal]');
    if (focusTarget) focusTarget.focus();
  };

  const closeModal = () => {
    modal.classList.remove('is-open');
    modal.classList.remove('is-fullscreen');
    modal.setAttribute('aria-hidden', 'true');

    // Stop PDF rendering when closing (saves CPU on mobile)
    if (frame) frame.src = '';

    // Exit native fullscreen if active
    if (document.fullscreenElement) {
      try { document.exitFullscreen(); } catch (_) {}
    }

    syncBodyModalOpen();
  };

  openButtons.forEach((btn) => btn.addEventListener('click', () => openModal(btn)));
  closeTriggers.forEach((el) => el.addEventListener('click', closeModal));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      const isNowFullscreen = !modal.classList.contains('is-fullscreen');
      modal.classList.toggle('is-fullscreen');

      // Attempt native fullscreen for a more premium feel (falls back to CSS fullscreen)
      const panel = modal.querySelector('.pdf-modal__panel');
      if (isNowFullscreen && panel && panel.requestFullscreen) {
        panel.requestFullscreen().catch(() => {});
      } else if (!isNowFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    });
  }
});
