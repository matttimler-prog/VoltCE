/* VoltCE Circuit Lab: editor and live simulation UI. Needs sim-core.js and lab-sym.js. */
(function (root) {
  'use strict'
  var SC = root.SimCore, SYM = root.LabSym, NS = 'http://www.w3.org/2000/svg'
  var GRID = 20
  var Lab = { version: 1 }
  var M, V, el = {}, sim = null, running = false, speed = 1, sel = null, pend = null, drag = null, pan = null, hist = [], histI = -1, last = 0, acc = 0, rafId = 0
  var live = null, cache = {}, wireEl = {}, compEl = {}, events = [], toastT = 0, spinAng = {}, basic = true, mounted = null, challenge = null, chalOK = 0
  var BASIC = { src1: 1, src2: 1, gnd: 1, sw: 1, sw2: 1, fuse: 1, brk: 1, lamp: 1, heater: 1, motor1: 1, vm: 1, am: 1, pbno: 1, pbnc: 1 }
  var PREFIX = { src1: 'V', src2: 'V', src3: 'V', gnd: 'GND', sw: 'S', sw2: 'S', pbno: 'PB', pbnc: 'PB', estop: 'ES', fuse: 'F', brk: 'CB', ol: 'OL', lamp: 'LP', heater: 'HTR', motor1: 'M', motor3: 'M', coil: 'K', cnt: 'K', cpoles: 'K', xfmr1: 'T', xfmr3: 'T', vm: 'VM', am: 'AM' }
  var ENUMS = { conn: [['dy', 'Δ–Y (delta primary, wye secondary)'], ['yd', 'Y–Δ'], ['yy', 'Y–Y'], ['dd', 'Δ–Δ']], kind: [['relay', 'Control relay'], ['contactor', 'Contactor'], ['timer', 'Timer relay']], mode: [['on', 'On-delay (TON)'], ['off', 'Off-delay (TOF)']],
    form: [['NO', 'Normally open'], ['NC', 'Normally closed'], ['NOTD', 'NO, timed closing'], ['NCTD', 'NC, timed opening']], poles: [[1, '1 pole'], [2, '2 poles'], [3, '3 poles']], pos: [[1, 'Position 1'], [2, 'Position 2']] }
  var NICE = { volts: 'Voltage (V)', vln: 'Line-to-neutral (V)', vll: 'Line-to-line (V)', avail: 'Available fault current (A)', amps: 'Rating (A)', watts: 'Watts', fla: 'Full-load amps', pf: 'Power factor', tag: 'Tag', delay: 'Delay (s)', vp: 'Primary (V)', vs: 'Secondary (V)', kva: 'kVA', ct: 'Center-tapped secondary', zpu: 'Impedance (per unit)', kind: 'Type', mode: 'Mode', form: 'Contact type', conn: 'Connection', poles: 'Poles', pos: 'Position', on: 'On', latched: 'Latched (pressed in)' }
  var HELP = {
    src1: 'Single-phase 120 V service. The N terminal is bonded to ground, like a real panel.', src2: '240 V split-phase: L1 to L2 is 240 V, either leg to N is 120 V.', src3: '3-phase wye service. Each line to neutral is the line-to-line voltage ÷ 1.73.',
    gnd: 'Equipment ground. It is bonded to the neutral at the source, so a hot wire touching it is a ground fault.', sw: 'Click it while power is on to flip it.', sw2: 'Click to switch position. Two of these make a 3-way circuit.',
    pbno: 'Normally open: it conducts only while you hold it down.', pbnc: 'Normally closed: it opens only while you hold it down.', estop: 'Normally closed. Click to latch it open; click again to release.',
    fuse: 'Blows if the current stays too high, or instantly in a short. Click a blown fuse to replace it.', brk: 'Trips on overload (slowly) or a short (instantly). Click to reset, then click again to turn it on.',
    ol: 'Protects a motor from overload. Its 95-96 contact opens when it trips; wire that contact in series with the contactor coil.', lamp: 'Rated for its voltage. Too much voltage and it burns out.',
    heater: 'A resistive heater. Wrong voltage means it runs cold or burns out.', motor1: 'Single-phase motor.', motor3: 'Three-phase motor. Swap two lines to reverse it. Lose a line and it single-phases.',
    coil: 'The coil of a relay, contactor or timer. Contacts with the same tag follow it.', cnt: 'A contact that follows the coil with the same tag.', cpoles: 'The power contacts of a contactor. They close when the coil with the same tag is energized.',
    xfmr1: 'Steps voltage up or down. Set the primary and secondary to match your source and load.', xfmr3: 'Three-phase transformer bank. Pick the connection (Δ–Y, Y–Δ, Y–Y or Δ–Δ).', vm: 'Voltmeter: connect it across what you want to measure.', am: 'Ammeter: connect it in series, in the line.' }

  function $(s, r) { return (r || document).querySelector(s) }
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function snap(v) { return Math.round(v / GRID) * GRID }
  function clone(o) { return JSON.parse(JSON.stringify(o)) }
  function find(id) { for (var i = 0; i < M.comps.length; i++) if (M.comps[i].id === id) return M.comps[i] }
  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) { return false } }

  /* ---------------- model ---------------- */
  function blank() { return { comps: [], wires: [], nid: 1 } }
  function uid(type) { var pre = PREFIX[type] || 'X', n = 1; while (find(pre + n)) n++; return pre + n }
  function rot(pt, r) { var x = pt[0], y = pt[1], i; for (i = 0; i < (r || 0); i++) { var t = x; x = -y; y = t } return [x, y] }
  function termPos(c, t) { var L = SYM.layout(c).terms[t]; if (!L) return null; var q = rot(L, c.rot); return [c.x + q[0], c.y + q[1]] }
  function termDir(c, t) {
    var L = SYM.layout(c), p = L.terms[t], b = L.box; if (!p) return [0, 1]
    var n
    if (p[1] > b[3]) n = [0, 1]; else if (p[1] < b[1]) n = [0, -1]; else if (p[0] > b[2]) n = [1, 0]; else if (p[0] < b[0]) n = [-1, 0]
    else { var d = [Math.abs(p[0] - b[0]), Math.abs(p[0] - b[2]), Math.abs(p[1] - b[1]), Math.abs(p[1] - b[3])], m = Math.min.apply(null, d), v = d.indexOf(m)
      n = v === 0 ? [-1, 0] : v === 1 ? [1, 0] : v === 2 ? [0, -1] : [0, 1] }
    return rot(n, c.rot)
  }
  function termKeys(c) { return SC.termsOf(c).map(function (t) { return c.id + '.' + t }) }
  function splitKey(k) { var i = k.indexOf('.'); return [k.slice(0, i), k.slice(i + 1)] }
  function posOfKey(k) { var s = splitKey(k), c = find(s[0]); return c ? termPos(c, s[1]) : null }
  function dirOfKey(k) { var s = splitKey(k), c = find(s[0]); return c ? termDir(c, s[1]) : [0, 1] }

  function wirePts(w) {
    var p0 = posOfKey(w.a), p1 = posOfKey(w.b); if (!p0 || !p1) return null
    var d0 = dirOfKey(w.a), d1 = dirOfKey(w.b), s = [p0[0] + d0[0] * GRID, p0[1] + d0[1] * GRID], e = [p1[0] + d1[0] * GRID, p1[1] + d1[1] * GRID], pts = [p0, s], mid
    var h0 = d0[0] !== 0, h1 = d1[0] !== 0
    if (w.via && w.via.length) { w.via.forEach(function (q) { pts.push([q[0], q[1]]) }) }
    else if (h0 && h1) { mid = snap((s[0] + e[0]) / 2); if (d0[0] > 0 && s[0] > e[0] || d0[0] < 0 && s[0] < e[0]) mid = d0[0] > 0 ? Math.max(s[0], e[0]) : Math.min(s[0], e[0]); pts.push([mid, s[1]], [mid, e[1]]) }
    else if (!h0 && !h1) { mid = snap((s[1] + e[1]) / 2); if (d0[1] > 0 && s[1] > e[1] || d0[1] < 0 && s[1] < e[1]) mid = d0[1] > 0 ? Math.max(s[1], e[1]) : Math.min(s[1], e[1]); pts.push([s[0], mid], [e[0], mid]) }
    else if (h0) pts.push([e[0], s[1]]); else pts.push([s[0], e[1]])
    pts.push(e, p1)
    var out = []; pts.forEach(function (q) { var l = out[out.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) out.push(q) })
    return out
  }
  function ptsToD(pts) { return pts.map(function (q, i) { return (i ? 'L' : 'M') + q[0] + ' ' + q[1] }).join(' ') }

  /* ---------------- history ---------------- */
  function snapshot() { hist = hist.slice(0, histI + 1); hist.push(JSON.stringify(M)); if (hist.length > 80) hist.shift(); histI = hist.length - 1; autosave() }
  function undo(d) { var i = histI + d; if (i < 0 || i >= hist.length || running) return; histI = i; M = JSON.parse(hist[i]); sel = null; renderAll(); inspector(); autosave() }
  function autosave() { try { localStorage.setItem('voltce_lab_v1', JSON.stringify(M)) } catch (e) {} }

  /* ---------------- rendering ---------------- */
  function svgEl(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e }
  function applyView() { el.world.setAttribute('transform', 'translate(' + V.x + ' ' + V.y + ') scale(' + V.k + ')'); el.svg.style.backgroundPosition = V.x + 'px ' + V.y + 'px'; el.svg.style.backgroundSize = (GRID * V.k) + 'px ' + (GRID * V.k) + 'px' }
  function compGroupHTML(c) {
    var L = live && live.comp[c.id], ctx = { rot: c.rot || 0 }, lay = SYM.layout(c), b = lay.box
    var body = SYM.draw(c, L ? Object.assign({}, L, { state: L.state }) : (running ? {} : null), ctx)
    var terms = ''
    Object.keys(lay.terms).forEach(function (t) {
      var q = lay.terms[t], hot = live && live.termV && live.termV[c.id + '.' + t] > 5
      terms += '<circle class="lab-term' + (hot ? ' hot' : '') + (pend && pend.a === c.id + '.' + t ? ' pend' : '') + '" data-term="' + c.id + '.' + t + '" cx="' + q[0] + '" cy="' + q[1] + '" r="5"><title>' + esc(c.id + ' ' + t) + '</title></circle>'
    })
    var label = c.label !== undefined ? c.label : c.id
    var lx = 0, ly = b[3] + 14
    var selBox = sel && sel.kind === 'comp' && sel.id === c.id ? '<rect class="lab-selbox" x="' + (b[0] - 4) + '" y="' + (b[1] - 4) + '" width="' + (b[2] - b[0] + 8) + '" height="' + (b[3] - b[1] + 8) + '" rx="6"/>' : ''
    return selBox + '<rect class="lab-hit" x="' + b[0] + '" y="' + b[1] + '" width="' + (b[2] - b[0]) + '" height="' + (b[3] - b[1]) + '"/>' + body + terms
  }
  function renderComp(c) {
    var g = compEl[c.id]
    if (!g) { g = svgEl('g', { 'data-comp': c.id, class: 'lab-comp' }); el.comps.appendChild(g); compEl[c.id] = g }
    g.setAttribute('transform', 'translate(' + c.x + ' ' + c.y + ') rotate(' + (90 * (c.rot || 0)) + ')')
    var html = compGroupHTML(c)
    if (cache[c.id] !== html) { cache[c.id] = html; g.innerHTML = html }
    // name label (not rotated)
    var lab = g._lab
    if (!lab) { lab = svgEl('text', { class: 'lab-name', 'text-anchor': 'middle' }); g._lab = lab; el.labels.appendChild(lab) }
    var b = SYM.layout(c).box, ang = (c.rot || 0) % 4, ly = c.y + (ang % 2 ? (b[2] - b[0]) / 2 + 14 : b[3] + 14)
    lab.setAttribute('x', c.x); lab.setAttribute('y', ly); lab.textContent = c.label !== undefined ? c.label : c.id
    g.classList.toggle('sel', !!(sel && sel.kind === 'comp' && sel.id === c.id))
  }
  function renderWire(w) {
    var pts = wirePts(w), g = wireEl[w.id]; if (!pts) { if (g) { g.remove(); delete wireEl[w.id] } return }
    if (!g) {
      g = svgEl('g', { class: 'lab-wire', 'data-wire': w.id })
      g._hit = svgEl('path', { class: 'lab-wire-hit' }); g._base = svgEl('path', { class: 'lab-wire-base' }); g._flow = svgEl('path', { class: 'lab-wire-flow' })
      g.appendChild(g._hit); g.appendChild(g._base); g.appendChild(g._flow); el.wires.appendChild(g); wireEl[w.id] = g
    }
    var d = ptsToD(pts); g._hit.setAttribute('d', d); g._base.setAttribute('d', d); g._flow.setAttribute('d', d); g._pts = pts
    g.classList.toggle('sel', !!(sel && sel.kind === 'wire' && sel.id === w.id))
  }
  function renderAll() {
    el.comps.innerHTML = ''; el.wires.innerHTML = ''; el.labels.innerHTML = ''; compEl = {}; wireEl = {}; cache = {}
    M.wires.forEach(renderWire); M.comps.forEach(renderComp)
    updateLive(); updateButtons()
  }
  function updateLive() {
    if (!live) { M.wires.forEach(function (w) { var g = wireEl[w.id]; if (g) { g._base.removeAttribute('style'); g.classList.remove('hot', 'big'); g._flow.style.opacity = 0 } }); return }
    M.wires.forEach(function (w) {
      var g = wireEl[w.id], r = live.wire[w.id]; if (!g || !r) return
      var hot = r.v > 5
      g.classList.toggle('hot', hot); g.classList.toggle('big', r.i > 60)
      if (r.i > 0.015) {
        var sp = Math.max(0.35, 1.4 - Math.log10(1 + r.i) * 0.55)
        g._flow.style.opacity = 1; g._flow.style.animationDuration = sp + 's'; g._flow.style.animationDirection = r.sgn >= 0 ? 'normal' : 'reverse'
        g._flow.setAttribute('stroke-width', r.i > 30 ? 5 : r.i > 3 ? 4 : 3)
      } else g._flow.style.opacity = 0
    })
    M.comps.forEach(renderComp)
    spinRefresh()
  }
  var spinEls = []
  function spinRefresh() { spinEls = Array.prototype.slice.call(el.comps.querySelectorAll('[data-spin]')) }
  function spinTick(dt) {
    spinEls.forEach(function (n) {
      var id = n.getAttribute('data-spin'), L = live && live.comp[id]; if (!L) return
      var sp = L.speed || 0, dir = L.dir || 1
      if (L.stalled) { spinAng[id] = (spinAng[id] || 0) + (Math.random() - .5) * 8 } else spinAng[id] = (spinAng[id] || 0) + dir * sp * 540 * dt
      n.setAttribute('transform', 'rotate(' + (spinAng[id] % 360).toFixed(1) + ')')
    })
  }

  /* ---------------- UI build ---------------- */
  function build(host) {
    host.innerHTML = ''
    var tb = h('div', 'lab-bar'), main = h('div', 'lab-main'), pal = h('div', 'lab-pal'), cvw = h('div', 'lab-cv'), ins = h('div', 'lab-ins')
    tb.innerHTML = '<button class="btn lab-power" id="lab-power" aria-pressed="false"><span class="dot"></span><span class="t">Power: off</span></button>' +
      '<button class="btn btn-ghost" id="lab-reset" title="Reset blown parts and restart">Reset</button>' +
      '<label class="lab-sel">Speed <select id="lab-speed"><option value="1">1×</option><option value="3">3×</option><option value="10">10×</option></select></label>' +
      '<span class="lab-sep"></span>' +
      '<label class="lab-sel">Examples <select id="lab-ex"><option value="">Pick one…</option></select></label>' +
      '<label class="lab-sel">Challenges <select id="lab-ch"><option value="">Pick one…</option></select></label>' +
      '<span class="lab-sep"></span>' +
      '<button class="btn btn-ghost" id="lab-undo" title="Undo (Ctrl+Z)">Undo</button><button class="btn btn-ghost" id="lab-redo" title="Redo">Redo</button>' +
      '<button class="btn btn-ghost" id="lab-clear">Clear</button>' +
      '<span class="lab-sep"></span>' +
      '<label class="lab-sel">Export <select id="lab-exp"><option value="">Choose…</option><option value="diagram">Wiring diagram (SVG)</option><option value="wires">Wire schedule (CSV)</option><option value="print">Wiring diagram (print / PDF)</option><option value="png">Schematic image (PNG)</option><option value="json">Save circuit (JSON)</option><option value="import">Open a saved circuit…</option></select></label>' +
      '<input type="file" id="lab-file" accept=".json,application/json" style="display:none">'
    cvw.innerHTML = '<div class="lab-banner" id="lab-banner" role="alert" hidden></div><div class="lab-goal" id="lab-goal" hidden></div>' +
      '<svg id="lab-svg" class="lab-svg" tabindex="0" aria-label="Circuit canvas"><defs></defs><g id="lab-world"><g id="lab-wires"></g><g id="lab-comps"></g><g id="lab-labels"></g><path id="lab-prev" class="lab-prev" d=""/></g></svg>' +
      '<div class="lab-hint" id="lab-hint"></div><div class="lab-zoom"><button class="btn btn-ghost" id="lab-zin" aria-label="Zoom in">+</button><button class="btn btn-ghost" id="lab-zout" aria-label="Zoom out">−</button><button class="btn btn-ghost" id="lab-fit" aria-label="Fit to screen">Fit</button></div>'
    main.appendChild(pal); main.appendChild(cvw); main.appendChild(ins)
    host.appendChild(tb); host.appendChild(main)
    el.host = host; el.pal = pal; el.ins = ins; el.svg = $('#lab-svg', host); el.world = $('#lab-world', host); el.wires = $('#lab-wires', host); el.comps = $('#lab-comps', host); el.labels = $('#lab-labels', host); el.prev = $('#lab-prev', host)
    el.banner = $('#lab-banner', host); el.goal = $('#lab-goal', host); el.hint = $('#lab-hint', host)
    buildPalette()
    bind(host)
  }
  function buildPalette() {
    var groups = {}, order = ['Sources', 'Controls', 'Protection', 'Loads', 'Relays', 'Transformers', 'Meters']
    Object.keys(SC.TYPES).forEach(function (k) { if (basic && !BASIC[k]) return; var t = SC.TYPES[k]; (groups[t.group] = groups[t.group] || []).push(k) })
    var html = '<div class="lab-pal-head"><strong>Parts</strong><label class="lab-sel"><select id="lab-mode"><option value="basic"' + (basic ? ' selected' : '') + '>Basic</option><option value="all"' + (!basic ? ' selected' : '') + '>All parts</option></select></label></div>'
    order.forEach(function (g) {
      if (!groups[g]) return
      html += '<div class="lab-grp"><div class="lab-grp-t">' + g + '</div><div class="lab-grp-i">'
      groups[g].forEach(function (k) {
        var c = { id: 'p', type: k, props: {}, rot: 0 }, lay = SYM.layout(c), b = lay.box, w = b[2] - b[0] + 20, hh = b[3] - b[1] + 20
        var svg = '<svg viewBox="' + (b[0] - 10) + ' ' + (b[1] - 10) + ' ' + w + ' ' + hh + '" width="' + Math.min(54, w * 0.5) + '" height="' + Math.min(54, hh * 0.5) + '">' + SYM.draw(c, null, { rot: 0 }) + '</svg>'
        html += '<button class="lab-part" data-add="' + k + '" title="' + esc(HELP[k] || '') + '">' + svg + '<span>' + esc(SC.TYPES[k].label) + '</span></button>'
      })
      html += '</div></div>'
    })
    el.pal.innerHTML = html
  }
  function updateButtons() {
    var p = $('#lab-power', el.host); if (!p) return
    p.setAttribute('aria-pressed', running ? 'true' : 'false'); p.classList.toggle('on', running); $('.t', p).textContent = 'Power: ' + (running ? 'ON' : 'off')
    el.host.classList.toggle('lab-running', running)
    $('#lab-undo', el.host).disabled = running || histI <= 0; $('#lab-redo', el.host).disabled = running || histI >= hist.length - 1
    el.hint.textContent = running ? 'Power is on. Click switches and buttons to operate the circuit. Turn power off to edit.' : (pend ? 'Now click the terminal to connect to (Esc cancels).' : 'Click a part to add it. Drag from one terminal to another to wire. Select and press R to rotate, Delete to remove.')
  }

  /* ---------------- inspector ---------------- */
  function inspector() {
    var box = el.ins
    var html = ''
    var evHTML = events.slice(0, 12).map(function (e) { return '<li class="ev-' + e.type + '"><span class="ev-t">' + e.t.toFixed(1) + 's</span> ' + esc(e.msg) + '</li>' }).join('')
    if (sel && sel.kind === 'comp') {
      var c = find(sel.id)
      if (c) {
        var p = SC.propsOf(c), L = live && live.comp[c.id], t = SC.TYPES[c.type]
        html += '<div class="lab-ins-h"><strong>' + esc(t.label) + '</strong><span class="muted"> ' + esc(c.id) + '</span></div><p class="lab-help">' + esc(HELP[c.type] || '') + '</p>'
        html += '<div class="lab-fields">'
        html += field('label', 'Name', c.label !== undefined ? c.label : c.id, 'text')
        Object.keys(t.defaults).forEach(function (k) {
          var v = p[k]
          if (ENUMS[k]) { if (k === 'mode' && p.kind !== 'timer') return; if (k === 'delay' && p.kind !== 'timer') return; html += fieldSel(k, NICE[k], v) }
          else if (typeof t.defaults[k] === 'boolean') html += fieldChk(k, NICE[k] || k, v)
          else if (typeof t.defaults[k] === 'number') { if (k === 'delay' && p.kind !== 'timer') return; html += field(k, NICE[k] || k, v, 'number') }
          else html += field(k, NICE[k] || k, v, 'text')
        })
        html += '</div><div class="lab-ins-btns"><button class="btn btn-ghost" data-act="rot"' + (running ? ' disabled' : '') + '>Rotate</button><button class="btn btn-ghost" data-act="dup"' + (running ? ' disabled' : '') + '>Duplicate</button><button class="btn btn-ghost lab-del" data-act="del"' + (running ? ' disabled' : '') + '>Delete</button></div>'
        if (L) html += readout(c, L)
      }
    } else if (sel && sel.kind === 'wire') {
      var w = M.wires.filter(function (x) { return x.id === sel.id })[0], r = live && w && live.wire[w.id]
      html += '<div class="lab-ins-h"><strong>Wire</strong></div><p class="lab-help">' + (w ? esc(w.a + '  →  ' + w.b) : '') + '</p>'
      if (r) html += '<div class="lab-read"><div><span>Voltage to ground</span><b>' + r.v.toFixed(1) + ' V</b></div><div><span>Current</span><b>' + (r.i >= 100 ? r.i.toFixed(0) : r.i.toFixed(2)) + ' A</b></div></div>'
      html += '<div class="lab-ins-btns"><button class="btn btn-ghost lab-del" data-act="del"' + (running ? ' disabled' : '') + '>Delete wire</button></div>'
    } else {
      html += '<div class="lab-ins-h"><strong>Circuit Lab</strong></div><p class="lab-help">Build a circuit, turn the power on, and see what happens. Wire it right and it works. Wire it wrong and it fails the way it would for real: trips, burns out or blows up.</p>' +
        '<ol class="lab-steps"><li>Pick an example, or drag in a source and a load.</li><li>Wire terminal to terminal.</li><li>Press <b>Power</b>.</li></ol>'
    }
    html += '<div class="lab-log-h">Events</div><ul class="lab-log">' + (evHTML || '<li class="muted">Nothing yet.</li>') + '</ul>'
    box.innerHTML = html
  }
  function field(k, label, v, type) { return '<label class="lab-f"><span>' + esc(label) + '</span><input data-prop="' + k + '" type="' + type + '" value="' + esc(v) + '"' + (type === 'number' ? ' step="any"' : '') + (running && k !== 'label' ? ' disabled' : '') + '></label>' }
  function fieldChk(k, label, v) { return '<label class="lab-f lab-chk"><input data-prop="' + k + '" type="checkbox"' + (v ? ' checked' : '') + (running && k !== 'on' && k !== 'latched' ? ' disabled' : '') + '><span>' + esc(label) + '</span></label>' }
  function fieldSel(k, label, v) { return '<label class="lab-f"><span>' + esc(label) + '</span><select data-prop="' + k + '"' + (running ? ' disabled' : '') + '>' + ENUMS[k].map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>' }).join('') + '</select></label>' }
  function readout(c, L) {
    var rows = [], f = function (n, u, d) { return (+n).toFixed(d === undefined ? 1 : d) + ' ' + u }
    if (L.status && L.status !== 'ok') rows.push(['Status', '<b class="bad">' + L.status.toUpperCase() + '</b>'])
    if (L.v !== undefined && L.v > 0.01) rows.push(['Voltage', f(L.v, 'V')])
    if (L.i !== undefined && L.i > 0.0005) rows.push(['Current', f(L.i, 'A', L.i < 10 ? 2 : 1)])
    if (L.p > 0.5) rows.push(['Real power', f(L.p, 'W', 0)])
    if (L.ratio !== undefined && L.ratio > 0 && /lamp|heater|motor|coil/.test(c.type)) rows.push(['Of rated voltage', Math.round(L.ratio * 100) + '%'])
    if (c.type === 'motor3' && L.running) rows.push(['Rotation', L.dir === 1 ? 'Forward' : 'Reversed'])
    if (/motor/.test(c.type)) rows.push(['State', L.running ? 'Running' : (L.stalled ? 'Stalled' : 'Stopped')])
    if (/motor|brk|fuse|ol|xfmr/.test(c.type)) rows.push(['Heat', '<span class="lab-heat"><i style="width:' + Math.min(100, Math.round((L.heat || 0) / (c.type === 'motor1' || c.type === 'motor3' ? 25 : c.type === 'xfmr1' || c.type === 'xfmr3' ? 15 : c.type === 'ol' ? 15 : c.type === 'fuse' ? 12 : 10) * 100)) + '%"></i></span>'])
    if (c.type.indexOf('xfmr') === 0 && L.vsec !== undefined) rows.push(['Secondary', f(L.vsec, 'V')], ['Rated current', f(L.ratedI || 0, 'A')], ['Loading', Math.round((L.ratio || 0) * 100) + '%'])
    if (c.type === 'coil') rows.push(['Coil', L.energized ? 'Energized' : 'Off'])
    if (c.type === 'vm' || c.type === 'am') rows.push(['Reading', f(L.reading || 0, c.type === 'vm' ? 'V' : 'A', 2)])
    return '<div class="lab-read">' + rows.map(function (r) { return '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>' }).join('') + '</div>'
  }

  /* ---------------- actions ---------------- */
  function addComp(type, x, y) {
    if (running) return
    var c = { id: uid(type), type: type, x: x, y: y, rot: 0, props: {} }
    if (type === 'coil') { var n = 1; M.comps.forEach(function (q) { if (q.type === 'coil') n++ }); c.props.tag = 'M' + n }
    if (type === 'cnt' || type === 'cpoles') { var last = null; M.comps.forEach(function (q) { if (q.type === 'coil') last = q }); if (last) c.props.tag = last.props.tag }
    M.comps.push(c); renderComp(c); select({ kind: 'comp', id: c.id }); snapshot(); return c
  }
  function viewCenter() { var r = el.svg.getBoundingClientRect(); return [snap((r.width / 2 - V.x) / V.k), snap((r.height / 2 - V.y) / V.k)] }
  function removeComp(id) {
    if (running) return
    M.wires = M.wires.filter(function (w) { return splitKey(w.a)[0] !== id && splitKey(w.b)[0] !== id })
    M.comps = M.comps.filter(function (c) { return c.id !== id }); sel = null; renderAll(); inspector(); snapshot()
  }
  function removeWire(id) { if (running) return; M.wires = M.wires.filter(function (w) { return w.id !== id }); sel = null; renderAll(); inspector(); snapshot() }
  function addWire(a, b) {
    if (a === b) return
    if (M.wires.some(function (w) { return (w.a === a && w.b === b) || (w.a === b && w.b === a) })) return
    var id = 'w' + (M.nid++); M.wires.push({ id: id, a: a, b: b }); renderWire(M.wires[M.wires.length - 1]); M.comps.forEach(renderComp); snapshot()
  }
  function select(s) { sel = s; M.comps.forEach(function (c) { var g = compEl[c.id]; if (g) g.classList.toggle('sel', !!(s && s.kind === 'comp' && s.id === c.id)); cache[c.id] = null; renderComp(c) }); M.wires.forEach(function (w) { var g = wireEl[w.id]; if (g) g.classList.toggle('sel', !!(s && s.kind === 'wire' && s.id === w.id)) }); inspector() }
  function setProp(c, k, raw) {
    var t = SC.TYPES[c.type]
    if (k === 'label') { c.label = String(raw); renderComp(c); return }
    var d = t.defaults[k], v = raw
    if (typeof d === 'number') { v = parseFloat(raw); if (!isFinite(v)) return } else if (typeof d === 'boolean') v = !!raw
    else if (k === 'pos' || k === 'poles') v = parseInt(raw, 10)
    c.props[k] = v
    if (k === 'poles' || k === 'conn' || k === 'ct') pruneWires(c)
    renderAll(); inspector()
  }
  function pruneWires(c) { var keys = {}; termKeys(c).forEach(function (k) { keys[k] = 1 }); M.wires = M.wires.filter(function (w) { return [w.a, w.b].every(function (k) { return splitKey(k)[0] !== c.id || keys[k] }) }) }

  /* ---------------- run ---------------- */
  function power(on) {
    if (on === running) return
    if (on) {
      pend = null; el.prev.setAttribute('d', '')
      sim = SC.create({ comps: M.comps, wires: M.wires }); running = true; events = []; live = null; acc = 0; last = performance.now()
      step(0.05); loop()
    } else { running = false; cancelAnimationFrame(rafId); live = null; sim = null; renderAll(); hideBanner() }
    updateButtons(); inspector()
  }
  function loop() {
    rafId = requestAnimationFrame(function (now) {
      if (!running) return
      var dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt * speed
      var n = 0; while (acc >= 0.05 && n < 12) { step(0.05); acc -= 0.05; n++ } if (acc > 0.6) acc = 0
      spinTick(dt * speed); loop()
    })
  }
  function step(dt) {
    var r = sim.step(dt); live = r; updateLive()
    if (r.events.length) r.events.forEach(onEvent)
    if (sel) liveInspectorTick(); if (challenge) checkChallenge(r)
  }
  var inspT = 0
  function liveInspectorTick() { var n = performance.now(); if (n - inspT < 250) return; inspT = n; if (sel && sel.kind === 'comp' && !el.ins.contains(document.activeElement)) inspector() }
  function fx(i) { if (reduced()) return; try { if (root.AnsFX) root.AnsFX.playIndex('bad', i) } catch (e) {} }
  function onEvent(e) {
    events.unshift(e); if (events.length > 40) events.pop()
    var sev = e.type === 'explode' || e.type === 'burn' ? 'bad' : (e.type === 'fault' || e.type === 'blow' || e.type === 'trip' || e.type === 'oltrip' ? 'warn' : 'info')
    if (e.type === 'explode') { fx(8); shake(); banner('💥 ' + e.msg, 'bad') }
    else if (e.type === 'burn') { var c = find(e.comp); fx(c && /^(motor|xfmr)/.test(c.type) ? 9 : 1); if (c && /^(motor|xfmr)/.test(c.type)) shake(); banner('🔥 ' + e.msg, 'bad') }
    else if (e.type === 'fault') { fx(5); banner('⚡ ' + e.msg, 'warn') }
    else if (e.type === 'blow') { fx(3); banner('⚠ ' + e.msg, 'warn') }
    else if (e.type === 'trip' || e.type === 'oltrip') banner('⚠ ' + e.msg, 'warn')
    else if (e.type === 'warn') banner('🌡 ' + e.msg, 'warn')
    inspector()
  }
  function banner(msg, kind) { el.banner.hidden = false; el.banner.className = 'lab-banner ' + kind; el.banner.textContent = msg; clearTimeout(toastT); toastT = setTimeout(hideBanner, kind === 'bad' ? 9000 : 6000) }
  function hideBanner() { if (el.banner) el.banner.hidden = true }
  function shake() { if (reduced()) return; el.svg.classList.remove('shake'); void el.svg.getBoundingClientRect(); el.svg.classList.add('shake'); setTimeout(function () { el.svg.classList.remove('shake') }, 600) }

  /* ---------------- pointer handling ---------------- */
  function worldPt(ev) { var r = el.svg.getBoundingClientRect(); return [(ev.clientX - r.left - V.x) / V.k, (ev.clientY - r.top - V.y) / V.k] }
  function bind(host) {
    var svg = el.svg
    host.addEventListener('click', function (ev) {
      var add = ev.target.closest('[data-add]'); if (add) { if (running) { banner('Turn power off to add parts.', 'warn'); return } var c = viewCenter(), n = M.comps.length; addComp(add.getAttribute('data-add'), c[0] + (n % 5) * 20, c[1] + (n % 5) * 20); return }
      var act = ev.target.closest('[data-act]'); if (act && sel && sel.kind) {
        var a = act.getAttribute('data-act')
        if (a === 'del') { sel.kind === 'comp' ? removeComp(sel.id) : removeWire(sel.id) }
        if (a === 'rot' && sel.kind === 'comp') rotate(find(sel.id))
        if (a === 'dup' && sel.kind === 'comp') { var s = find(sel.id), d = addComp(s.type, s.x + 40, s.y + 40); d.props = clone(s.props || {}); d.rot = s.rot; renderAll(); select({ kind: 'comp', id: d.id }); snapshot() }
      }
    })
    host.addEventListener('change', function (ev) {
      var t = ev.target
      if (t.id === 'lab-speed') { speed = +t.value; return }
      if (t.id === 'lab-mode') { basic = t.value === 'basic'; try { localStorage.setItem('voltce_lab_mode', t.value) } catch (e) {} buildPalette(); return }
      if (t.id === 'lab-ex') { if (t.value !== '') { Lab.loadExample(t.value) } t.value = ''; return }
      if (t.id === 'lab-ch') { if (t.value !== '') { Lab.startChallenge(t.value) } t.value = ''; return }
      if (t.id === 'lab-exp') { var v = t.value; t.value = ''; if (v === 'import') $('#lab-file', host).click(); else if (v && root.LabExport) root.LabExport.run(v, Lab); return }
      if (t.id === 'lab-file') { var f = t.files && t.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { try { Lab.load(JSON.parse(rd.result)) } catch (e) { banner('That file is not a saved circuit.', 'warn') } }; rd.readAsText(f); t.value = ''; return }
      var pk = t.getAttribute && t.getAttribute('data-prop'); if (pk && sel && sel.kind === 'comp') {
        var c = find(sel.id); if (!c) return
        var val = t.type === 'checkbox' ? t.checked : t.value
        if (running && (pk === 'on' || pk === 'latched')) { c.props[pk] = !!val; return }
        setProp(c, pk, val); snapshot()
      }
    })
    host.addEventListener('input', function (ev) { var t = ev.target; if (t.getAttribute && t.getAttribute('data-prop') === 'label' && sel) { var c = find(sel.id); if (c) { c.label = t.value; renderComp(c) } } })
    $('#lab-power', host).addEventListener('click', function () { power(!running) })
    $('#lab-reset', host).addEventListener('click', function () { if (running) { sim.reset(); events = []; hideBanner(); M.comps.forEach(function (c) { cache[c.id] = null }); step(0.05) } else { events = []; inspector() } })
    $('#lab-undo', host).addEventListener('click', function () { undo(-1) }); $('#lab-redo', host).addEventListener('click', function () { undo(1) })
    $('#lab-clear', host).addEventListener('click', function () { if (running) return; if (M.comps.length && !confirm('Clear the whole circuit?')) return; M = blank(); sel = null; renderAll(); inspector(); snapshot() })
    $('#lab-zin', host).addEventListener('click', function () { zoomAt(1.25) }); $('#lab-zout', host).addEventListener('click', function () { zoomAt(0.8) }); $('#lab-fit', host).addEventListener('click', fit)
    svg.addEventListener('wheel', function (ev) { ev.preventDefault(); zoomAt(ev.deltaY < 0 ? 1.12 : 0.89, ev.clientX, ev.clientY) }, { passive: false })
    svg.addEventListener('pointerdown', pdown); svg.addEventListener('pointermove', pmove); svg.addEventListener('pointerup', pup); svg.addEventListener('pointercancel', pup)
    document.addEventListener('keydown', function (ev) { if (!mounted || !el.host.isConnected || !el.host.offsetParent) return; if (/input|select|textarea/i.test((ev.target.tagName || ''))) return; onKey(ev) })
  }
  function rotate(c) { if (!c || running) return; c.rot = ((c.rot || 0) + 1) % 4; cache[c.id] = null; renderAll(); select(sel); snapshot() }
  function onKey(ev) {
    if (ev.key === 'Escape') { pend = null; el.prev.setAttribute('d', ''); renderAll(); updateButtons(); return }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); undo(ev.shiftKey ? 1 : -1); return }
    if (!sel || running) return
    if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); sel.kind === 'comp' ? removeComp(sel.id) : removeWire(sel.id) }
    else if (ev.key.toLowerCase() === 'r' && sel.kind === 'comp') rotate(find(sel.id))
  }
  var pts = {}
  function pdown(ev) {
    el.svg.setPointerCapture && el.svg.setPointerCapture(ev.pointerId); pts[ev.pointerId] = [ev.clientX, ev.clientY]
    if (Object.keys(pts).length === 2) { pinch = null; drag = null; pan = null; return }
    var tgt = ev.target, term = tgt.closest && tgt.closest('[data-term]'), comp = tgt.closest && tgt.closest('[data-comp]'), wire = tgt.closest && tgt.closest('[data-wire]')
    var wp = worldPt(ev)
    if (term && !running) {
      var k = term.getAttribute('data-term')
      if (pend && pend.a !== k) { addWire(pend.a, k); pend = null; el.prev.setAttribute('d', ''); renderAll(); updateButtons(); return }
      pend = { a: k, moved: false, from: [ev.clientX, ev.clientY], click: false }; renderAll(); updateButtons(); return
    }
    if (comp) {
      var c = find(comp.getAttribute('data-comp')); if (!c) return
      if (running) { interact(c, true); drag = { c: c, run: true }; return }
      select({ kind: 'comp', id: c.id }); drag = { c: c, ox: wp[0] - c.x, oy: wp[1] - c.y, moved: false }; return
    }
    if (wire) { if (!running) select({ kind: 'wire', id: wire.getAttribute('data-wire') }); else select({ kind: 'wire', id: wire.getAttribute('data-wire') }); return }
    if (pend) { pend = null; el.prev.setAttribute('d', ''); renderAll(); updateButtons() }
    if (sel) select(null)
    pan = { x: ev.clientX, y: ev.clientY, vx: V.x, vy: V.y }
  }
  var pinch = null
  function pmove(ev) {
    if (pts[ev.pointerId]) pts[ev.pointerId] = [ev.clientX, ev.clientY]
    var ids = Object.keys(pts)
    if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]), cxp = (a[0] + b[0]) / 2, cyp = (a[1] + b[1]) / 2; if (pinch) { zoomAt(d / pinch.d, cxp, cyp); V.x += cxp - pinch.cx; V.y += cyp - pinch.cy; applyView() } pinch = { d: d, cx: cxp, cy: cyp }; return }
    var wp = worldPt(ev)
    if (pend) {
      var p0 = posOfKey(pend.a); if (p0) { el.prev.setAttribute('d', 'M' + p0[0] + ' ' + p0[1] + ' L' + wp[0] + ' ' + wp[1]) }
      if (Math.hypot(ev.clientX - pend.from[0], ev.clientY - pend.from[1]) > 6) pend.moved = true
      var hv = document.elementFromPoint(ev.clientX, ev.clientY); $('[data-term].pend', el.svg); return
    }
    if (drag && !drag.run) { var nx = snap(wp[0] - drag.ox), ny = snap(wp[1] - drag.oy); if (nx !== drag.c.x || ny !== drag.c.y) { drag.c.x = nx; drag.c.y = ny; drag.moved = true; renderComp(drag.c); M.wires.forEach(function (w) { if (splitKey(w.a)[0] === drag.c.id || splitKey(w.b)[0] === drag.c.id) renderWire(w) }) } return }
    if (pan) { V.x = pan.vx + ev.clientX - pan.x; V.y = pan.vy + ev.clientY - pan.y; applyView() }
  }
  function pup(ev) {
    delete pts[ev.pointerId]; if (Object.keys(pts).length < 2) pinch = null
    if (pend) {
      var hv = document.elementFromPoint(ev.clientX, ev.clientY), term = hv && hv.closest && hv.closest('[data-term]')
      if (term && term.getAttribute('data-term') !== pend.a && pend.moved) { addWire(pend.a, term.getAttribute('data-term')); pend = null; el.prev.setAttribute('d', ''); renderAll(); updateButtons(); return }
      if (!pend.moved) { el.prev.setAttribute('d', ''); updateButtons(); return }   // click mode: keep pending, wait for second click
      pend = null; el.prev.setAttribute('d', ''); renderAll(); updateButtons(); return
    }
    if (drag) { if (drag.run) interact(drag.c, false); else if (drag.moved) snapshot(); drag = null }
    pan = null
  }
  function interact(c, down) {
    var p = SC.propsOf(c), id = c.id
    if (c.type === 'pbno' || c.type === 'pbnc') sim.press(id, down)
    else if (!down) return
    else if (c.type === 'sw') c.props.on = !p.on
    else if (c.type === 'sw2') c.props.pos = p.pos === 2 ? 1 : 2
    else if (c.type === 'estop') c.props.latched = !p.latched
    else if (c.type === 'brk') { var s = sim.state(id); if (s.tripped) { sim.resetDevice(id); banner('Breaker reset. Click again to switch it on.', 'info') } else c.props.on = !p.on }
    else if (c.type === 'fuse') { var sf = sim.state(id); if (sf.blown) { sim.resetDevice(id); banner('Fuse replaced.', 'info') } }
    else if (c.type === 'ol') { var so = sim.state(id); if (so.tripped) { sim.resetDevice(id); banner('Overload relay reset.', 'info') } }
    else if (/^(lamp|heater|motor1|motor3|coil|xfmr1|xfmr3|src1|src2|src3)$/.test(c.type)) { var sd = sim.state(id); if (sd && (sd.burnt || sd.destroyed)) { sim.resetDevice(id); banner('New part installed.', 'info') } else { select({ kind: 'comp', id: id }) } }
    if (down) select({ kind: 'comp', id: id })
  }
  function zoomAt(f, cx0, cy0) {
    var r = el.svg.getBoundingClientRect(), px = (cx0 === undefined ? r.left + r.width / 2 : cx0) - r.left, py = (cy0 === undefined ? r.top + r.height / 2 : cy0) - r.top
    var nk = Math.max(0.35, Math.min(2.5, V.k * f)); f = nk / V.k; V.x = px - (px - V.x) * f; V.y = py - (py - V.y) * f; V.k = nk; applyView()
  }
  function fit() {
    var r = el.svg.getBoundingClientRect(); if (!M.comps.length) { V = { x: r.width / 2, y: r.height / 2, k: 1 }; applyView(); return }
    var x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9
    M.comps.forEach(function (c) { var b = SYM.layout(c).box, cs = [[b[0], b[1]], [b[2], b[3]], [b[0], b[3]], [b[2], b[1]]]; cs.forEach(function (q) { var t = rot(q, c.rot); x1 = Math.min(x1, c.x + t[0]); x2 = Math.max(x2, c.x + t[0]); y1 = Math.min(y1, c.y + t[1]); y2 = Math.max(y2, c.y + t[1]) }) })
    var avail = r.height - 90, w = x2 - x1 + 100, hh = y2 - y1 + 90, k = Math.max(0.35, Math.min(1.3, Math.min(r.width / w, avail / hh)))
    V = { k: k, x: r.width / 2 - ((x1 + x2) / 2) * k, y: avail / 2 - ((y1 + y2) / 2) * k + 10 }; applyView()
  }

  /* ---------------- challenges ---------------- */
  function checkChallenge(r) {
    if (!challenge) return
    var ok = false; try { ok = challenge.check(r, M, sim) } catch (e) {}
    chalOK = ok ? chalOK + 1 : 0
    if (chalOK >= 20 && !challenge.done) { challenge.done = true; el.goal.className = 'lab-goal ok'; el.goal.innerHTML = '✅ <b>' + esc(challenge.title) + '</b> complete. ' + esc(challenge.win || 'Nice work.'); try { var d = JSON.parse(localStorage.getItem('voltce_lab_done') || '{}'); d[challenge.id] = 1; localStorage.setItem('voltce_lab_done', JSON.stringify(d)) } catch (e) {}; fillChallenges() }
  }
  function fillChallenges() {
    var sel2 = $('#lab-ch', el.host); if (!sel2 || !root.LabEx) return
    var done = {}; try { done = JSON.parse(localStorage.getItem('voltce_lab_done') || '{}') } catch (e) {}
    sel2.innerHTML = '<option value="">Pick one…</option>' + root.LabEx.challenges.map(function (c, i) { return '<option value="' + c.id + '">' + (done[c.id] ? '✅ ' : '') + (i + 1) + '. ' + esc(c.title) + '</option>' }).join('')
  }
  function fillExamples() {
    var s = $('#lab-ex', el.host); if (!s || !root.LabEx) return
    s.innerHTML = '<option value="">Pick one…</option>' + root.LabEx.examples.map(function (e) { return '<option value="' + e.id + '">' + esc(e.title) + '</option>' }).join('')
  }

  /* ---------------- public API ---------------- */
  Lab.load = function (m, keepChallenge) {
    if (running) power(false)
    M = { comps: (m.comps || []).map(function (c) { return { id: c.id, type: c.type, x: c.x, y: c.y, rot: c.rot || 0, props: c.props || {}, label: c.label } }), wires: (m.wires || []).map(function (w, i) { var o = { id: w.id || 'w' + (i + 1), a: w.a, b: w.b }; if (w.via) o.via = w.via; return o }), nid: 1 }
    M.comps.forEach(function (c) { if (c.label === undefined) delete c.label })
    M.nid = M.wires.length + 100; sel = null; events = []; if (!keepChallenge) { challenge = null; el.goal.hidden = true }
    hist = []; histI = -1; snapshot(); renderAll(); fit(); inspector()
  }
  Lab.loadExample = function (id) { var e = root.LabEx.examples.filter(function (x) { return x.id === id })[0]; if (!e) return; Lab.load(e.build()); el.goal.hidden = false; el.goal.className = 'lab-goal info'; el.goal.innerHTML = '<b>' + esc(e.title) + '.</b> ' + esc(e.text) + (e.try ? ' <i>Try this: ' + esc(e.try) + '</i>' : '') }
  Lab.startChallenge = function (id) {
    var c = root.LabEx.challenges.filter(function (x) { return x.id === id })[0]; if (!c) return
    challenge = c; c.done = false; chalOK = 0; Lab.load(c.start ? c.start() : blank(), true); el.goal.hidden = false; el.goal.className = 'lab-goal'
    el.goal.innerHTML = '🎯 <b>' + esc(c.title) + '.</b> ' + esc(c.goal) + (c.hint ? ' <details><summary>Hint</summary>' + esc(c.hint) + '</details>' : '')
  }
  Lab.addPart = function (type, x, y, label) { var c = addComp(type, snap(x), snap(y)); if (c && label) { c.label = label; renderComp(c) } return c }
  Lab.focus = function (x, y, w, h) { var r = el.svg.getBoundingClientRect(), k = Math.min(r.width / (w + 80), r.height / (h + 80), 1.5); V.k = k; V.x = r.width / 2 - (x + w / 2) * k; V.y = r.height / 2 - (y + h / 2) * k; applyView() }
  Lab.model = function () { return M }
  Lab.view = function () { return V }
  Lab.run = function (on) { power(on) }
  Lab.setSpeed = function (s) { speed = s }
  Lab.live = function () { return live }
  Lab.sim = function () { return sim }
  Lab.select = function (s) { select(s) }
  Lab.helpers = { termPos: termPos, wirePts: wirePts, splitKey: splitKey, find: find, esc: esc, termDir: termDir }
  Lab.mount = function (host) {
    if (mounted === host) { return }
    try { basic = (localStorage.getItem('voltce_lab_mode') || 'basic') === 'basic' } catch (e) {}
    V = { x: 300, y: 200, k: 1 }; M = blank(); sel = null; pend = null
    build(host); mounted = host; applyView()
    var saved = null; try { saved = JSON.parse(localStorage.getItem('voltce_lab_v1') || 'null') } catch (e) {}
    fillExamples(); fillChallenges()
    if (saved && saved.comps && saved.comps.length) Lab.load(saved)
    else if (root.LabEx) { Lab.loadExample('lamp') } else { snapshot(); renderAll() }
    inspector(); updateButtons()
    if (root.LabAssist && root.LabAssist.attach) root.LabAssist.attach(host)
  }
  Lab.refresh = function () { if (mounted) { fillExamples(); fillChallenges() } }
  root.Lab = Lab
})(typeof self !== 'undefined' ? self : this)
