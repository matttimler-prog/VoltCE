/* VoltCE Service & Panel Builder UI. Needs svc-core.js. */
(function () {
  'use strict'
  var K = window.SvcCore, KEY = 'voltce_svc_v1'
  var NW = 176, NH = 96, GX = 22, GY = 64
  var model, R, sel = null, hist = [], hi = -1, host, el = {}, mounted = false
  var CSS = '.sn rect.bx{fill:#fff;stroke:#5d6b7a;stroke-width:2}.sn.bad rect.bx{stroke:#d32f2f;fill:#fff5f5;stroke-width:3}.sn.warn rect.bx{stroke:#e0a100;fill:#fffbee;stroke-width:3}.sn.sel rect.bx{stroke:#1B5FC0;stroke-width:3.5}.sn.sel.bad rect.bx{stroke:#d32f2f}.nm{font:700 13px system-ui,sans-serif;fill:#22303d}.t1{font:12px system-ui,sans-serif;fill:#3d4b59}.t2{font:11px system-ui,sans-serif;fill:#6b7a89}.ed{fill:none;stroke:#5d6b7a;stroke-width:2.5}.el{font:600 11px system-ui,sans-serif;fill:#3d4b59;paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round}.ic{fill:none;stroke:#2b3947;stroke-width:2}.bar{fill:#e6ebf0}.barf{fill:#1fa855}.barf.hi{fill:#e0a100}.barf.over{fill:#d32f2f}.wb{font:700 14px system-ui;fill:#d32f2f}.ttl{font:700 15px system-ui,sans-serif;fill:#22303d}'
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function fmt(x, d) { var p = Math.pow(10, d == null ? 1 : d); return (Math.round(x * p) / p).toString() }
  function clone(o) { return JSON.parse(JSON.stringify(o)) }
  function $(s, r) { return (r || host).querySelector(s) }

  /* ---------- state ---------- */
  function snap() { var s = JSON.stringify(model); if (hist[hi] === s) return; hist = hist.slice(0, hi + 1); hist.push(s); if (hist.length > 80) hist.shift(); hi = hist.length - 1; try { localStorage.setItem(KEY, s) } catch (e) { } btns() }
  function load(m, keep) { model = K.normalize(clone(m)); if (!keep) sel = model.root.id; hist = []; hi = -1; snap(); update() }
  function undo(d) { var i = hi + d; if (i < 0 || i >= hist.length) return; hi = i; model = JSON.parse(hist[i]); if (!K.find(model, sel)) sel = model.root.id; try { localStorage.setItem(KEY, hist[i]) } catch (e) { } update(); btns() }
  function update() { R = K.calc(model); drawCanvas(); drawSide(); btns(); drawChal() }
  var chal = null, chalDone = false
  function drawChal() {
    var p = host && host.querySelector('.svc-chal'); if (!p) return
    if (!chal) { p.hidden = true; return }
    var c = K.challenges.filter(function (x) { return x.id === chal })[0], res = K.checkChallenge(chal, model), all = res.every(function (r) { return r.ok })
    p.hidden = false
    p.className = 'svc-chal' + (all ? ' done' : '')
    p.innerHTML = '<div class="sc-h"><b>' + esc(c.title) + '</b><button class="btn btn-outline" data-a="chalx">Close challenge</button></div><p>' + esc(c.brief) + '</p><ul>' + res.map(function (r) { return '<li class="' + (r.ok ? 'ok' : '') + '"><span aria-hidden="true">' + (r.ok ? '\u2713' : '\u25CB') + '</span> ' + esc(r.text) + (r.ok ? ' (done)' : ' (not yet)') + '</li>' }).join('') + '</ul>' + (all ? '<p class="sc-win"><b>Challenge complete.</b> Try the next one from the Challenge menu.</p>' : '<details><summary>Need a hint?</summary><p>' + esc(c.hint) + '</p></details>')
    if (all && !chalDone) { chalDone = true; try { trk('svc_challenge', chal) } catch (e) {} }
  }
  function startChal(id) { chal = id || null; chalDone = false; if (id) { var c = K.challenges.filter(function (x) { return x.id === id })[0]; load(c.build()) } else drawChal() }
  function btns() { var u = $('[data-a=undo]'), r = $('[data-a=redo]'); if (u) u.disabled = hi <= 0; if (r) r.disabled = hi >= hist.length - 1 }
  function selNode() { var f = sel && K.find(model, sel); return f ? f.node : null }

  /* ---------- layout + drawing ---------- */
  function layout(n, depth, pos) {
    var kids = n.kids.map(function (k) { return layout(k, depth + 1, pos) })
    var w = kids.length ? kids.reduce(function (a, k) { return a + k.w }, 0) + GX * (kids.length - 1) : NW
    w = Math.max(w, NW)
    var o = { n: n, kids: kids, w: w, depth: depth, x: 0, y: depth * (NH + GY) }
    return o
  }
  function place(o, left) {
    var cx = left + o.w / 2; o.x = cx - NW / 2
    var kl = left + (o.w - (o.kids.reduce(function (a, k) { return a + k.w }, 0) + GX * Math.max(0, o.kids.length - 1))) / 2
    o.kids.forEach(function (k) { place(k, kl); kl += k.w + GX })
  }
  function icon(type, x, y) {
    var g = ''
    if (type === 'utility') g = '<circle class="ic" cx="' + (x + 12) + '" cy="' + (y + 12) + '" r="11"/><path class="ic" d="M' + (x + 5) + ' ' + (y + 12) + ' q3.5 -6 7 0 t7 0"/>'
    else if (type === 'meter') g = '<circle class="ic" cx="' + (x + 12) + '" cy="' + (y + 12) + '" r="11"/><text x="' + (x + 12) + '" y="' + (y + 17) + '" text-anchor="middle" style="font:700 13px system-ui" fill="#2b3947">M</text>'
    else if (type === 'disc') g = '<rect class="ic" x="' + (x + 3) + '" y="' + (y + 2) + '" width="18" height="20" rx="2"/><path class="ic" d="M' + (x + 8) + ' ' + (y + 18) + ' L' + (x + 16) + ' ' + (y + 6) + '"/>'
    else if (type === 'bus') g = '<path class="ic" d="M' + (x + 2) + ' ' + (y + 6) + ' H' + (x + 22) + ' M' + (x + 6) + ' ' + (y + 6) + ' V' + (y + 22) + ' M' + (x + 12) + ' ' + (y + 6) + ' V' + (y + 22) + ' M' + (x + 18) + ' ' + (y + 6) + ' V' + (y + 22) + '"/>'
    else if (type === 'xfmr') g = '<circle class="ic" cx="' + (x + 8) + '" cy="' + (y + 12) + '" r="8"/><circle class="ic" cx="' + (x + 17) + '" cy="' + (y + 12) + '" r="8"/>'
    else if (type === 'ats') g = '<rect class="ic" x="' + (x + 2) + '" y="' + (y + 3) + '" width="20" height="18" rx="2"/><path class="ic" d="M' + (x + 6) + ' ' + (y + 17) + ' V' + (y + 9) + ' M' + (x + 18) + ' ' + (y + 17) + ' V' + (y + 9) + ' M' + (x + 6) + ' ' + (y + 9) + ' L' + (x + 18) + ' ' + (y + 15) + '"/>'
    else if (type === 'panel') g = '<rect class="ic" x="' + (x + 3) + '" y="' + (y + 2) + '" width="18" height="20" rx="2"/><path class="ic" d="M' + (x + 8) + ' ' + (y + 7) + ' H' + (x + 16) + ' M' + (x + 8) + ' ' + (y + 12) + ' H' + (x + 16) + ' M' + (x + 8) + ' ' + (y + 17) + ' H' + (x + 16) + '"/>'
    else g = '<circle class="ic" cx="' + (x + 12) + '" cy="' + (y + 12) + '" r="10"/><text x="' + (x + 12) + '" y="' + (y + 17) + '" text-anchor="middle" style="font:700 13px system-ui" fill="#2b3947">M</text>'
    return g
  }
  var TYPE_LABEL = { utility: 'Utility', meter: 'Meter', disc: 'Main / disconnect', bus: 'Switchboard / bus', xfmr: 'Transformer', ats: 'Generator + transfer switch', panel: 'Panel', load: 'Load' }
  function nodeSVG(o, forExport) {
    var n = o.n, r = R[n.id], bad = r.warnings.some(function (w) { return w.lvl === 'bad' }), warn = !bad && r.warnings.some(function (w) { return w.lvl === 'warn' })
    var cls = 'sn' + (bad ? ' bad' : warn ? ' warn' : '') + (sel === n.id && !forExport ? ' sel' : '')
    var l1, l2
    if (n.type === 'utility') { l1 = SYSN(r.sys); l2 = fmt(r.Imax) + ' A · ' + fmt(r.S / 1000) + ' kVA' }
    else if (n.type === 'xfmr') { l1 = fmt(r.kva, 1) + ' kVA ' + SHORT(n.props.pri) + '→' + SHORT(n.props.sec); l2 = fmt(r.xloadPct, 0) + '% loaded · ' + fmt(r.isc / 1000) + ' kA' }
    else if (n.type === 'ats') { l1 = 'ATS · gen ' + (r.genKva ? fmt(r.genKva, 0) + ' kVA' : 'not set'); l2 = r.genKva ? fmt(r.genLoadPct, 0) + '% gen load · ' + fmt(r.Imax) + ' A' : fmt(r.Imax) + ' A' }
    else if (n.type === 'panel') { l1 = r.bus + ' A bus · ' + r.used + '/' + r.spaces + ' spaces'; l2 = fmt(r.Imax) + ' A · ' + fmt(r.S / 1000) + ' kVA' }
    else { l1 = fmt(r.Imax) + ' A · ' + fmt(r.S / 1000) + ' kVA'; l2 = n.type === 'load' ? SYSN(r.sys) : fmt(r.vEnd, 0) + ' V' }
    var pct = n.type === 'xfmr' ? r.xloadPct : n.type === 'ats' && r.genKva ? r.genLoadPct : n.type === 'utility' ? 0 : r.need && n.ocpd ? r.need / n.ocpd * 100 : 0
    var bw = Math.max(0, Math.min(100, pct)) / 100 * (NW - 20)
    var s = '<g class="' + cls + '" data-id="' + n.id + '" style="cursor:pointer"><rect class="bx" x="' + o.x + '" y="' + o.y + '" width="' + NW + '" height="' + NH + '" rx="10"/>' + icon(n.type, o.x + 10, o.y + 8)
    s += '<text class="nm" x="' + (o.x + 40) + '" y="' + (o.y + 22) + '">' + esc(trunc(n.name, 17)) + '</text><text class="t2" x="' + (o.x + 40) + '" y="' + (o.y + 36) + '">' + TYPE_LABEL[n.type] + '</text>'
    s += '<text class="t1" x="' + (o.x + 10) + '" y="' + (o.y + 56) + '">' + esc(trunc(l1, 28)) + '</text><text class="t1" x="' + (o.x + 10) + '" y="' + (o.y + 72) + '">' + esc(trunc(l2, 28)) + '</text>'
    if (n.type !== 'utility') s += '<rect class="bar" x="' + (o.x + 10) + '" y="' + (o.y + NH - 12) + '" width="' + (NW - 20) + '" height="6" rx="3"/><rect class="barf' + (pct > 100 ? ' over' : pct > 80 ? ' hi' : '') + '" x="' + (o.x + 10) + '" y="' + (o.y + NH - 12) + '" width="' + bw + '" height="6" rx="3"/>'
    if (bad || warn) s += '<text class="wb" x="' + (o.x + NW - 18) + '" y="' + (o.y + 22) + '" style="fill:' + (bad ? '#d32f2f' : '#e0a100') + '">' + (bad ? '!' : '⚠') + '</text>'
    return s + '</g>'
  }
  function SYSN(k) { var s = K.SYSTEMS[k]; return s ? s.label.replace(' three-phase wye', ' 3φ').replace(' single-phase', ' 1φ').replace(' three-phase (primary)', ' 3φ').replace(' three-phase (no neutral)', ' 3φ') : k }
  function SHORT(k) { var s = K.SYSTEMS[k]; return s ? (s.mv ? '12.47k' : s.vll) : '?' }
  function trunc(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s }
  function edgeSVG(p, c) {
    var n = c.n, r = R[n.id], x1 = p.x + NW / 2, y1 = p.y + NH, x2 = c.x + NW / 2, y2 = c.y, my = y1 + GY / 2 - 4
    var lbl = n.ocpd + ' A · ' + n.feeder.size + ' ' + n.feeder.mat + (n.feeder.sets > 1 ? ' ×' + n.feeder.sets : '') + ' · ' + n.feeder.len + ' ft'
    var bad = r.warnings.some(function (w) { return w.lvl === 'bad' && /wire|breaker|conductor|overheat/i.test(w.msg) })
    return '<path class="ed" style="' + (bad ? 'stroke:#d32f2f' : '') + '" d="M' + x1 + ' ' + y1 + ' V' + my + ' H' + x2 + ' V' + y2 + '"/><text class="el" x="' + x2 + '" y="' + (y2 - 8) + '" text-anchor="middle">' + esc(lbl) + '</text>'
  }
  function treeSVG(forExport) {
    var root = layout(model.root, 0); place(root, 20)
    var parts = [], maxY = 0
    ;(function emit(o, par) {
      if (par) parts.push(edgeSVG(par, o))
      o.kids.forEach(function (k) { emit(k, o) })
    })(root, null)
    ;(function emit2(o) { parts.push(nodeSVG(o, forExport)); maxY = Math.max(maxY, o.y + NH); o.kids.forEach(emit2) })(root)
    var W = root.w + 40, H = maxY + 30 + (forExport ? 30 : 0), off = forExport ? 30 : 0
    return { w: W, h: H, svg: '<svg xmlns="http://www.w3.org/2000/svg" class="svc-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="system-ui,sans-serif"><style>' + CSS + '</style>' + (forExport ? '<rect width="100%" height="100%" fill="#fff"/><text class="ttl" x="20" y="22">' + esc(model.name) + ' - one-line diagram (VoltCE Service &amp; Panel Builder)</text>' : '') + '<g transform="translate(0 ' + off + ')">' + parts.join('') + '</g></svg>' }
  }
  function drawCanvas() { var sc = $('.svc-scroll'), t = sc.scrollTop, l = sc.scrollLeft; sc.innerHTML = treeSVG(false).svg; sc.scrollTop = t; sc.scrollLeft = l }

  /* ---------- side panel ---------- */
  function sel2(name, val, opts, attr) { return '<select data-f="' + name + '"' + (attr || '') + '>' + opts.map(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(l) + '</option>' }).join('') + '</select>' }
  function fld(label, html) { return '<label class="sv-f"><span>' + label + '</span>' + html + '</label>' }
  var SYSOPTS = Object.keys(K.SYSTEMS).map(function (k) { return [k, K.SYSTEMS[k].label] })
  var KVA = [10, 15, 25, 30, 45, 75, 112.5, 150, 225, 300, 500, 750, 1000, 1500, 2000]
  function drawSide() {
    var n = selNode(), side = $('.svc-side'), h = ''
    var desc = K.describe(model, n && n.type !== 'utility' || (n && n.type === 'utility') ? n.id : null, R)
    h += '<div class="sv-sec"><div class="sv-t">What\'s going on' + (n ? ' · ' + esc(n.name) : '') + '</div>' + desc.map(function (d) { var c = /^PROBLEM/.test(d) ? 'bad' : /^Warning/.test(d) ? 'warn' : ''; return '<p class="' + c + '">' + esc(d) + '</p>' }).join('') + '<button class="btn btn-outline sv-sm" data-a="whole">Whole system</button></div>'
    if (!n) { side.innerHTML = h; return }
    var f = K.find(model, n.id), r = R[n.id]
    h += '<div class="sv-sec"><div class="sv-t">Edit</div>' + fld('Name', '<input data-f="name" value="' + esc(n.name) + '">')
    if (n.type === 'utility') h += fld('System', sel2('sys', n.props.sys, SYSOPTS)) + fld('Available fault current (kA)', '<input data-f="isc" type="number" min="1" step="1" value="' + esc(n.props.isc) + '">')
    if (n.type !== 'utility') {
      h += '<div class="sv-grid">' + fld('Breaker (A)', sel2('ocpd', n.ocpd, K.OCPD)) + fld('Breaker AIC (kA)', sel2('aic', n.aic, [5, 10, 14, 18, 22, 25, 35, 42, 65, 100, 200])) + '</div>'
      h += '<div class="sv-grid">' + fld('Wire size', sel2('size', n.feeder.size, K.SIZES.map(function (s) { return [s, s + ' (' + K.ampacity(s, n.feeder.mat) + ' A)'] }))) + fld('Material', sel2('mat', n.feeder.mat, ['Cu', 'Al'])) + fld('Length (ft)', '<input data-f="len" type="number" min="0" step="5" value="' + esc(n.feeder.len) + '">') + fld('Parallel sets', sel2('sets', n.feeder.sets, [1, 2, 3, 4])) + '</div>'
    }
    if (n.type === 'xfmr') h += '<div class="sv-grid">' + fld('Secondary', sel2('sec', n.props.sec, SYSOPTS)) + fld('kVA', sel2('kva', n.props.kva, KVA)) + fld('Impedance %', '<input data-f="z" type="number" min="1" max="10" step="0.5" value="' + esc(n.props.z || 5) + '">') + '</div><p class="sv-n">Primary follows its supply: ' + esc(SYSN(n.props.pri)) + '.</p>'
    if (n.type === 'ats') h += '<div class="sv-grid">' + fld('Generator kVA', sel2('genKva', n.props.genKva || 0, [0, 10, 15, 20, 22, 25, 30, 35, 45, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500, 600])) + fld('Generator wire', sel2('genWire', n.props.genWire || '4', K.SIZES.map(function (s) { return [s, s + ' Cu (' + K.ampacity(s, 'Cu') + ' A)'] }))) + '</div><p class="sv-n">The feeder fields above are the transfer switch and its wire from the utility side. The generator wire must carry at least 115% of the generator full-load current (NEC 445.13).</p>'
    if (n.type === 'panel') h += '<div class="sv-grid">' + fld('Bus rating (A)', sel2('bus', n.props.bus, [60, 100, 125, 150, 200, 225, 400, 600, 800, 1200])) + fld('Spaces', '<input data-f="spaces" type="number" min="2" step="2" value="' + esc(n.props.spaces || 30) + '">') + fld('Demand %', '<input data-f="demand" type="number" min="10" max="100" step="5" value="' + esc(n.props.demand || 100) + '" title="Share of the connected load that actually runs at once">') + '</div>'
    if (n.type === 'load') h += loadFields(n.props, 'p:', r.sys)
    h += '</div>'
    if (n.type === 'panel') h += circuitsHTML(n, r)
    var kids = ''
    side.innerHTML = h + '<div class="sv-sec"><div class="sv-t">Numbers</div>' + numbers(n, r) + '</div>'
  }
  function loadFields(c, pre, sys) {
    var isMot = c.kind === 'motor' || c.motor, vopts = isMot ? [['120', '115 V 1φ'], ['240', '230 V 1φ'], ['208', '208 V 3φ'], ['480', '460 V 3φ']] : [['120', '120 V'], ['240', '240 / 208 V (line-to-line)'], ['3P', 'Three-phase']]
    return '<div class="sv-grid">' + fld('Type', sel2(pre + 'kind', c.kind || 'general', Object.keys(K.KINDS).map(function (k) { return [k, K.KINDS[k].label] }))) + fld('Voltage', sel2(pre + 'v', c.v || '120', vopts)) + (isMot ? fld('Horsepower', '<input data-f="' + pre + 'hp" type="number" min="0.5" step="0.5" value="' + esc(c.hp || 1) + '">') : fld('Load (VA)', '<input data-f="' + pre + 'va" type="number" min="0" step="100" value="' + esc(c.va || 0) + '">')) + '</div>'
  }
  function circuitsHTML(n, r) {
    var h = '<div class="sv-sec"><div class="sv-t">Branch circuits (' + n.circuits.length + ')</div><div class="sv-circ">'
    n.circuits.forEach(function (c) {
      var isMot = c.kind === 'motor' || c.motor, bad = r.warnings.some(function (w) { return w.msg.indexOf(' / ' + c.name + ':') >= 0 })
      h += '<div class="sv-c' + (bad ? ' bad' : '') + '" data-cid="' + c.id + '"><input data-cf="name" value="' + esc(c.name) + '">' + sel2('c:kind', c.kind || 'general', Object.keys(K.KINDS).map(function (k) { return [k, K.KINDS[k].label] })) +
        sel2('c:v', c.v || '120', isMot ? [['120', '115 V'], ['240', '230 V'], ['208', '208 V 3φ'], ['480', '460 V 3φ']] : [['120', '120 V'], ['240', '240 V'], ['208', '208 V'], ['3P', '3φ']]) +
        (isMot ? '<input data-cf="hp" type="number" step="0.5" value="' + esc(c.hp || 1) + '" title="HP">' : '<input data-cf="va" type="number" step="100" value="' + esc(c.va || 0) + '" title="VA">') +
        sel2('c:breaker', c.breaker || 20, [15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 100]) + sel2('c:wire', c.wire || '12', K.SIZES.slice(0, 12)) +
        '<span class="sv-amps">' + (c._amps !== undefined ? fmt(c._amps) + ' A' : '') + '</span><button class="sv-x" data-a="delc" data-cid="' + c.id + '" aria-label="Remove circuit">×</button></div>'
    })
    h += '</div><div class="sv-chips">' + [['Lighting', 'lighting', '120', 1500], ['Receptacles', 'recep', '120', 1800], ['Range', 'range', '240', 9600], ['Dryer', 'dryer', '240', 5000], ['Water heater', 'wh', '240', 4500], ['A/C', 'hvac', '240', 4800], ['EV charger', 'ev', '240', 7680], ['Motor 5 HP', 'motor', '480', 0]].map(function (q) { return '<button class="sv-chip" data-a="addc" data-q="' + q.join('|') + '">+ ' + q[0] + '</button>' }).join('') + '</div></div>'
    return h
  }
  function numbers(n, r) {
    var rows = [['Current (worst phase)', fmt(r.Imax) + ' A'], ['Load for sizing', fmt(r.Imaxs) + ' A'], ['Connected load', fmt(r.S / 1000) + ' kVA']]
    if (r.neutral) rows.push(['Neutral current', fmt(r.neutral) + ' A'])
    if (n.type !== 'utility') rows.push(['Voltage at this point', fmt(r.vEnd, 0) + ' V'], ['Feeder voltage drop', fmt(r.dropPct, 2) + '%'], ['Total drop from service', fmt(r.cumDrop, 2) + '%'], ['Fault current here', fmt((r.iscIn || 0) / 1000) + ' kA'])
    if (n.type === 'ats' && r.genKva) rows.push(['Generator full-load current', fmt(r.genFLA) + ' A'], ['Generator loading', fmt(r.genLoadPct, 0) + '%'], ['Generator wire needs (115%)', fmt(r.genFLA * 1.15) + ' A'])
    if (n.type === 'xfmr') rows.push(['Secondary fault current', fmt(r.isc / 1000) + ' kA'], ['Primary / secondary full-load', fmt(r.flaP) + ' / ' + fmt(r.flaS) + ' A'])
    return '<table class="sv-tbl">' + rows.map(function (x) { return '<tr><td>' + x[0] + '</td><td>' + x[1] + '</td></tr>' }).join('') + '</table>'
  }

  /* ---------- editing ---------- */
  function setField(t) {
    var n = selNode(), f = t.getAttribute('data-f'), v = t.value; if (!n || !f) return
    var cid = t.closest('[data-cid]'), isNum = t.type === 'number'
    if (f.indexOf('c:') === 0 || t.hasAttribute('data-cf')) {
      var c = n.circuits.filter(function (x) { return x.id === cid.getAttribute('data-cid') })[0]; var k = f.indexOf('c:') === 0 ? f.slice(2) : t.getAttribute('data-cf')
      c[k] = (k === 'breaker' || k === 'va' || k === 'hp') ? +v : v
      if (k === 'kind') { c.motor = v === 'motor'; if (v === 'motor') { c.v = '480'; c.hp = c.hp || 5 } else if (c.v === '208' && c.v === '480') c.v = '120'; var kd = K.KINDS[v]; if (kd) c.cont = kd.cont }
      if (k === 'va' && c.kind === 'motor') c.va = +v
    }
    else if (f === 'name') n.name = v
    else if (f === 'sys') { n.props.sys = v }
    else if (f === 'isc') n.props.isc = Math.max(1, +v || 1)
    else if (f === 'genKva') n.props.genKva = +v
    else if (f === 'genWire') n.props.genWire = v
    else if (f === 'ocpd') n.ocpd = +v
    else if (f === 'aic') n.aic = +v
    else if (f === 'size') n.feeder.size = v
    else if (f === 'mat') n.feeder.mat = v
    else if (f === 'len') n.feeder.len = Math.max(0, +v || 0)
    else if (f === 'sets') n.feeder.sets = +v
    else if (f === 'sec') { n.props.sec = v }
    else if (f === 'kva') n.props.kva = +v
    else if (f === 'z') n.props.z = Math.max(1, +v || 5)
    else if (f === 'bus') n.props.bus = +v
    else if (f === 'spaces') n.props.spaces = Math.max(2, +v || 30)
    else if (f === 'demand') n.props.demand = Math.max(10, Math.min(100, +v || 100))
    else if (f.indexOf('p:') === 0) { var k2 = f.slice(2); n.props[k2] = (k2 === 'va' || k2 === 'hp') ? +v : v; if (k2 === 'kind') { n.props.motor = v === 'motor'; if (v === 'motor') { n.props.v = '480'; n.props.hp = n.props.hp || 10 } } }
    if (n.type === 'utility') propagateSys(model.root)
    fixChain(); snap(); update()
  }
  /* a child xfmr's primary always matches what feeds it */
  function propagateSys(n, sys) { var s = n.type === 'utility' ? n.props.sys : n.type === 'xfmr' ? n.props.sec : sys; n.kids.forEach(function (k) { if (k.type === 'xfmr') k.props.pri = s; propagateSys(k, s) }) }
  function fixChain() { propagateSys(model.root) }
  var DEF_SEC = { '3P-12470': '3P-277/480', '3P-277/480': '3P-120/208', '3P-480D': '3P-120/208', '3P-120/208': '1P-120/240', '1P-120/240': '1P-120/240' }
  function sysAt(id) { var s = null; (function w(n, ps) { var cs = n.type === 'utility' ? n.props.sys : n.type === 'xfmr' ? n.props.sec : ps; if (n.id === id) s = cs; n.kids.forEach(function (k) { w(k, cs) }) })(model.root, null); return s }
  function addNode(type) {
    var n = selNode(); if (!n) return; if (n.type === 'load') { n = K.find(model, n.id).parent }
    var sys = sysAt(n.id), c
    if (type === 'panel') c = K.node('panel', 'Panel ' + (countType('panel') + 1), { bus: 100, spaces: 24 })
    else if (type === 'xfmr') { var sec = DEF_SEC[sys] || sys; c = K.node('xfmr', 'Transformer ' + (countType('xfmr') + 1), { pri: sys, sec: sec, kva: 45, z: 5 }) }
    else if (type === 'meter') c = K.node('meter', 'Meter ' + (countType('meter') + 1))
    else if (type === 'disc') c = K.node('disc', 'Disconnect')
    else if (type === 'ats') c = K.node('ats', 'Transfer switch (ATS)', { genKva: 0, genWire: '4' })
    else if (type === 'bus') c = K.node('bus', 'Switchboard')
    else if (type === 'load') c = K.node('load', 'Motor ' + (countType('load') + 1), { kind: 'motor', motor: true, hp: 10, v: SYSTEMS3(sys) ? '480' : '240' })
    if (!c) return
    c.feeder = { size: '3', mat: 'Cu', len: 20, sets: 1 }; c.ocpd = 100; c.aic = 22
    n.kids.push(c); sel = c.id; fixChain()
    var R1 = K.calc(model), r = R1[c.id]
    if (type === 'xfmr') { c.ocpd = K.nextOCPD(r.flaP || 50); c.feeder.size = K.sizeFor(c.ocpd, 'Cu') }
    else if (type === 'load') { var fla = r.Imax; c.ocpd = K.nextOCPD(fla * 2); c.feeder.size = K.sizeFor(fla * 1.25, 'Cu') }
    else if (type === 'meter' || type === 'disc' || type === 'bus' || type === 'ats') { var pr = K.find(model, n.id); c.ocpd = n.ocpd || 100; c.feeder.size = n.feeder ? n.feeder.size : '4'; c.feeder.mat = n.feeder ? n.feeder.mat : 'Cu'; c.feeder.sets = n.feeder ? n.feeder.sets : 1; c.feeder.len = 5; c.aic = n.aic || 22 }
    snap(); update()
  }
  function SYSTEMS3(sys) { return K.SYSTEMS[sys] && K.SYSTEMS[sys].ph === 3 }
  function countType(t) { var n = 0; K.walk(model.root, function (x) { if (x.type === t) n++ }); return n }
  function del() { var f = sel && K.find(model, sel); if (!f || !f.parent) return; f.parent.kids = f.parent.kids.filter(function (k) { return k.id !== sel }); sel = f.parent.id; snap(); update() }
  function dup() {
    var f = sel && K.find(model, sel); if (!f || !f.parent) return
    var c = clone(f.node); (function re(n) { n.id = K.uid('n'); (n.circuits || []).forEach(function (x) { x.id = K.uid('c') }); n.name = n.name + ' copy'; n.kids.forEach(re) })(c)
    f.parent.kids.push(c); sel = c.id; snap(); update()
  }
  function addCircuit(q) {
    var n = selNode(); if (!n || n.type !== 'panel') return; var p = q.split('|'), kind = p[1], v = p[2], va = +p[3]
    var c = K.circuit(p[0], kind, v, va, { breaker: 20, wire: '12' }); if (kind === 'motor') { c.motor = true; c.hp = 5; c.v = '480' }
    var kd = K.KINDS[kind]; c.cont = kd.cont
    var amps = v === '120' ? va / 120 : va / 240; if (kind !== 'motor') { var need = amps * (c.cont ? 1.25 : 1); c.breaker = K.nextOCPD(Math.max(15, need)); c.wire = K.sizeFor(c.breaker, 'Cu') } else { c.breaker = 40; c.wire = '8' }
    n.circuits.push(c); snap(); update()
  }
  function autosize() { K.autoSize(model); snap(); update(); toast('Breakers, wire and AIC ratings sized for the loads.') }
  function toast(t) { var b = $('.svc-toast'); b.textContent = t; b.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { b.hidden = true }, 3500) }

  /* ---------- exports ---------- */
  function dl(name, text, mime) { var b = new Blob([text], { type: mime || 'text/plain' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove() }, 500) }
  function fname(ext) { return 'voltce-' + String(model.name || 'service').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + ext }
  function csvRow(a) { return a.map(function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v }).join(',') }
  function scheduleCSV() {
    var rows = [csvRow(['Item', 'Type', 'Fed from', 'System', 'Breaker (A)', 'AIC (kA)', 'Wire', 'Material', 'Length (ft)', 'Load (A)', 'Load (kVA)', 'Voltage drop %', 'Fault current (kA)', 'Warnings'])]
    K.walk(model.root, function (n, p) { var r = R[n.id]; rows.push(csvRow([n.name, n.type, p ? p.name : '', K.SYSTEMS[r.sys].label, n.ocpd || '', n.aic || '', n.feeder ? n.feeder.size + (n.feeder.sets > 1 ? ' x' + n.feeder.sets : '') : '', n.feeder ? n.feeder.mat : '', n.feeder ? n.feeder.len : '', fmt(r.Imax), fmt(r.S / 1000), n.feeder ? fmt(r.dropPct, 2) : '', fmt((r.iscIn || r.isc || 0) / 1000), r.warnings.map(function (w) { return w.msg }).join(' | ')])) })
    return rows.join('\n')
  }
  function panelCSV() {
    var rows = [csvRow(['Panel', 'Circuit', 'Type', 'Voltage', 'Load (VA)', 'Load (A)', 'Breaker (A)', 'Wire', 'Continuous'])]
    K.walk(model.root, function (n) { if (n.type === 'panel') n.circuits.forEach(function (c, i) { rows.push(csvRow([n.name, c.name, (K.KINDS[c.kind] || {}).label || c.kind, c.v, Math.round(K.circuitVA(c)), c._amps !== undefined ? fmt(c._amps) : '', c.breaker, c.wire || '', (c.cont !== undefined ? c.cont : (K.KINDS[c.kind] || {}).cont) ? 'yes' : 'no'])) }) })
    return rows.join('\n')
  }
  function doExport(k) {
    if (k === 'json') dl(fname('.json'), JSON.stringify(model, null, 2), 'application/json')
    else if (k === 'csv') dl(fname('-schedule.csv'), scheduleCSV(), 'text/csv')
    else if (k === 'panels') dl(fname('-panels.csv'), panelCSV(), 'text/csv')
    else if (k === 'svg') dl(fname('.svg'), treeSVG(true).svg, 'image/svg+xml')
    else if (k === 'png' || k === 'print') {
      var r = treeSVG(true), img = new Image()
      img.onload = function () { var c = document.createElement('canvas'); c.width = r.w * 2; c.height = r.h * 2; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height)
        if (k === 'png') c.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fname('.png'); document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove() }, 500) }, 'image/png')
        else { var w = window.open('', '_blank'); if (w) { w.document.write('<title>' + esc(model.name) + '</title><body style="margin:0"><img src="' + c.toDataURL('image/png') + '" style="width:100%">'); w.document.close(); setTimeout(function () { w.print() }, 300) } } }
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.svg)
    }
  }

  /* ---------- build ---------- */
  function build(h) {
    host = h; h.classList.add('svc-root')
    h.innerHTML = '<div class="lab-bar"><label class="lab-sel">Examples <select data-a="ex"><option value="">Pick one…</option>' + K.examples.map(function (e) { return '<option value="' + e.id + '">' + esc(e.title) + '</option>' }).join('') + '</select></label><label class="lab-sel">Challenge <select data-a="chal"><option value="">None</option>' + K.challenges.map(function (c) { return '<option value="' + c.id + '">' + esc(c.title) + '</option>' }).join('') + '</select></label><span class="lab-sep"></span>' +
      '<span class="sv-add">Add to selected:</span><button class="btn btn-outline" data-add="meter">Meter</button><button class="btn btn-outline" data-add="disc">Main / disconnect</button><button class="btn btn-outline" data-add="bus">Switchboard</button><button class="btn btn-outline" data-add="xfmr">Transformer</button><button class="btn btn-outline" data-add="ats" title="Generator with an automatic transfer switch">Generator + ATS</button><button class="btn btn-outline" data-add="panel">Panel</button><button class="btn btn-outline" data-add="load">Motor load</button><span class="lab-sep"></span>' +
      '<button class="btn btn-outline" data-a="dup">Copy</button><button class="btn btn-outline" data-a="del">Delete</button><button class="btn" style="background:#1B5FC0;color:#fff" data-a="auto" title="Pick breaker, wire and AIC sizes for the loads">Auto-size</button><span class="lab-sep"></span>' +
      '<button class="btn btn-outline" data-a="undo">Undo</button><button class="btn btn-outline" data-a="redo">Redo</button><span class="lab-sep"></span>' +
      '<label class="lab-sel">Export <select data-a="exp"><option value="">Choose…</option><option value="svg">One-line diagram (SVG)</option><option value="png">One-line diagram (PNG)</option><option value="print">Print</option><option value="csv">Feeder schedule (CSV)</option><option value="panels">Panel schedules (CSV)</option><option value="json">Save (.json)</option></select></label><label class="btn btn-outline sv-imp">Import<input type="file" accept=".json,application/json" hidden data-a="imp"></label></div>' +
      '<div class="svc-chal" hidden></div><div class="svc-main"><div class="svc-cv"><div class="svc-toast" hidden role="status"></div><div class="svc-scroll"></div><div class="svc-hint">Click a box to select it, then use Add to grow the system. The right panel explains what is happening and lets you change sizes.</div></div><div class="svc-side"></div></div>'
    h.addEventListener('click', function (e) {
      var g = e.target.closest('[data-id]'); if (g && g.closest('.svc-scroll')) { sel = g.getAttribute('data-id'); drawCanvas(); drawSide(); return }
      var b = e.target.closest('button'); if (!b) return
      var add = b.getAttribute('data-add'); if (add) return addNode(add)
      var a = b.getAttribute('data-a')
      if (a === 'chalx') { chal = null; var cs = host.querySelector('[data-a=chal]'); if (cs) cs.value = ''; drawChal() } else if (a === 'del') del(); else if (a === 'dup') dup(); else if (a === 'auto') autosize(); else if (a === 'undo') undo(-1); else if (a === 'redo') undo(1)
      else if (a === 'whole') { sel = null; drawCanvas(); drawSide() }
      else if (a === 'addc') addCircuit(b.getAttribute('data-q'))
      else if (a === 'delc') { var n = selNode(); n.circuits = n.circuits.filter(function (c) { return c.id !== b.getAttribute('data-cid') }); snap(); update() }
    })
    h.addEventListener('change', function (e) {
      var t = e.target, a = t.getAttribute('data-a')
      if (a === 'ex') { if (t.value) { var ex = K.examples.filter(function (x) { return x.id === t.value })[0]; chal = null; var cs2 = host.querySelector('[data-a=chal]'); if (cs2) cs2.value = ''; load(ex.build()); toast(ex.text) } t.value = ''; return }
      if (a === 'chal') { startChal(t.value); return }
      if (a === 'exp') { doExport(t.value); t.value = ''; return }
      if (a === 'imp') { var f = t.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { try { var j = JSON.parse(rd.result); if (!j.root) throw 0; load(j); toast('Imported ' + f.name) } catch (er) { toast('That is not a VoltCE service file (.json).') } }; rd.readAsText(f); t.value = ''; return }
      if (t.hasAttribute('data-f') || t.hasAttribute('data-cf')) setField(t)
    })
    document.addEventListener('keydown', function (e) { if (!mounted || !host.isConnected || !host.offsetParent) return; if (/input|select|textarea/i.test(e.target.tagName || '')) return; if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(e.shiftKey ? 1 : -1) } else if (e.key === 'Delete') { e.preventDefault(); del() } })
  }
  window.Svc = {
    mount: function (h) {
      if (mounted) return; build(h); mounted = true
      var saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || 'null') } catch (e) { }
      if (saved && saved.root) load(saved); else { load(K.examples[0].build()); toast(K.examples[0].text) }
    },
    load: load, model: function () { return model }, calc: function () { return R }, select: function (id) { sel = id; drawCanvas(); drawSide() }, add: addNode, auto: autosize, svg: function () { return treeSVG(true).svg }, setField: function (f, v) { var n = selNode(); var t = { getAttribute: function (k) { return k === 'data-f' ? f : null }, hasAttribute: function () { return false }, value: v, type: 'text', closest: function () { return null } }; setField(t) }
  }
})()
