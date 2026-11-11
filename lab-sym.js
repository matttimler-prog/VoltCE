/* VoltCE Circuit Lab: component layout and symbols (SVG strings, 20 px grid, origin at component centre). */
(function (root) {
  'use strict'
  var INK = '#1c2b3a', LIVE = '#0f9d58', HOT = '#e8710a', RED = '#c62828', MUTED = '#8a94a6'
  var SC = root.SimCore
  function ln(x1, y1, x2, y2, col, w, extra) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (col || INK) + '" stroke-width="' + (w || 2) + '" stroke-linecap="round"' + (extra || '') + '/>' }
  function circ(x, y, r, fill, stroke, w) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + (fill || 'none') + '" stroke="' + (stroke || INK) + '" stroke-width="' + (w || 2) + '"/>' }
  function rect(x, y, w, h, fill, stroke, sw, rx) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx || 0) + '" fill="' + (fill || 'none') + '" stroke="' + (stroke || INK) + '" stroke-width="' + (sw || 2) + '"/>' }
  function path(d, col, w, fill) { return '<path d="' + d + '" fill="' + (fill || 'none') + '" stroke="' + (col || INK) + '" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round"/>' }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function num(n) { n = +n; return Math.abs(n) >= 100 ? Math.round(n) : (Math.round(n * 10) / 10) }

  /* layout: terminal positions (px, before rotation) and selection box */
  function layout(c) {
    var p = SC.propsOf(c), t = {}, box = [-30, -40, 30, 40], n, i, xs
    switch (c.type) {
      case 'src1': t = { L: [-20, 60], N: [20, 60] }; box = [-50, -40, 50, 40]; break
      case 'src2': t = { L1: [-40, 60], N: [0, 60], L2: [40, 60] }; box = [-60, -40, 60, 40]; break
      case 'src3': t = { L1: [-60, 60], L2: [-20, 60], L3: [20, 60], N: [60, 60] }; box = [-80, -40, 80, 40]; break
      case 'gnd': t = { g: [0, -20] }; box = [-20, -20, 20, 24]; break
      case 'sw': case 'pbno': case 'pbnc': case 'estop': case 'fuse': case 'cnt': t = { a: [0, -40], b: [0, 40] }; box = [-24, -40, 24, 40]; break
      case 'sw2': t = { c: [0, -40], t1: [-20, 40], t2: [20, 40] }; box = [-30, -40, 30, 40]; break
      case 'lamp': case 'heater': case 'motor1': case 'vm': case 'am': t = { a: [0, -40], b: [0, 40] }; box = [-28, -40, 28, 40]; break
      case 'coil': t = { A1: [0, -40], A2: [0, 40] }; box = [-26, -40, 26, 40]; break
      case 'motor3': t = { T1: [-40, -60], T2: [0, -60], T3: [40, -60] }; box = [-50, -60, 50, 44]; break
      case 'brk': n = p.poles || 1; xs = []; for (i = 0; i < n; i++) xs.push(-20 * (n - 1) + 40 * i)
        for (i = 0; i < n; i++) { t['in' + (i + 1)] = [xs[i], -60]; t['out' + (i + 1)] = [xs[i], 60] }
        box = [xs[0] - 22, -60, xs[n - 1] + 22, 60]; break
      case 'cpoles': n = p.poles || 3; xs = []; for (i = 0; i < n; i++) xs.push(-20 * (n - 1) + 40 * i)
        for (i = 0; i < n; i++) { t['L' + (i + 1)] = [xs[i], -40]; t['T' + (i + 1)] = [xs[i], 40] }
        box = [xs[0] - 22, -40, xs[n - 1] + 22, 40]; break
      case 'ol': t = { L1: [-40, -60], L2: [0, -60], L3: [40, -60], T1: [-40, 60], T2: [0, 60], T3: [40, 60], '95': [80, -20], '96': [80, 20] }; box = [-60, -60, 80, 60]; break
      case 'xfmr1': t = { H1: [-40, -60], H2: [40, -60], X1: [-40, 60], X2: [40, 60] }; if (p.ct) t.X0 = [0, 60]; box = [-60, -60, 60, 60]; break
      case 'xfmr3': { var c0 = p.conn || 'dy', wy = c0[0] === 'y', wsy = c0[1] === 'y'
        t = { H1: [-40, -60], H2: [0, -60], H3: [40, -60], X1: [-40, 60], X2: [0, 60], X3: [40, 60] }
        if (wy) t.H0 = [80, -60]; if (wsy) t.X0 = [80, 60]
        box = [-60, -60, (wy || wsy) ? 100 : 60, 60]; break }
    }
    return { terms: t, box: box }
  }

  function tx(ctx, x, y, s, size, col, anchor, bold) {
    return '<text x="' + x + '" y="' + y + '" font-size="' + (size || 11) + '" fill="' + (col || INK) + '" text-anchor="' + (anchor || 'middle') + '"' + (bold ? ' font-weight="700"' : '') +
      (ctx.rot ? ' transform="rotate(' + (-90 * ctx.rot) + ' ' + x + ' ' + y + ')"' : '') + ' font-family="system-ui,sans-serif">' + esc(s) + '</text>'
  }

  function arcs(x0, y0, n, w, up) { var d = 'M' + x0 + ' ' + y0, i; for (i = 0; i < n; i++) d += ' a' + (w / 2) + ' ' + (w / 2) + ' 0 0 ' + (up ? 1 : 0) + ' ' + w + ' 0'; return d }
  function contactMark(x, y, closed, live) { // vertical contact pair centred at x,y
    var col = live ? LIVE : INK
    return ln(x, y - 20, x, y - 8, col) + (closed ? ln(x, y - 8, x, y + 8, col) : ln(x, y - 8, x - 11, y + 7, INK)) + ln(x, y + 8, x, y + 20, col) + circ(x, y - 8, 2, INK) + circ(x, y + 8, 2, INK)
  }
  function smoke(x, y, k) { var o = ''; for (var i = 0; i < 3; i++) o += '<circle class="lab-smoke s' + i + '" cx="' + (x + (i - 1) * 6) + '" cy="' + y + '" r="' + (5 + k) + '"/>'; return o }

  function draw(c, live, ctx) {
    var p = SC.propsOf(c), L = live || {}, st = L.state || {}, i, n, xs, o = '', status = L.status
    var energized = L.i > 0.005 || (L.v > 20)
    var burnt = status === 'burnt', ink = INK
    switch (c.type) {
      case 'src1': o += rect(-50, -40, 100, 80, '#f4f7fb', ink, 2, 6) + tx(ctx, 0, -6, p.volts + ' V', 15, ink, 'middle', true) + (ctx.rot % 2 ? '' : tx(ctx, 0, 12, 'AC source', 10, MUTED)) + ln(-20, 40, -20, 60) + ln(20, 40, 20, 60) + tx(ctx, -20, 32, 'L', 10, ink) + tx(ctx, 20, 32, 'N', 10, ink)
        if (status === 'destroyed') o += tx(ctx, 0, 12, 'DESTROYED', 11, RED, 'middle', true); break
      case 'src2': o += rect(-60, -40, 120, 80, '#f4f7fb', ink, 2, 6) + tx(ctx, 0, -6, p.vln * 2 + ' V', 15, ink, 'middle', true) + (ctx.rot % 2 ? '' : tx(ctx, 0, 12, 'split-phase', 10, MUTED)) + ln(-40, 40, -40, 60) + ln(0, 40, 0, 60) + ln(40, 40, 40, 60) + tx(ctx, -40, 32, 'L1', 10) + tx(ctx, 0, 32, 'N', 10) + tx(ctx, 40, 32, 'L2', 10)
        if (status === 'destroyed') o += tx(ctx, 0, 12, 'DESTROYED', 11, RED, 'middle', true); break
      case 'src3': o += rect(-80, -40, 160, 80, '#f4f7fb', ink, 2, 6) + tx(ctx, 0, -6, p.vll + ' V 3-phase', 15, ink, 'middle', true) + (ctx.rot % 2 ? '' : tx(ctx, 0, 12, 'wye, neutral grounded', 10, MUTED))
        ;[-60, -20, 20, 60].forEach(function (x, k) { o += ln(x, 40, x, 60) + tx(ctx, x, 32, ['L1', 'L2', 'L3', 'N'][k], 10) })
        if (status === 'destroyed') o += tx(ctx, 0, 12, 'DESTROYED', 11, RED, 'middle', true); break
      case 'gnd': o += ln(0, -20, 0, 0) + ln(-14, 0, 14, 0) + ln(-9, 6, 9, 6) + ln(-4, 12, 4, 12); break
      case 'sw': { var on = !!p.on, col = (on && energized) ? LIVE : ink
        o += ln(0, -40, 0, -18, col) + ln(0, 20, 0, 40, on && energized ? LIVE : ink) + circ(0, -18, 3, '#fff', ink) + circ(0, 20, 3, '#fff', ink) + ln(0, -18, on ? 0 : -18, on ? 20 : 14, col, 3); break }
      case 'sw2': { var pos = p.pos === 2 ? 2 : 1, tgt = pos === 1 ? -20 : 20
        o += ln(0, -40, 0, -18) + ln(-20, 40, -20, 20) + ln(20, 40, 20, 20) + circ(0, -18, 3, '#fff', ink) + circ(-20, 20, 3, '#fff', ink) + circ(20, 20, 3, '#fff', ink) + ln(0, -18, tgt, 20, energized ? LIVE : ink, 3) + tx(ctx, -20, 12, '1', 9, MUTED) + tx(ctx, 20, 12, '2', 9, MUTED); break }
      case 'pbno': case 'pbnc': { var pr = !!st.pressed, no = c.type === 'pbno', closed = no ? pr : !pr, cc = closed && energized ? LIVE : ink
        o += ln(0, -40, 0, -10, cc) + ln(0, 10, 0, 40, cc)
        if (no) { o += ln(-12, -6, 12, -6 + (pr ? 12 : 0), ink, 3) } else { o += ln(-12, pr ? -14 : -2, 12, pr ? -14 : -2, ink, 3) + circ(0, -10, 2, ink) }
        o += ln(0, pr ? 0 : -14, 0, pr ? -24 : -28, '#999', 1.5, ' stroke-dasharray="2 2"') + rect(-12, pr ? -34 : -36, 24, 8, pr ? '#ffb4a8' : '#ffd0c8', RED, 2, 3)
        o += tx(ctx, 30, 4, no ? 'NO' : 'NC', 10, MUTED, 'start', true); break }
      case 'estop': { var lat = !!p.latched
        o += ln(0, -40, 0, -10, lat ? ink : (energized ? LIVE : ink)) + ln(0, 10, 0, 40, lat ? ink : (energized ? LIVE : ink)) + circ(0, -10, 2, ink) + circ(0, 10, 2, ink) + ln(0, 10, lat ? 12 : 0, lat ? -4 : -10, ink, 3)
        o += '<circle cx="0" cy="' + (lat ? -22 : -26) + '" r="12" fill="' + (lat ? '#8a1c1c' : '#e53935') + '" stroke="#611" stroke-width="2"/>' + tx(ctx, 30, 4, 'E-STOP', 9, lat ? RED : MUTED, 'start', true); break }
      case 'fuse': { var bl = status === 'blown', cf = bl ? RED : (energized ? LIVE : ink)
        o += ln(0, -40, 0, -20, cf) + ln(0, 20, 0, 40, cf) + rect(-8, -20, 16, 40, bl ? '#fde3e3' : '#fff', ink, 2, 3)
        o += bl ? ln(0, -20, 0, -4, ink, 1.5) + ln(0, 4, 0, 20, ink, 1.5) + tx(ctx, 0, 4, '✕', 12, RED, 'middle', true) : ln(0, -20, 0, 20, ink, 1.5)
        o += tx(ctx, 20, 4, p.amps + ' A', 10, MUTED, 'start', true); if (bl) o += tx(ctx, 20, 18, 'BLOWN', 9, RED, 'start', true); break }
      case 'brk': { n = p.poles || 1; xs = []; for (i = 0; i < n; i++) xs.push(-20 * (n - 1) + 40 * i)
        var tr = status === 'tripped', onb = p.on && !tr, w0 = xs[0] - 22, w1 = xs[n - 1] + 22
        o += rect(w0, -40, w1 - w0, 80, tr ? '#fde3e3' : '#fff', ink, 2, 4)
        xs.forEach(function (x) { o += ln(x, -60, x, -40, onb && energized ? LIVE : ink) + ln(x, 40, x, 60, onb && energized ? LIVE : ink) + circ(x, -20, 2.5, '#fff', ink) + circ(x, 20, 2.5, '#fff', ink) + ln(x, -20, onb ? x : x - 9, onb ? 20 : 14, onb && energized ? LIVE : ink, 2.5) })
        o += '<rect x="-6" y="' + (onb ? -38 : (tr ? -32 : -26)) + '" width="12" height="14" rx="2" fill="' + (tr ? RED : (onb ? '#2e7d32' : '#9aa5b1')) + '" stroke="' + ink + '" stroke-width="1.5"/>'
        o += tx(ctx, 0, 36, p.amps + 'A', 10, ink, 'middle', true) + tx(ctx, w1 + 6, 4, tr ? 'TRIPPED' : (p.on ? 'ON' : 'OFF'), 9, tr ? RED : MUTED, 'start', true); break }
      case 'ol': { var tro = status === 'tripped'
        o += rect(-60, -40, 120, 80, tro ? '#fde3e3' : '#f4f7fb', ink, 2, 4) + tx(ctx, 0, 4, 'OVERLOAD ' + p.amps + ' A', 10, ink, 'middle', true)
        ;[-40, 0, 40].forEach(function (x, k) { o += ln(x, -60, x, -40) + ln(x, 40, x, 60) + path('M' + x + ' -40 l0 6 l-5 4 l10 6 l-10 6 l10 6 l-5 4 l0 6', ink, 1.5) + tx(ctx, x, -46, 'L' + (k + 1), 8, MUTED) + tx(ctx, x, 54, 'T' + (k + 1), 8, MUTED) })
        o += ln(60, -20, 44, -20) + ln(60, 20, 44, 20) + circ(44, -20, 2, ink) + circ(44, 20, 2, ink) + ln(44, -20, tro ? 56 : 44, tro ? 0 : 20, ink, 2) + tx(ctx, 66, -24, '95', 8, MUTED, 'start') + tx(ctx, 66, 30, '96', 8, MUTED, 'start')
        if (tro) o += tx(ctx, 0, 20, 'TRIPPED', 10, RED, 'middle', true) ; break }
      case 'lamp': { var br = L.brightness || 0
        if (burnt) o += circ(0, 0, 18, '#222', ink) + ln(-12, -12, 12, 12, '#777') + ln(-12, 12, 12, -12, '#777') + smoke(0, -20, 0) + tx(ctx, 30, 4, 'BURNT', 9, RED, 'start', true)
        else o += (br > 0.02 ? '<circle cx="0" cy="0" r="' + (24 + br * 10) + '" fill="rgba(255,214,64,' + Math.min(0.75, br * 0.6) + ')"/>' : '') + circ(0, 0, 18, br > 0.05 ? 'rgba(255,236,140,' + Math.min(1, 0.4 + br * 0.6) + ')' : '#fff', ink) + ln(-12, -12, 12, 12) + ln(-12, 12, 12, -12) + (br > 1.15 ? tx(ctx, 30, 4, 'TOO BRIGHT', 8, RED, 'start', true) : '')
        o += ln(0, -40, 0, -18, energized ? LIVE : ink) + ln(0, 18, 0, 40, energized ? LIVE : ink) + (burnt ? '' : tx(ctx, 28, 18, p.watts + 'W ' + p.volts + 'V', 8, MUTED, 'start')); break }
      case 'heater': { var bh = L.brightness || 0
        o += ln(0, -40, 0, -20, energized ? LIVE : ink) + ln(0, 20, 0, 40, energized ? LIVE : ink)
        o += rect(-12, -20, 24, 40, burnt ? '#333' : (bh > 0.05 ? 'rgba(255,120,50,' + Math.min(1, 0.2 + bh * 0.7) + ')' : '#fff'), ink, 2, 3)
        o += path('M0 -20 l8 5 l-16 10 l16 10 l-16 10 l8 5', burnt ? '#777' : ink, 1.5)
        if (burnt) o += smoke(0, -24, 0) + tx(ctx, 30, 4, 'BURNT', 9, RED, 'start', true); else o += tx(ctx, 20, 18, p.watts + 'W ' + p.volts + 'V', 8, MUTED, 'start'); break }
      case 'motor1': { o += ln(0, -40, 0, -26, energized ? LIVE : ink) + ln(0, 26, 0, 40, energized ? LIVE : ink) + circ(0, 0, 26, burnt ? '#333' : '#fff', ink, 2.5)
        o += '<g class="spin" data-spin="' + c.id + '">' + ln(0, 0, 0, -18, burnt ? '#777' : '#1B5FC0', 3) + ln(0, 0, 14, 10, burnt ? '#777' : '#1B5FC0', 3) + ln(0, 0, -14, 10, burnt ? '#777' : '#1B5FC0', 3) + '</g>' + circ(0, 0, 4, ink, ink)
        o += tx(ctx, 34, 4, p.volts + 'V', 9, MUTED, 'start') + tx(ctx, 34, 16, p.fla + 'A', 9, MUTED, 'start'); if (burnt) o += smoke(0, -28, 1) + tx(ctx, 34, -8, 'BURNT', 9, RED, 'start', true); else if (st.overheated) o += smoke(0, -28, 0) + tx(ctx, 34, -8, 'HOT', 9, RED, 'start', true); break }
      case 'motor3': { var X = [-40, 0, 40]
        X.forEach(function (x, k) { o += ln(x, -60, x * 0.55, -30, energized ? LIVE : ink) + tx(ctx, x, -64, 'T' + (k + 1), 8, MUTED) })
        o += circ(0, 0, 34, burnt ? '#333' : '#fff', ink, 2.5) + '<g class="spin" data-spin="' + c.id + '">' + ln(0, 0, 0, -24, burnt ? '#777' : '#1B5FC0', 3) + ln(0, 0, 21, 12, burnt ? '#777' : '#1B5FC0', 3) + ln(0, 0, -21, 12, burnt ? '#777' : '#1B5FC0', 3) + '</g>' + circ(0, 0, 5, ink, ink)
        o += tx(ctx, 0, 52, p.volts + 'V ' + p.fla + 'A 3φ', 9, MUTED); if (burnt) o += smoke(0, -34, 2) + tx(ctx, 44, 0, 'BURNT', 9, RED, 'start', true); else if (L.singlePhase) o += tx(ctx, 44, 0, 'LOST A PHASE', 9, RED, 'start', true); else if (L.stalled) o += tx(ctx, 44, 0, 'STALLED', 9, RED, 'start', true); else if (st.overheated) o += smoke(0, -34, 1) + tx(ctx, 44, 0, 'HOT', 9, RED, 'start', true); break }
      case 'coil': { var en = L.energized
        o += ln(0, -40, 0, -20, en ? LIVE : ink) + ln(0, 20, 0, 40, en ? LIVE : ink) + circ(0, 0, 20, burnt ? '#333' : (en ? '#ffe28a' : '#fff'), ink, 2.5) + tx(ctx, 0, 4, p.tag, 12, burnt ? '#aaa' : ink, 'middle', true)
        o += tx(ctx, 26, 4, p.kind === 'timer' ? (p.mode === 'off' ? 'TOF ' : 'TON ') + p.delay + 's' : p.volts + 'V coil', 8, MUTED, 'start'); if (burnt) o += smoke(0, -22, 0); break }
      case 'cnt': { var tg = (L.state && null) || null, closedLive = !!(L.closed), f = p.form
        var col2 = closedLive ? (energized ? LIVE : '#2e7d32') : ink
        o += ln(0, -40, 0, -7, col2) + ln(0, 7, 0, 40, col2) + ln(-12, -7, 12, -7, col2, 3) + ln(-12, 7, 12, 7, col2, 3)
        if (f === 'NC' || f === 'NCTD') o += ln(-14, 11, 14, -11, ink, 2)
        if (f === 'NOTD' || f === 'NCTD') o += tx(ctx, 20, -12, 'T', 9, ink, 'start', true)
        o += tx(ctx, 20, 4, p.tag, 10, ink, 'start', true) + tx(ctx, 20, 16, f, 8, MUTED, 'start'); break }
      case 'cpoles': { n = p.poles || 3; xs = []; for (i = 0; i < n; i++) xs.push(-20 * (n - 1) + 40 * i)
        var cl = !!L.closed
        xs.forEach(function (x) { o += ln(x, -40, x, -10, cl && energized ? LIVE : ink) + ln(x, 10, x, 40, cl && energized ? LIVE : ink) + circ(x, -10, 2.5, '#fff', ink) + circ(x, 10, 2.5, '#fff', ink) + ln(x, -10, cl ? x : x - 10, cl ? 10 : 6, cl && energized ? LIVE : ink, 2.5) })
        o += ln(xs[0] - 8, 0, xs[n - 1] + 8, 0, '#8a94a6', 1, ' stroke-dasharray="3 3"') + tx(ctx, xs[n - 1] + 18, 4, p.tag, 11, ink, 'start', true) + tx(ctx, xs[n - 1] + 18, 16, cl ? 'closed' : 'open', 8, cl ? LIVE : MUTED, 'start'); break }
      case 'xfmr1': { var ct = p.ct, bt = !!(status === 'burnt')
        o += ln(-40, -60, -40, -20) + ln(40, -60, 40, -20) + ln(-40, 60, -40, 20) + ln(40, 60, 40, 20) + (ct ? ln(0, 60, 0, 20) : '')
        o += path(arcs(-40, -20, 4, 20, true), bt ? '#777' : ink, 2) + path(arcs(-40, 20, 4, 20, false), bt ? '#777' : ink, 2) + ln(-46, -3, 46, -3, ink, 2) + ln(-46, 3, 46, 3, ink, 2)
        o += tx(ctx, 66, -8, p.vp + ' → ' + p.vs + ' V', 9, MUTED, 'start') + tx(ctx, 66, 4, p.kva + ' kVA', 9, MUTED, 'start')
        o += tx(ctx, -52, -40, 'H1', 8, MUTED, 'end') + tx(ctx, 52, -40, 'H2', 8, MUTED, 'start') + tx(ctx, -52, 44, 'X1', 8, MUTED, 'end') + tx(ctx, 52, 44, 'X2', 8, MUTED, 'start') + (ct ? tx(ctx, 0, 44, 'X0', 8, MUTED) : '')
        if (L.vsec !== undefined && L.vsec !== null) o += tx(ctx, 66, 20, 'out ' + num(L.vsec) + ' V', 9, ink, 'start', true)
        if (bt) o += smoke(0, -24, 1) + tx(ctx, 66, 34, 'BURNT', 9, RED, 'start', true); break }
      case 'xfmr3': { var cn = p.conn || 'dy', xwy = cn[0] === 'y', xs2 = cn[1] === 'y', bt3 = status === 'burnt', rx = (xwy || xs2) ? 100 : 60
        o += rect(-60, -40, 120, 80, bt3 ? '#ddd' : '#f4f7fb', ink, 2, 4)
        ;[-40, 0, 40].forEach(function (x) { o += ln(x, -60, x, -40) + ln(x, 40, x, 60) })
        if (xwy) o += ln(80, -60, 80, -52) + ln(60, -52, 80, -52); if (xs2) o += ln(80, 60, 80, 52) + ln(60, 52, 80, 52)
        function glyph(kind, y) { return kind === 'd' ? path('M-14 ' + (y + 10) + ' L0 ' + (y - 12) + ' L14 ' + (y + 10) + ' Z', ink, 2) : path('M-12 ' + (y - 11) + ' L0 ' + y + ' L12 ' + (y - 11) + ' M0 ' + y + ' L0 ' + (y + 12), ink, 2) }
        o += glyph(cn[0], -18) + glyph(cn[1], 18) + tx(ctx, 34, -16, p.vp + ' V', 9, MUTED, 'start') + tx(ctx, 34, 24, p.vs + ' V', 9, MUTED, 'start') + tx(ctx, -26, 4, p.kva + 'kVA', 8, MUTED, 'end')
        o += tx(ctx, -40, -46, 'H1', 8, MUTED) + tx(ctx, 0, -46, 'H2', 8, MUTED) + tx(ctx, 40, -46, 'H3', 8, MUTED) + tx(ctx, -40, 54, 'X1', 8, MUTED) + tx(ctx, 0, 54, 'X2', 8, MUTED) + tx(ctx, 40, 54, 'X3', 8, MUTED)
        if (xwy) o += tx(ctx, 80, -62, 'H0', 8, MUTED, 'middle'); if (xs2) o += tx(ctx, 80, 72, 'X0', 8, MUTED, 'middle')
        if (bt3) o += smoke(0, -42, 1) + tx(ctx, 0, 4, 'BURNT', 10, RED, 'middle', true); break }
      case 'vm': case 'am': { var isV = c.type === 'vm'
        o += ln(0, -40, 0, -22, energized ? LIVE : ink) + ln(0, 22, 0, 40, energized ? LIVE : ink) + circ(0, 0, 22, '#fff', ink, 2.5) + tx(ctx, 0, 6, isV ? 'V' : 'A', 18, ink, 'middle', true)
        if (L.reading !== undefined) o += tx(ctx, 30, 4, num(L.reading) + (isV ? ' V' : ' A'), 11, LIVE, 'start', true); break }
    }
    return o
  }

  var LABELS = {}
  Object.keys(SC.TYPES).forEach(function (k) { LABELS[k] = SC.TYPES[k].label })
  root.LabSym = { layout: layout, draw: draw, LABELS: LABELS, INK: INK }
})(typeof self !== 'undefined' ? self : this)
