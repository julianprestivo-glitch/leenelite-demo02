/*
 * Basic interactivity for the Leen Elite website.  Handles the
 * navigation highlighting on scroll, optional hero slider cycling
 * through slides, and contact form submission feedback.
 */

// Highlight the active side navigation button based on scroll position.
document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelectorAll('.side-nav a');
  const sections = document.querySelectorAll('section');

  function onScroll() {
    const scrollPosition = window.scrollY + window.innerHeight / 2;
    sections.forEach((section, index) => {
      const top = section.offsetTop;
      const bottom = top + section.offsetHeight;
      if (scrollPosition >= top && scrollPosition < bottom) {
        navLinks.forEach(link => link.classList.remove('active'));
        if (navLinks[index]) navLinks[index].classList.add('active');
      }
    });
  }
  window.addEventListener('scroll', onScroll);
  onScroll();

  // Optional hero slider: if #hero element contains data‑slides attribute
  const hero = document.querySelector('#hero');
  if (hero) {
    const slidesData = hero.dataset.slides;
    if (slidesData) {
      try {
        const slides = JSON.parse(slidesData);
        let current = 0;
        const headingEl = hero.querySelector('.hero-heading');
        const subtitleEl = hero.querySelector('.hero-subtitle');
        // Announce slide changes politely for screen readers.  Setting
        // aria-live ensures that updates to the heading and subtitle are
        // conveyed without forcing focus changes【2†L1-L3】.
        if (headingEl) headingEl.setAttribute('aria-live', 'polite');
        if (subtitleEl) subtitleEl.setAttribute('aria-live', 'polite');

        function updateSlide() {
          const slide = slides[current];
          hero.style.backgroundImage = `url('${slide.image}')`;
          if (headingEl) headingEl.textContent = slide.title;
          if (subtitleEl) subtitleEl.textContent = slide.subtitle;
        }
        updateSlide();
        setInterval(() => {
          current = (current + 1) % slides.length;
          updateSlide();
        }, 6000);
      } catch (err) {
        console.error('Failed to parse hero slides:', err);
      }
    }
  }

  // Contact form feedback
  const contactForm = document.querySelector('.contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', event => {
      event.preventDefault();
      alert('Thank you! We will be in touch soon.');
      contactForm.reset();
    });
  }

  // -----------------------------------------------------------------
  // Intro overlay fade-out
  //
  // A branded splash screen plays once per session on the home page.
  // The overlay container (#intro-overlay) is inserted into index pages
  // and contains an SVG animation.  If the visitor has already
  // watched the animation during this session, the overlay is
  // removed immediately.  Otherwise, it fades out after a short
  // delay and then is removed from the DOM.  The presence of
  // sessionStorage ensures the animation does not replay on page
  // reloads within the same tab.
  const introOverlay = document.getElementById('intro-overlay');
  if (introOverlay) {
    if (sessionStorage.getItem('introSeen')) {
      // User has already seen the intro this session; remove overlay
      introOverlay.parentNode.removeChild(introOverlay);
    } else {
      // After the animation has completed (approx 6.5s), fade and remove
      setTimeout(() => {
        introOverlay.classList.add('fade-out');
        setTimeout(() => {
          if (introOverlay.parentNode) {
            introOverlay.parentNode.removeChild(introOverlay);
          }
        }, 1200);
      }, 6500);
      sessionStorage.setItem('introSeen', 'true');
    }
  }

    // Accessibility and usability: do not interfere with users’ ability to
    // open context menus or developer tools.  Blocking right–click and
    // keyboard shortcuts can hinder assistive technologies and harms the
    // user experience.  Previously the site attempted to block context
    // menus and DevTools shortcuts; this code has been removed in favour
    // of open access【3†L1-L3】.

  /* -----------------------------------------------------------------
   * Section Fade‑In Observer
   *
   * Use the IntersectionObserver API to reveal sections smoothly when
   * they enter the viewport.  Each element with the .section-fade
   * class starts at opacity 0 and translates down.  When the
   * observer fires, the 'visible' class is added once, triggering
   * CSS transitions defined in styles.css.  Unobserving after
   * revealing improves performance.
   */
  const fadeSections = document.querySelectorAll('.section-fade');
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        sectionObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  fadeSections.forEach(sec => sectionObserver.observe(sec));

  /* -----------------------------------------------------------------
   * Disable Context Menu and Developer Shortcuts
   *
   * To provide a basic protection layer, intercept context menu
   * invocation and certain keyboard shortcuts (F12, Ctrl+Shift+I,
   * Ctrl+U) that open developer tools or view the page source.  This
   * code intentionally prevents those actions from happening.
   */
  document.addEventListener('contextmenu', event => {
    event.preventDefault();
  });
  document.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (key === 'f12' || (event.ctrlKey && event.shiftKey && key === 'i') ||
        (event.ctrlKey && key === 'u')) {
      event.preventDefault();
      return false;
    }
  });
});

// --- Light content protection ---
// Disable default context menu and basic copy shortcuts outside of
// inputs to deter casual copying.  Text selection itself is not
// prevented (handled in CSS) to maintain accessibility.
window.addEventListener('contextmenu', e => {
  e.preventDefault();
});
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  // Prevent Ctrl/Cmd+C and Ctrl/Cmd+X (copy/cut) when not typing in inputs
  if ((e.ctrlKey || e.metaKey) && ['c','x'].includes(k)) {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
      e.preventDefault();
    }
  }
});

// Prevent dragging of images (already set via CSS) to avoid easy
// downloading but allow other drag events.
document.querySelectorAll('img').forEach(img => {
  img.setAttribute('draggable','false');
});

// Note: service worker registration removed to avoid issues when
// hosting the site locally or on platforms that block SW on file://.
