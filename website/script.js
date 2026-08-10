/**
 * RILO GITHUB PAGES LANDING WEBSITE - INTERACTIVE SCRIPTS
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. STICKY HEADER SCROLL EFFECT
  // ==========================================
  const header = document.getElementById('site-header');

  const handleHeaderScroll = () => {
    if (window.scrollY > 20) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleHeaderScroll, { passive: true });
  handleHeaderScroll(); // Initialize on page load

  // ==========================================
  // 2. MOBILE MENU DRAWER TOGGLE
  // ==========================================
  const menuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const iconOpen = document.getElementById('menu-icon-open');
  const iconClose = document.getElementById('menu-icon-close');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      const isExpanded = mobileMenu.classList.contains('hidden');
      if (isExpanded) {
        mobileMenu.classList.remove('hidden');
        iconOpen?.classList.add('hidden');
        iconClose?.classList.remove('hidden');
      } else {
        mobileMenu.classList.add('hidden');
        iconOpen?.classList.remove('hidden');
        iconClose?.classList.add('hidden');
      }
    });

    mobileNavLinks.forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
        iconOpen?.classList.remove('hidden');
        iconClose?.classList.add('hidden');
      });
    });
  }

  // ==========================================
  // 3. SCREENSHOT LIGHTBOX MODAL
  // ==========================================
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxClose = document.getElementById('lightbox-close');
  const triggers = document.querySelectorAll('.lightbox-trigger');

  const openLightbox = (src, title) => {
    if (!lightbox || !lightboxImg || !lightboxCaption) return;
    lightboxImg.src = src;
    lightboxImg.alt = title || 'Rilo Screenshot Preview';
    lightboxCaption.textContent = title || '';
    lightbox.classList.remove('hidden');
    // Force browser reflow to trigger opacity transition
    void lightbox.offsetWidth;
    lightbox.classList.add('active');
    lightbox.focus();
  };

  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.classList.remove('active');
    setTimeout(() => {
      lightbox.classList.add('hidden');
      if (lightboxImg) lightboxImg.src = '';
    }, 300);
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      const target = e.currentTarget;
      const src = target.getAttribute('src');
      const title = target.getAttribute('data-title') || target.getAttribute('alt');
      if (src) openLightbox(src, title);
    });
  });

  if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
  }

  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) {
        closeLightbox();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.classList.contains('active')) {
        closeLightbox();
      }
    });
  }

  // ==========================================
  // 4. AUTOMATIC COPYRIGHT YEAR
  // ==========================================
  const yearSpan = document.getElementById('current-year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear().toString();
  }
});
