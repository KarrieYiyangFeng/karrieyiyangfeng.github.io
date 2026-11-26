/* =========================================================
   Karrie Yiyang Feng — Beyond Boundaries
   Slide-deck controller.
     Panel 0 (home/glass)  →click anywhere→  Panel 1 (cover)
     Panel 1 (cover)       →down arrow→       Panel 2 (work)
   Nav + buttons use [data-goto]. Panel 0 uses [data-advance].
   ========================================================= */

(function () {
  var track   = document.getElementById('track');
  var toTop   = document.querySelector('.to-top');
  var workEl  = document.getElementById('panel-work');
  var deck    = 0;                 // 0 = home, 1 = cover (horizontal)

  // Footer year
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // --- Horizontal deck: home (0) <-> cover (1) ---
  function deckTo(index) {
    deck = Math.max(0, Math.min(1, index));
    track.style.transform = 'translateX(-' + (deck * 100) + 'vw)';
  }

  // --- Vertical: scroll down to Work / back up to the intro ---
  function scrollToWork() {
    if (workEl) workEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    deckTo(0);
  }

  // Expose for debugging
  window.deckTo = deckTo;

  // --- Buttons / nav links ---
  document.querySelectorAll('[data-goto]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      deckTo(parseInt(el.getAttribute('data-goto'), 10));
    });
  });
  document.querySelectorAll('[data-scrollto]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (el.getAttribute('data-scrollto') === 'work') scrollToWork();
      else scrollToTop();
    });
  });

  // --- Panel 0: click anywhere slides left to the cover ---
  var home = document.querySelector('[data-advance]');
  if (home) {
    home.addEventListener('click', function () { deckTo(1); });
    home.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); deckTo(1); }
    });
  }

  // --- Keyboard: left/right drive the intro deck, down jumps to work ---
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') deckTo(deck + 1);
    else if (e.key === 'ArrowLeft') deckTo(deck - 1);
    else if (e.key === 'ArrowDown' && window.scrollY < 10) { e.preventDefault(); scrollToWork(); }
  });

  // --- Show the round "back to start" button once we're past the intro ---
  function updateToTop() {
    if (!toTop) return;
    toTop.style.display = (window.scrollY > window.innerHeight * 0.6) ? 'flex' : 'none';
  }
  window.addEventListener('scroll', updateToTop, { passive: true });
  updateToTop();

  // Keep the deck aligned on resize
  window.addEventListener('resize', function () {
    track.style.transition = 'none';
    track.style.transform = 'translateX(-' + (deck * 100) + 'vw)';
    void track.offsetWidth;
    track.style.transition = '';
  });

  deckTo(0);
})();

/* =========================================================
   Custom cursor: soft gray blurred square with a trailing tail.
   Only on mouse (fine-pointer) devices.
   ========================================================= */
(function () {
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!fine) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var N = reduce ? 1 : 8;          // number of trail segments
  var EASE = reduce ? 1 : 0.4;     // follow speed per segment

  document.documentElement.classList.add('has-custom-cursor');

  var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  var dots = [];
  for (var i = 0; i < N; i++) {
    var el = document.createElement('div');
    el.className = 'cursor-dot';
    document.body.appendChild(el);
    dots.push({ el: el, x: cx, y: cy });
  }

  var mx = cx, my = cy;
  document.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; });

  // Fade out when the mouse leaves the window; back in on return
  document.addEventListener('mouseleave', function () { dots.forEach(function (d) { d.el.style.display = 'none'; }); });
  document.addEventListener('mouseenter', function () { dots.forEach(function (d) { d.el.style.display = ''; }); });

  function frame() {
    var tx = mx, ty = my;
    for (var i = 0; i < N; i++) {
      var d = dots[i];
      d.x += (tx - d.x) * EASE;
      d.y += (ty - d.y) * EASE;
      var scale = 1 - (i / N) * 0.6;      // tail tapers in size
      var opacity = 1 - (i / N) * 0.85;   // ...and fades out
      d.el.style.transform = 'translate(' + d.x + 'px,' + d.y + 'px) scale(' + scale + ')';
      d.el.style.opacity = opacity;
      tx = d.x; ty = d.y;                  // next segment chases this one
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
