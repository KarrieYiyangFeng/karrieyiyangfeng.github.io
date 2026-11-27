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

  var point = document.createElement('div');
  point.className = 'cursor-point';
  point.setAttribute('aria-hidden', 'true');
  point.hidden = true;
  document.body.appendChild(point);

  var mx = cx, my = cy;
  document.addEventListener('mousemove', function (e) {
    mx = e.clientX;
    my = e.clientY;
    point.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
    point.hidden = false;
  });
  document.addEventListener('mouseleave', function () { point.hidden = true; });

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
