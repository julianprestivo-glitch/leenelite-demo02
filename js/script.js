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

  // Intro logo fade-out.  If an element with id="intro-logo" exists
  // (present on the home page), wait for a short delay then fade it
  // away and remove it from the DOM.  This creates a brief branded
  // introduction on page load.
  const intro = document.getElementById('intro-logo');
  if (intro) {
    // Allow the logo to display for 2 seconds before starting fade
    setTimeout(() => {
      intro.classList.add('hide');
      // Remove element after transition completes to avoid tab order issues
      setTimeout(() => {
        if (intro && intro.parentNode) {
          intro.parentNode.removeChild(intro);
        }
      }, 1500);
    }, 2000);
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