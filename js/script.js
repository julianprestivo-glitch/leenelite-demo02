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

    /*
     * Basic client-side deterrents to reduce casual viewing of page source.
     *
     * These listeners intercept the context menu and common keyboard
     * shortcuts used to open developer tools or view the page source,
     * such as Ctrl+U, Ctrl+Shift+I, F12, etc.  They simply prevent
     * the default action from firing.  Note that these measures are
     * purely cosmetic: anyone determined to inspect the code can
     * disable JavaScript or use other tools.  To truly protect
     * sensitive data, ensure it is never sent to the client in the
     * first place.
     */
    document.addEventListener('contextmenu', event => {
      event.preventDefault();
    });
    document.addEventListener('keydown', event => {
      const key = event.key.toLowerCase();
      // Block Ctrl+U, Ctrl+S, Ctrl+P and similar combos
      if (event.ctrlKey && !event.shiftKey && ['u', 's', 'p', 'c'].includes(key)) {
        event.preventDefault();
      }
      // Block Ctrl+Shift+I/J/C (dev tools) and F12
      if ((event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(key)) || key === 'f12') {
        event.preventDefault();
      }
    });
});