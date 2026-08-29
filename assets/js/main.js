/* Preetam Roy — portfolio behaviour.
   Vanilla, no dependencies. Every feature degrades to a working page
   if it throws: the markup is readable with JavaScript off entirely. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- theme ---------- */
  var THEME_KEY = 'pr-theme';
  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');

  function readStoredTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function storeTheme(value) {
    try { localStorage.setItem(THEME_KEY, value); } catch (e) { /* private mode, ignore */ }
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (toggle) {
      var light = theme === 'light';
      toggle.setAttribute('aria-pressed', String(light));
      toggle.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    }
  }

  // Dark is the site's default look for everyone; a visitor's own choice,
  // once made, wins and persists. (The inline boot script in <head> has
  // already applied any stored value, so this only syncs the button state.)
  var stored = readStoredTheme();
  applyTheme(stored === 'light' ? 'light' : 'dark');

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next);
      storeTheme(next);
    });
  }

  /* ---------- sticky header + scroll progress ---------- */
  var header = document.getElementById('site-header');
  var progress = document.getElementById('scroll-progress');
  var ticking = false;

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;

    if (header) header.classList.toggle('is-stuck', y > 8);

    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(y / max, 1) : 0;
      progress.style.transform = 'scaleX(' + ratio + ')';
    }
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onScroll);
    }
  }, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  var menuBtn = document.getElementById('menu-btn');
  var menu = document.getElementById('mobile-menu');

  function setMenu(open) {
    if (!menuBtn || !menu) return;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('is-locked', open);
  }

  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () {
      setMenu(menu.hidden);
    });
    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !menu.hidden) {
        setMenu(false);
        menuBtn.focus();
      }
    });
    // if the viewport grows past the breakpoint while open, drop the lock
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 900 && !menu.hidden) setMenu(false);
    });
  }

  /* ---------- reveal on scroll ---------- */
  var revealables = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  revealables.forEach(function (el) {
    var delay = el.getAttribute('data-reveal-delay');
    if (delay) el.style.setProperty('--d', delay);
  });

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

    revealables.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------- animated counters ---------- */
  var counters = Array.prototype.slice.call(document.querySelectorAll('[data-count-to]'));

  function runCounter(el) {
    var target = parseFloat(el.getAttribute('data-count-to'));
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var suffix = el.getAttribute('data-suffix') || '';
    var duration = 1250;
    var start = null;

    if (isNaN(target)) return;

    function frame(now) {
      if (start === null) start = now;
      var t = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      el.innerHTML = (target * eased).toFixed(decimals) + suffix;
      if (t < 1) window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  if (!reduceMotion && 'IntersectionObserver' in window) {
    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          runCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(function (el) { counterObserver.observe(el); });
  }

  /* ---------- scroll-spy ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));
  var sections = navLinks
    .map(function (link) { return document.querySelector(link.getAttribute('href')); })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (section) { spy.observe(section); });
  }

  /* ---------- pointer glow on project cards (fine pointers only) ---------- */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion) {
    document.querySelectorAll('.tilt').forEach(function (card) {
      card.addEventListener('pointermove', function (event) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', (event.clientX - rect.left) + 'px');
        card.style.setProperty('--my', (event.clientY - rect.top) + 'px');
      });
    });
  }

  /* ---------- footer year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
