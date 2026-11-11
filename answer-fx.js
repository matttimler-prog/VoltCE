/* VoltCE answer animations: 10 electrical animations for a correct answer and 10 for a wrong one.
   Each crosses the screen once (about 1.5 s) on a click-through canvas. They follow the site's
   "Effects" switch and the reduced-motion setting, and none flash faster than about 3 times a second.
   Preview all 20: open any page with ?fxdemo=1 on the address. */
(function () {
  'use strict'
  var TAU = Math.PI * 2
  var clamp = function (x, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return Math.max(a, Math.min(b, x)) }
  var lerp = function (a, b, t) { return a + (b - a) * t }
  var R = function (a, b) { return a + Math.random() * (b - a) }
  var eio = function (t) { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
  var eo = function (t) { return 1 - Math.pow(1 - clamp(t), 3) }
  var fade = function (p, i, o) { i = i || .1; o = o || .25; return Math.min(clamp(p / i), clamp((1 - p) / o)) }
  var GOLD = '#FFC23D', CYAN = '#5ADBFF', GREEN = '#3BE38A', WHITE = '#FFFFFF', RED = '#FF4D4D', ORANGE = '#FF8A3D'

  function zig(x1, y1, x2, y2, n, jit) {
    var pts = [[x1, y1]], i, t
    for (i = 1; i < n; i++) { t = i / n; pts.push([lerp(x1, x2, t) + R(-jit, jit) * .35, lerp(y1, y2, t) + R(-jit, jit)]) }
    pts.push([x2, y2]); return pts
  }
  function seg(c, pts, f0, f1) {
    var n = pts.length - 1, a = clamp(f0) * n, b = clamp(f1) * n, i, ia = Math.floor(a), ib = Math.floor(b)
    if (b <= a) return
    c.beginPath()
    for (i = ia; i <= Math.min(ib, n - 1); i++) {
      var p0 = pts[i], p1 = pts[i + 1], s = i === ia ? a - ia : 0, e = i === ib ? b - ib : 1
      var x0 = lerp(p0[0], p1[0], s), y0 = lerp(p0[1], p1[1], s), x1 = lerp(p0[0], p1[0], e), y1 = lerp(p0[1], p1[1], e)
      if (i === ia) c.moveTo(x0, y0); else c.lineTo(x0, y0)
      c.lineTo(x1, y1)
    }
    c.stroke()
  }
  function glow(c, col, b) { c.shadowColor = col; c.shadowBlur = b }
  function line(c, col, w, a) { c.strokeStyle = col; c.lineWidth = w; c.globalAlpha = a == null ? 1 : a; c.lineCap = 'round'; c.lineJoin = 'round' }
  function boltGlyph(c, x, y, s, fill, g) {
    var P = [[.2, -1], [-.45, .1], [-.05, .1], [-.25, 1], [.45, -.15], [.05, -.15]]
    c.save(); c.translate(x, y); c.scale(s, s); glow(c, g || fill, 18); c.fillStyle = fill; c.beginPath()
    P.forEach(function (q, i) { i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]) }); c.closePath(); c.fill(); c.restore()
  }
  function bulb(c, x, y, r, lit, col) {
    c.save(); c.globalAlpha *= 1
    if (lit > 0) { var g = c.createRadialGradient(x, y, 2, x, y, r * 3.2); g.addColorStop(0, 'rgba(255,224,120,' + (.55 * lit) + ')'); g.addColorStop(1, 'rgba(255,200,80,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3.2, 0, TAU); c.fill() }
    c.shadowBlur = 0; c.fillStyle = lit > 0 ? 'rgba(255,' + Math.round(200 + 40 * lit) + ',' + Math.round(110 + 60 * lit) + ',' + (.35 + .65 * lit) + ')' : 'rgba(120,125,140,.55)'
    c.strokeStyle = 'rgba(255,255,255,' + (.35 + .3 * lit) + ')'; c.lineWidth = 2
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.stroke()
    c.fillStyle = 'rgba(150,155,170,.85)'; c.fillRect(x - r * .5, y + r * .85, r, r * .6)
    c.strokeStyle = lit > 0 ? '#fff' : 'rgba(255,255,255,.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - r * .3, y + r * .8); c.lineTo(x - r * .2, y - r * .2); c.lineTo(x + r * .2, y - r * .2); c.lineTo(x + r * .3, y + r * .8); c.stroke()
    c.restore()
  }
  function tick(p, dur, fps) { return Math.floor(p * dur * (fps || 15)) }

  /* ---------------- correct answers ---------------- */
  var OK = [
    { name: 'Lightning strike', dur: 1.3,
      init: function (W, H) { var m = zig(-W * .05, H * R(.25, .4), W * 1.05, H * R(.55, .7), 30, H * .14), br = []; for (var i = 0; i < 3; i++) { var k = Math.floor(R(5, 24)), s = m[k]; br.push(zig(s[0], s[1], s[0] + R(60, 200), s[1] + R(-1, 1) * H * .22, 7, 26)) } return { m: m, br: br } },
      draw: function (c, p, s, W, H) { var head = eo(p) * 1.25, tail = Math.max(0, head - .5), h1 = Math.min(1, head)
        c.globalAlpha = 1; c.fillStyle = 'rgba(255,226,140,' + (.12 * clamp(1 - p / .35)) + ')'; c.fillRect(0, 0, W, H)
        var a = clamp((1 - p) / .35)
        glow(c, GOLD, 28); line(c, GOLD, 9, a * .7); seg(c, s.m, tail, h1)
        glow(c, WHITE, 10); line(c, WHITE, 3.5, a); seg(c, s.m, tail, h1)
        s.br.forEach(function (b, i) { var f = clamp((head - .1 - i * .12) * 2.2); line(c, '#FFE9A8', 2.5, a * .85); glow(c, GOLD, 14); seg(c, b, 0, f) }) } },
    { name: 'Spark shower', dur: 1.6,
      init: function (W, H) { var a = [], i; for (i = 0; i < 120; i++) a.push({ x: R(-20, W * .12), y: H * R(.6, .98), vx: R(.35, 1.05) * W, vy: -R(220, 760), t0: R(0, .35), col: [GOLD, WHITE, ORANGE, '#FFE9A8'][i % 4], w: R(1.5, 3.4) }); return a },
      draw: function (c, p, s, W, H) { var T = p * 1.6; s.forEach(function (k) { var t = T - k.t0; if (t < 0) return; var life = 1.1, a = clamp(1 - t / life); if (a <= 0) return
          var px = function (tt) { return k.x + k.vx * tt }, py = function (tt) { return k.y + k.vy * tt + 450 * tt * tt }
          glow(c, k.col, 10); line(c, k.col, k.w, a); c.beginPath(); c.moveTo(px(Math.max(0, t - .05)), py(Math.max(0, t - .05))); c.lineTo(px(t), py(t)); c.stroke() }) } },
    { name: 'Current flow', dur: 1.7,
      init: function () { var e = [], i; for (i = 0; i < 44; i++) e.push({ o: i / 44, r: R(2.6, 5), j: R(-1, 1) }); return e },
      draw: function (c, p, s, W, H) { var y = function (x) { return H * .5 + Math.sin(x / W * TAU * 1.5) * H * .06 }, reach = eo(p * 1.4) * W * 1.05, a = fade(p, .08, .3), x
        glow(c, CYAN, 12); line(c, 'rgba(90,219,255,.55)', 3, a); c.beginPath(); for (x = 0; x <= reach; x += 8) { x ? c.lineTo(x, y(x)) : c.moveTo(x, y(x)) } c.stroke()
        s.forEach(function (e) { var xx = ((e.o + p * 1.8) % 1) * W; if (xx > reach) return; glow(c, CYAN, 16); c.globalAlpha = a; c.fillStyle = '#E6FBFF'; c.beginPath(); c.arc(xx, y(xx) + e.j * 4, e.r, 0, TAU); c.fill() }) } },
    { name: 'Bulbs light up', dur: 1.7,
      init: function () { return {} },
      draw: function (c, p, s, W, H) { var n = 9, a = fade(p, .06, .3), y = H * .3; c.globalAlpha = a; glow(c, 'rgba(0,0,0,0)', 0); line(c, 'rgba(255,255,255,.4)', 2.5, a); c.beginPath(); c.moveTo(0, y - 36); c.lineTo(W, y - 36); c.stroke()
        for (var i = 0; i < n; i++) { var x = W * (i + .5) / n, t0 = .08 + i * .07, lit = clamp((p - t0) / .08); c.globalAlpha = a; c.strokeStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.moveTo(x, y - 36); c.lineTo(x, y - 18); c.stroke(); bulb(c, x, y, 17, lit, GOLD) } } },
    { name: 'Circuit trace', dur: 1.5,
      init: function (W, H) { function mk(y0) { var pts = [[-10, y0]], x = 0, y = y0, n = 9, i; for (i = 0; i < n; i++) { x += W / n * R(.7, 1.1); pts.push([x, y]); var dy = R(-1, 1) * H * .12; pts.push([x + Math.abs(dy) * .6, y + dy]); y += dy; x += Math.abs(dy) * .6 } pts.push([W + 20, y]); return pts } return { a: mk(H * .42), b: mk(H * .6) } },
      draw: function (c, p, s, W, H) { var head = eio(p * 1.1), al = fade(p, .06, .3);[[s.a, GREEN], [s.b, CYAN]].forEach(function (t) { var pts = t[0]; glow(c, t[1], 14); line(c, t[1], 4, al); seg(c, pts, 0, head)
          pts.forEach(function (q, i) { if (i % 2 === 1 && i / pts.length <= head) { var k = clamp((head - i / pts.length) * 6); c.globalAlpha = al * (.4 + .6 * Math.sin(k * Math.PI)); c.fillStyle = '#EFFFF6'; c.beginPath(); c.arc(q[0], q[1], 6, 0, TAU); c.fill() } }) }) } },
    { name: 'Tesla arcs', dur: 1.4,
      init: function () { return { k: -1, arcs: [] } },
      draw: function (c, p, s, W, H) { var kk = tick(p, 1.4, 16); if (kk !== s.k) { s.k = kk; s.arcs = []; for (var i = 0; i < 4; i++) s.arcs.push(zig(R(-24, 24), 0, R(-24, 24), H, 16, 42)) }
        var x = lerp(-W * .1, W * 1.1, eio(p)), a = fade(p, .05, .2)
        s.arcs.forEach(function (pts, i) { c.save(); c.translate(x, 0); glow(c, i % 2 ? '#B58CFF' : CYAN, 26); line(c, i % 2 ? '#B58CFF' : CYAN, 5, a * .75); seg(c, pts, 0, 1); glow(c, WHITE, 8); line(c, WHITE, 1.8, a); seg(c, pts, 0, 1); c.restore() }) } },
    { name: 'Oscilloscope wave', dur: 1.6,
      init: function () { return {} },
      draw: function (c, p, s, W, H) { var head = eio(p) * W * 1.12, a = fade(p, .05, .3), x, y0 = H * .5
        line(c, 'rgba(92,255,157,.10)', 1, a); for (x = 0; x <= W; x += W / 12) { c.beginPath(); c.moveTo(x, y0 - H * .16); c.lineTo(x, y0 + H * .16); c.stroke() } for (var g = -2; g <= 2; g++) { c.beginPath(); c.moveTo(0, y0 + g * H * .07); c.lineTo(W, y0 + g * H * .07); c.stroke() }
        for (x = Math.max(0, head - W * .55); x <= Math.min(W, head); x += 4) { var tail = clamp(1 - (head - x) / (W * .55)), amp = H * .09 * (1 - p * .5); glow(c, '#5CFF9D', 14); line(c, '#5CFF9D', 3.5, a * tail); c.beginPath(); c.moveTo(x, y0 + Math.sin(x / W * TAU * 3 + p * 9) * amp); c.lineTo(x + 4, y0 + Math.sin((x + 4) / W * TAU * 3 + p * 9) * amp); c.stroke() } } },
    { name: 'Plasma orb', dur: 1.6,
      init: function () { return { k: -1, t: [] } },
      draw: function (c, p, s, W, H) { var kk = tick(p, 1.6, 18); if (kk !== s.k) { s.k = kk; s.t = []; for (var i = 0; i < 7; i++) { var an = R(0, TAU), L = R(60, 110); s.t.push(zig(0, 0, Math.cos(an) * L, Math.sin(an) * L, 5, 16)) } }
        var a = fade(p, .06, .2), pos = function (q) { return [lerp(-70, W + 70, eio(q)), H * .55 + Math.sin(q * TAU * 2) * H * .07] }
        for (var j = 8; j >= 1; j--) { var pp = pos(Math.max(0, p - j * .018)); c.globalAlpha = a * (.28 - j * .03); c.fillStyle = CYAN; c.beginPath(); c.arc(pp[0], pp[1], 30 - j * 2.2, 0, TAU); c.fill() }
        var o = pos(p); c.save(); c.translate(o[0], o[1]); c.globalAlpha = a
        var g = c.createRadialGradient(0, 0, 3, 0, 0, 58); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(120,225,255,.9)'); g.addColorStop(1, 'rgba(110,80,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 58, 0, TAU); c.fill()
        s.t.forEach(function (pts) { glow(c, '#B58CFF', 14); line(c, '#CDB8FF', 2, a); seg(c, pts, 0, 1) }); c.restore() } },
    { name: 'Battery charge', dur: 1.7,
      init: function () { return {} },
      draw: function (c, p, s, W, H) { var a = fade(p, .08, .25), bw = W * .88, bh = 54, x0 = (W - bw) / 2, y0 = H * .5 - bh / 2, n = 22, cnt = Math.floor(eio(clamp(p * 1.15)) * n)
        glow(c, GREEN, 12); line(c, 'rgba(255,255,255,.8)', 3, a); c.strokeRect(x0, y0, bw, bh); c.fillStyle = 'rgba(255,255,255,.8)'; c.globalAlpha = a; c.fillRect(x0 + bw + 2, y0 + bh * .3, 10, bh * .4)
        for (var i = 0; i < cnt; i++) { c.globalAlpha = a; c.fillStyle = i > n * .75 ? '#B8FF9A' : GREEN; c.fillRect(x0 + 6 + i * ((bw - 12) / n), y0 + 6, (bw - 12) / n - 4, bh - 12) }
        if (cnt) { c.globalAlpha = a; boltGlyph(c, x0 + 6 + cnt * ((bw - 12) / n), y0 - 34, 24, GOLD, GOLD) } } },
    { name: 'Bolt train', dur: 1.4,
      init: function (W, H) { var a = [], i; for (i = 0; i < 7; i++) a.push({ y: H * (.16 + i * .115 + R(-.02, .02)), s: R(24, 46), d: i * .06, col: [GOLD, WHITE, CYAN][i % 3] }); return a },
      draw: function (c, p, s, W, H) { s.forEach(function (b) { var q = clamp((p - b.d) / (1 - b.d - .02)); if (q <= 0 || q >= 1) return; var x = lerp(-80, W + 80, eo(q) * .6 + q * .4)
          for (var k = 1; k <= 4; k++) { glow(c, b.col, 8); line(c, b.col, 2.2, (1 - k / 5) * .8); c.beginPath(); c.moveTo(x - 20 - k * 22, b.y + (k - 2.5) * b.s * .12); c.lineTo(x - 20 - k * 22 - 40, b.y + (k - 2.5) * b.s * .12); c.stroke() }
          c.globalAlpha = 1; boltGlyph(c, x, b.y, b.s, b.col, b.col) }) } }
  ]

  /* ---------------- wrong answers ---------------- */
  function burst(c, x, y, q, n, len, cols) { for (var i = 0; i < n; i++) { var an = i / n * TAU + i * .3, L = len * eo(q) * (.6 + .4 * ((i * 37) % 10) / 10), a = clamp(1 - q); glow(c, cols[i % cols.length], 10); line(c, cols[i % cols.length], 2.4, a); c.beginPath(); c.moveTo(x + Math.cos(an) * L * .4, y + Math.sin(an) * L * .4); c.lineTo(x + Math.cos(an) * L, y + Math.sin(an) * L); c.stroke() } }
  var BAD = [
    { name: 'Breaker trip', dur: 1.7,
      init: function () { return {} },
      draw: function (c, p, s, W, H) { var x = lerp(W + 90, -110, eio(p)), y = H * .5, a = fade(p, .06, .15), tripped = x < W * .55
        c.globalAlpha = a; glow(c, 'rgba(0,0,0,0)', 0); c.fillStyle = '#2B3040'; c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3; c.beginPath(); c.roundRect ? c.roundRect(x - 44, y - 80, 88, 160, 12) : c.rect(x - 44, y - 80, 88, 160); c.fill(); c.stroke()
        c.fillStyle = '#0F1320'; c.fillRect(x - 18, y - 46, 36, 92)
        c.fillStyle = tripped ? RED : '#8892AA'; glow(c, tripped ? RED : 'rgba(0,0,0,0)', tripped ? 18 : 0); c.fillRect(x - 15, tripped ? y - 2 : y - 44, 30, 44)
        c.beginPath(); c.arc(x, y - 62, 6, 0, TAU); c.fillStyle = tripped ? RED : '#3A4054'; c.fill()
        if (tripped) burst(c, x, y - 20, clamp((W * .55 - x) / (W * .35)), 14, 120, [RED, ORANGE, '#FFD0B0']) } },
    { name: 'Short-circuit pops', dur: 1.6,
      init: function (W, H) { var a = [], i; for (i = 0; i < 6; i++) a.push({ x: W * (.1 + i * .16) + R(-20, 20), y: H * R(.5, .85), t0: i * .11 }); return a },
      draw: function (c, p, s, W, H) { s.forEach(function (b) { var q = (p - b.t0) / .38; if (q < 0 || q > 1) return; c.globalAlpha = clamp(1 - q); var g = c.createRadialGradient(b.x, b.y, 1, b.x, b.y, 38); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,100,60,0)'); c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, 38 * (1 - q * .4), 0, TAU); c.fill(); burst(c, b.x, b.y, q, 16, 110, [RED, ORANGE, WHITE]) }) } },
    { name: 'Lights go out', dur: 1.8,
      init: function () { return {} },
      draw: function (c, p, s, W, H) { var n = 9, a = fade(p, .05, .22), y = H * .3; line(c, 'rgba(255,255,255,.35)', 2.5, a); c.beginPath(); c.moveTo(0, y - 36); c.lineTo(W, y - 36); c.stroke()
        for (var i = 0; i < n; i++) { var x = W * (i + .5) / n, t0 = .1 + i * .07, q = clamp((p - t0) / .2), lit = p < t0 ? 1 : (q < .5 ? 1 - q * 1.2 : .4 * (q - .5) * 2 + .0) * (1 - q) + (1 - q) * .0; lit = p < t0 ? 1 : clamp(.9 - q * 1.2 + (q > .35 && q < .55 ? .45 : 0)); if (p > t0 + .2) lit = 0
          c.globalAlpha = a; c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 36); c.lineTo(x, y - 18); c.stroke(); bulb(c, x, y, 17, lit, GOLD) } } },
    { name: 'Blown fuse', dur: 1.7,
      init: function (W, H) { var a = [], i; for (i = 0; i < 9; i++) a.push({ x: W * (.08 + i * .105), r: R(14, 26), v: R(40, 90) }); return a },
      draw: function (c, p, s, W, H) { var y = H * .5, fx = eio(p * 1.08) * W * 1.04, a = fade(p, .05, .22)
        line(c, 'rgba(190,195,210,.8)', 4, a); glow(c, 'rgba(0,0,0,0)', 0); c.beginPath(); c.moveTo(Math.min(fx, W), y); c.lineTo(W, y); c.stroke()
        line(c, 'rgba(60,50,50,.9)', 3, a); c.setLineDash([3, 9]); c.beginPath(); c.moveTo(0, y); c.lineTo(Math.min(fx, W), y); c.stroke(); c.setLineDash([])
        s.forEach(function (b) { if (fx < b.x) return; var t = (fx - b.x) / W * 1.6; c.globalAlpha = a * clamp(.5 - t * .5); c.fillStyle = '#9AA0AE'; c.beginPath(); c.arc(b.x, y - 20 - t * b.v * 4, b.r * (1 + t * 3), 0, TAU); c.fill() })
        c.globalAlpha = a; var g = c.createRadialGradient(fx, y, 1, fx, y, 60); g.addColorStop(0, 'rgba(255,220,150,1)'); g.addColorStop(.35, 'rgba(255,120,40,.8)'); g.addColorStop(1, 'rgba(255,60,20,0)'); c.fillStyle = g; c.beginPath(); c.arc(fx, y, 60, 0, TAU); c.fill()
        for (var i = 0; i < 8; i++) { glow(c, ORANGE, 8); line(c, i % 2 ? ORANGE : '#FFE0A0', 2, a); c.beginPath(); c.moveTo(fx, y); c.lineTo(fx + R(-40, 20), y + R(-46, 46)); c.stroke() } } },
    { name: 'Brownout sweep', dur: 1.7,
      init: function () { return {} },
      draw: function (c, p, s, W, H) { var cx = lerp(-W * .3, W * 1.3, eio(p)), bw = W * .55, a = fade(p, .1, .15), g = c.createLinearGradient(cx - bw, 0, cx + bw, 0)
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.35, 'rgba(8,8,20,.42)'); g.addColorStop(.65, 'rgba(8,8,20,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = a; c.fillStyle = g; c.fillRect(cx - bw, 0, bw * 2, H)
        glow(c, RED, 10); line(c, RED, 2, a * .5); c.beginPath(); c.moveTo(cx + bw * .65, 0); c.lineTo(cx + bw * .65, H); c.stroke()
        c.shadowBlur = 0; c.fillStyle = 'rgba(255,160,90,' + (a * .3) + ')'; for (var i = 0; i < 5; i++) c.fillRect(cx - bw * .3, H * (.2 + i * .15), bw * .6 * (.4 + ((i * 7) % 5) / 8), 2) } },
    { name: 'Arc flash', dur: 1.3,
      init: function () { return { k: -1, pts: [] } },
      draw: function (c, p, s, W, H) { var kk = tick(p, 1.3, 20); if (kk !== s.k) { s.k = kk; s.pts = zig(0, H * .5, W, H * .5, 26, H * .13) }
        var head = eo(p * 1.1), a = clamp((1 - p) / .4); c.globalAlpha = a; var hp = s.pts[Math.min(s.pts.length - 1, Math.floor(head * (s.pts.length - 1)))], g = c.createRadialGradient(hp[0], hp[1], 1, hp[0], hp[1], 120); g.addColorStop(0, 'rgba(255,235,200,.8)'); g.addColorStop(.4, 'rgba(255,130,40,.45)'); g.addColorStop(1, 'rgba(255,90,20,0)'); c.fillStyle = g; c.beginPath(); c.arc(hp[0], hp[1], 120, 0, TAU); c.fill()
        glow(c, ORANGE, 30); line(c, ORANGE, 9, a * .8); seg(c, s.pts, Math.max(0, head - .5), head); glow(c, WHITE, 8); line(c, '#FFF4E0', 3, a); seg(c, s.pts, Math.max(0, head - .5), head) } },
    { name: 'Crack', dur: 1.6,
      init: function (W, H) { var main = [[-10, H * .5]], x = -10, y = H * .5, i, br = []; for (i = 0; i < 26; i++) { x += W / 24 * R(.6, 1.3); y += R(-1, 1) * H * .06; main.push([x, y]) }
        for (i = 0; i < 9; i++) { var o = main[Math.floor(R(2, 24))], pts = [o], bx = o[0], by = o[1], dir = Math.random() < .5 ? -1 : 1, m = Math.floor(R(3, 7)); for (var j = 0; j < m; j++) { bx += R(14, 50); by += dir * R(18, 58); pts.push([bx, by]) } br.push(pts) } return { m: main, b: br } },
      draw: function (c, p, s, W, H) { var head = eo(p * 1.15), a = clamp((1 - p) / .3); glow(c, RED, 18); line(c, RED, 6, a * .8); seg(c, s.m, 0, head); glow(c, '#FFD0D0', 4); line(c, '#FFE6E6', 2, a); seg(c, s.m, 0, head)
        s.b.forEach(function (b) { var f = clamp((head - b[0][0] / W) * 3.2); glow(c, RED, 12); line(c, RED, 3.5, a * .8); seg(c, b, 0, f); line(c, '#FFE0E0', 1.4, a); glow(c, 'rgba(0,0,0,0)', 0); seg(c, b, 0, f) }) } },
    { name: 'Low battery', dur: 1.8,
      init: function () { return {} },
      draw: function (c, p, s, W, H) { var x = lerp(-120, W + 120, eio(p)), y = H * .5, a = fade(p, .06, .12), lvl = lerp(.9, .05, clamp(p * 1.1)), blink = Math.sin(p * TAU * 1.5) > 0
        c.globalAlpha = a; glow(c, blink ? RED : 'rgba(0,0,0,0)', blink ? 16 : 0); line(c, blink ? RED : 'rgba(255,255,255,.8)', 4, a); c.strokeRect(x - 48, y - 24, 90, 48); c.fillStyle = blink ? RED : 'rgba(255,255,255,.8)'; c.fillRect(x + 43, y - 10, 8, 20)
        c.shadowBlur = 0; c.fillStyle = lvl > .5 ? GREEN : (lvl > .25 ? GOLD : RED); c.fillRect(x - 43, y - 19, 80 * lvl, 38)
        c.fillStyle = '#fff'; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', x - 3, y + 1) } },
    { name: 'Static glitch', dur: 1.5,
      init: function () { return { k: -1, bars: [], dots: [] } },
      draw: function (c, p, s, W, H) { var kk = tick(p, 1.5, 12); if (kk !== s.k) { s.k = kk; s.bars = []; s.dots = []; var i; for (i = 0; i < 16; i++) s.bars.push({ y: R(0, H), h: R(4, 20), w: R(80, 280), dx: R(-30, 30) }); for (i = 0; i < 90; i++) s.dots.push([R(-1, 1), R(0, H), R(1, 3)]) }
        var cx = eio(p) * W, bw = W * .2, a = clamp(Math.min(p / .08, (1 - p) / .2)); c.globalAlpha = a * .9
        s.bars.forEach(function (b) { var x = cx + b.dx - b.w / 2; c.fillStyle = 'rgba(255,60,70,.5)'; c.fillRect(x - 6, b.y, b.w, b.h); c.fillStyle = 'rgba(70,220,255,.45)'; c.fillRect(x + 6, b.y + 2, b.w, b.h) })
        c.fillStyle = 'rgba(210,215,225,.7)'; s.dots.forEach(function (d) { c.fillRect(cx + d[0] * bw, d[1], d[2], d[2]) }); c.fillStyle = 'rgba(0,0,0,.18)'; for (var y = 0; y < H; y += 5) c.fillRect(cx - bw, y, bw * 2, 1.5) } },
    { name: 'Overload embers', dur: 1.7,
      init: function (W, H) { var e = [], sm = [], i; for (i = 0; i < 80; i++) e.push({ x: R(0, W), y: H + 10, vx: R(30, 150), vy: -R(140, 420), r: R(1.6, 4), t0: 0 }); e.forEach(function (k) { k.t0 = k.x / W * .5 }); for (i = 0; i < 16; i++) sm.push({ x: W * (i + .5) / 16, r: R(26, 54), t0: i / 16 * .5 }); return { e: e, sm: sm } },
      draw: function (c, p, s, W, H) { var T = p * 1.7, a = fade(p, .08, .3), g = c.createLinearGradient(0, H, 0, H * .55); g.addColorStop(0, 'rgba(255,70,40,.4)'); g.addColorStop(1, 'rgba(255,70,40,0)'); c.globalAlpha = a; c.fillStyle = g; c.fillRect(0, H * .55, W, H * .45)
        s.sm.forEach(function (k) { var t = T - k.t0; if (t < 0 || t > 1.2) return; c.globalAlpha = .26 * clamp(1 - t / 1.2); c.fillStyle = '#8A8F9C'; c.beginPath(); c.arc(k.x + t * 40, H - 20 - t * H * .5, k.r * (1 + t), 0, TAU); c.fill() })
        s.e.forEach(function (k) { var t = T - k.t0; if (t < 0 || t > 1.1) return; var al = clamp(1 - t / 1.1); glow(c, ORANGE, 10); c.globalAlpha = al; c.fillStyle = al > .5 ? '#FFD28A' : ORANGE; c.beginPath(); c.arc(k.x + k.vx * t, k.y + k.vy * t + 80 * t * t, k.r, 0, TAU); c.fill() }) } }
  ]

  /* ---------------- player ---------------- */
  var cv = null, ctx = null, raf = 0, bags = { ok: [], bad: [] }, lastIdx = { ok: -1, bad: -1 }, W = 0, H = 0
  function canvas() {
    if (cv) return
    cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true')
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9000'
    document.body.appendChild(cv)
  }
  function fit() { var d = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx = cv.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0) }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; if (ctx) ctx.clearRect(0, 0, W, H); if (cv) cv.style.display = 'none' }
  function allowed() {
    try { if (localStorage.getItem('vc_fx') === '0') return false } catch (e) {}
    try { if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return false } catch (e) {}
    return true
  }
  function pick(kind) {
    var set = kind === 'ok' ? OK : BAD, bag = bags[kind]
    if (!bag.length) { bag = bags[kind] = set.map(function (_, i) { return i }); for (var i = bag.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = bag[i]; bag[i] = bag[j]; bag[j] = t } if (bag[bag.length - 1] === lastIdx[kind]) bag.unshift(bag.pop()) }
    lastIdx[kind] = bag.pop(); return lastIdx[kind]
  }
  function run(def) {
    canvas(); stop(); cv.style.display = 'block'; fit()
    var s = def.init(W, H), t0 = performance.now()
    function frame(now) {
      var p = Math.max(0, (now - t0) / (def.dur * 1000))
      ctx.clearRect(0, 0, W, H)
      if (p >= 1) { stop(); return }
      ctx.save(); ctx.globalAlpha = 1; ctx.shadowBlur = 0; def.draw(ctx, p, s, W, H); ctx.restore()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
  }
  var API = {
    play: function (correct) { if (!allowed()) return; try { run((correct ? OK : BAD)[pick(correct ? 'ok' : 'bad')]) } catch (e) {} },
    playIndex: function (kind, i) { try { run((kind === 'ok' ? OK : BAD)[i]) } catch (e) {} },
    still: function (kind, i, p) { canvas(); stop(); cv.style.display = 'block'; fit(); var d = (kind === 'ok' ? OK : BAD)[i], s = d.init(W, H); ctx.save(); d.draw(ctx, p, s, W, H); ctx.restore() },
    names: { ok: OK.map(function (d) { return d.name }), bad: BAD.map(function (d) { return d.name }) },
    stop: stop
  }
  window.AnsFX = API

  /* preview panel: add ?fxdemo=1 to any address */
  try {
    if (/[?&]fxdemo=1/.test(location.search)) {
      var mount = function () {
        var d = document.createElement('div')
        d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9100;background:rgba(10,26,61,.94);color:#fff;padding:10px;border-radius:12px;max-width:min(94vw,520px);font:13px/1.3 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.4)'
        var h = '<div style="font-weight:700;margin-bottom:6px">Answer animations preview</div>'
        ;[['ok', 'Correct'], ['bad', 'Wrong']].forEach(function (k) { h += '<div style="margin:6px 0 3px;opacity:.8">' + k[1] + '</div><div style="display:flex;flex-wrap:wrap;gap:5px">'; API.names[k[0]].forEach(function (n, i) { h += '<button data-k="' + k[0] + '" data-i="' + i + '" style="font:12px system-ui;padding:5px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:' + (k[0] === 'ok' ? '#124a2e' : '#5a1a1a') + ';color:#fff;cursor:pointer">' + (i + 1) + '. ' + n + '</button>' }); h += '</div>' })
        d.innerHTML = h; d.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) API.playIndex(b.dataset.k, +b.dataset.i) }); document.body.appendChild(d)
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount()
    }
  } catch (e) {}
})()
