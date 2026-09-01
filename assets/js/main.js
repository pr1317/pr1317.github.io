/* Preetam Roy — portfolio behaviour.
   No dependencies. Every enhancement here is optional: if this file
   fails to load, the page is still complete and readable, because the
   stylesheet only hides content once the inline boot script has proved
   JavaScript is running. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- theme ---------- */
  var toggle = document.getElementById('theme-toggle');

  function readTheme() {
    try { return localStorage.getItem('pr-theme'); } catch (e) { return null; }
  }
  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (toggle) {
      var dark = theme === 'dark';
      toggle.setAttribute('aria-pressed', String(dark));
      toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    }
  }

  /* Light is the default for everyone; a visitor's own choice wins and
     persists. The inline boot script has already applied any stored
     value, so this only syncs the button state. */
  applyTheme(readTheme() === 'dark' ? 'dark' : 'light');

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem('pr-theme', next); } catch (e) { /* not persisted */ }
    });
  }

  /* ---------- mobile menu ---------- */
  var menu = document.getElementById('mobile-menu');
  var menuBtn = document.getElementById('menu-btn');
  var menuClose = document.getElementById('menu-close');

  function setMenu(open) {
    if (!menu || !menuBtn) return;
    if (open) menu.hidden = false;
    // Let the element paint before transitioning in.
    window.requestAnimationFrame(function () {
      menu.classList.toggle('is-open', open);
    });
    menuBtn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
    if (!open) {
      window.setTimeout(function () {
        if (!menu.classList.contains('is-open')) menu.hidden = true;
      }, 400);
      menuBtn.focus();
    } else if (menuClose) {
      menuClose.focus();
    }
  }

  if (menuBtn) menuBtn.addEventListener('click', function () { setMenu(true); });
  if (menuClose) menuClose.addEventListener('click', function () { setMenu(false); });
  if (menu) {
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setMenu(false);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu && menu.classList.contains('is-open')) setMenu(false);
  });

  /* ---------- header condense and docked action bar ---------- */
  var header = document.getElementById('site-header');
  var dock = document.getElementById('dock');
  var ticking = false;

  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if (header) header.classList.toggle('is-stuck', y > 80);
    if (dock) {
      // Appears once the hero has scrolled away, so it never covers the opening.
      var show = y > window.innerHeight * 0.75;
      dock.classList.toggle('is-up', show);
      dock.setAttribute('aria-hidden', String(!show));
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ---------- reveals, counters and bars ---------- */
  var animateNumbers = !reduced;

  function runCounter(el) {
    var target = parseFloat(el.getAttribute('data-count-to'));
    if (isNaN(target)) return;
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    if (!animateNumbers) { el.textContent = prefix + target + suffix; return; }

    var start = null;
    var duration = 900;
    function frame(now) {
      if (start === null) start = now;
      var p = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(target * eased) + suffix;
      if (p < 1) window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add('is-in');
        // Counters and bars run once, when their band first comes into view.
        Array.prototype.forEach.call(el.querySelectorAll('[data-count-to]'), runCounter);
        if (el.hasAttribute('data-count-to')) runCounter(el);
        io.unobserve(el);
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });

    Array.prototype.forEach.call(document.querySelectorAll('.reveal, .perf__row'), function (el) {
      io.observe(el);
    });
  } else {
    // No IntersectionObserver: show everything immediately.
    Array.prototype.forEach.call(document.querySelectorAll('.reveal, .perf__row'), function (el) {
      el.classList.add('is-in');
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-count-to]'), function (el) {
      el.textContent = (el.getAttribute('data-prefix') || '') + el.getAttribute('data-count-to') + (el.getAttribute('data-suffix') || '');
    });
  }

  /* ---------- scroll spy ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  var sections = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          var on = a.getAttribute('href') === '#' + entry.target.id;
          if (on) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { spy.observe(s); });
  }
})();
