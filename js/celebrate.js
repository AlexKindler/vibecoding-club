/* js/celebrate.js — the fun parts: confetti bursts and number count-ups.
 * Loaded on every page right after js/shared.js. Both respect the visitor's
 * reduced-motion setting: confetti becomes a toast, count-ups just show the number.
 *
 *   Site.confetti(button, '🎉 See you Tuesday!');   // burst from an element
 *   Site.countUp(element, 85, 700);                  // 0 -> 85 over 700 ms
 */
(function () {
  'use strict';

  var Site = window.Site || (window.Site = {});
  var COLORS = ['#FFD53D', '#FF8A00', '#34D399', '#FF6B6B', '#2A5BD7', '#6D28D9'];

  // quietMessage is what to say instead when the visitor prefers reduced motion.
  Site.confetti = function (fromEl, quietMessage) {
    if (!Site.motionOK()) { Site.toast(quietMessage || '🎉 Nice!'); return; }
    var canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    var ox = window.innerWidth / 2, oy = window.innerHeight * 0.5;
    if (fromEl && fromEl.getBoundingClientRect) {
      var r = fromEl.getBoundingClientRect();
      ox = r.left + r.width / 2; oy = r.top + r.height / 2;
    }
    var pieces = [];
    for (var i = 0; i < 150; i++) {
      var angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      var speed = 9 + Math.random() * 9;
      pieces.push({
        x: ox, y: oy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
        color: COLORS[i % COLORS.length],
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, round: i % 4 === 0
      });
    }
    var start = null;
    function frame(t) {
      if (start === null) start = t;
      var age = t - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.globalAlpha = age > 1600 ? Math.max(0, 1 - (age - 1600) / 600) : 1;
      pieces.forEach(function (p) {
        p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (age < 2200) requestAnimationFrame(frame); else canvas.remove();
    }
    requestAnimationFrame(frame);
  };

  // Counts a number up inside an element (or just shows it under reduced motion).
  Site.countUp = function (el, target, ms) {
    target = Number(target) || 0;
    if (!Site.motionOK() || target === 0) { el.textContent = target; return; }
    var start = null;
    function frame(t) {
      if (start === null) start = t;
      var k = Math.min(1, (t - start) / (ms || 600));
      var eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * eased);
      if (k < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

})();
