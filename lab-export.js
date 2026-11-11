/* VoltCE Circuit Lab: exports (wiring diagram, wire schedule, PNG, JSON, print). */
(function (root) {
  'use strict'
  var SC = root.SimCore, SYM = root.LabSym
  var AMP = [[14, 20, '14'], [12, 25, '12'], [10, 35, '10'], [8, 50, '8'], [6, 65, '6'], [4, 85, '4'], [3, 100, '3'], [2, 115, '2'], [1, 130, '1'], [0, 150, '1/0'], [-1, 175, '2/0'], [-2, 200, '3/0'], [-3, 230, '4/0'], [-4, 255, '250 kcmil'], [-5, 285, '300 kcmil'], [-6, 310, '350 kcmil'], [-7, 335, '400 kcmil'], [-8, 380, '500 kcmil']]
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function clone(o) { return JSON.parse(JSON.stringify(o)) }
  function name(c) { return c.label !== undefined ? c.label : c.id }
  function split(k) { var i = k.indexOf('.'); return [k.slice(0, i), k.slice(i + 1)] }
  function awg(amps, v) {
    if (amps < 0.02) return 'n/a'
    if (amps <= 5 && v <= 150) return '16 (control)'
    var need = amps * 1.25
    for (var i = 0; i < AMP.length; i++) if (AMP[i][1] >= need) return AMP[i][2]
    return 'parallel / see NEC 310'
  }

  /* run the circuit for a few seconds with everything switched on, to find realistic currents and voltages */
  function analyze(model) {
    var m = clone(model), i
    m.comps.forEach(function (c) { var t = SC.TYPES[c.type]; c.props = c.props || {}; if (c.type === 'sw') c.props.on = true; if (c.type === 'estop') c.props.latched = false; if (c.type === 'brk') c.props.on = true })
    var wires = m.wires.map(function (w, k) { return { id: w.id || 'w' + k, a: w.a, b: w.b, via: w.via } })
    var out = {}
    function record(res, steady) { wires.forEach(function (w) { var r = res.wire[w.id]; if (!r) return; var o = out[w.id] || (out[w.id] = { i: 0, v: 0, ang: 0 }); if (steady && r.i > o.i) o.i = r.i; if (r.v > o.v) { o.v = r.v; o.ang = r.ang } }) }
    var sim = SC.create({ comps: m.comps, wires: wires }), res
    for (i = 0; i < 6; i++) { res = sim.step(0.05); record(res) }
    m.comps.forEach(function (c) { if (c.type === 'pbno') sim.press(c.id, true) })
    for (i = 0; i < 24; i++) { res = sim.step(0.05); record(res) }
    m.comps.forEach(function (c) { if (c.type === 'pbno') sim.press(c.id, false) })
    for (i = 0; i < 60; i++) { res = sim.step(0.05); record(res, i > 20) }
    // nets
    var parent = {}
    function f(a) { if (parent[a] === undefined) parent[a] = a; while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a] } return a }
    function u(a, b) { a = f(a); b = f(b); if (a !== b) parent[a] = b }
    wires.forEach(function (w) { u(w.a, w.b) })
    var nets = {}, order = []
    wires.forEach(function (w) { var r = f(w.a); if (!nets[r]) { nets[r] = { id: order.length + 1, i: 0, v: 0, ang: 0, keys: {}, hasN: false, hasG: false }; order.push(r) } })
    wires.forEach(function (w) { var n = nets[f(w.a)], o = out[w.id] || { i: 0, v: 0, ang: 0 }; if (o.i > n.i) n.i = o.i; if (o.v > n.v) { n.v = o.v; n.ang = o.ang }; n.keys[w.a] = 1; n.keys[w.b] = 1 })
    var vll = 0; m.comps.forEach(function (c) { if (c.type === 'src3') vll = Math.max(vll, SC.propsOf(c).vll) })
    var set = vll >= 380 ? ['Brown', 'Orange', 'Yellow'] : ['Black', 'Red', 'Blue'], neutral = vll >= 380 ? 'Gray' : 'White'
    Object.keys(nets).forEach(function (r) {
      var n = nets[r]
      Object.keys(n.keys).forEach(function (k) { var s = split(k), c = m.comps.filter(function (q) { return q.id === s[0] })[0]; if (!c) return; if (c.type === 'gnd') n.hasG = true; if (/^src/.test(c.type) && s[1] === 'N') n.hasN = true })
      if (n.hasN) n.color = neutral
      else if (n.hasG) n.color = 'Green'
      else if (n.v < 5) n.color = 'White (return; verify)'
      else if (vll >= 380 && n.v <= 150) n.color = 'Red (control)'
      else { var a = n.ang; while (a > 180) a -= 360; while (a < -180) a += 360
        n.color = Math.abs(a) < 45 ? set[0] : (a < -45 && a > -165 ? set[1] : (a > 45 && a < 165 ? set[2] : (vll ? set[1] : 'Red'))) }
      n.size = awg(n.i, n.v)
    })
    var rows = wires.map(function (w, k) {
      var n = nets[f(w.a)], a = split(w.a), b = split(w.b), ca = m.comps.filter(function (q) { return q.id === a[0] })[0], cb = m.comps.filter(function (q) { return q.id === b[0] })[0]
      return { id: w.id, net: n.id, from: (ca ? name(ca) : a[0]) + ' ' + a[1], to: (cb ? name(cb) : b[0]) + ' ' + b[1], color: n.color, size: n.size, amps: n.i, volts: n.v }
    })
    return { rows: rows, nets: nets, order: order, byWire: (function () { var o = {}; rows.forEach(function (r) { o[r.id] = r }); return o })(), f: f }
  }

  function compSpec(c) {
    var p = SC.propsOf(c), t = SC.TYPES[c.type].label, d = ''
    switch (c.type) {
      case 'src1': d = p.volts + ' V, 1-phase'; break; case 'src2': d = (p.vln * 2) + ' V split-phase'; break; case 'src3': d = p.vll + ' V, 3-phase, 4-wire'; break
      case 'fuse': d = p.amps + ' A'; break; case 'brk': d = p.amps + ' A, ' + p.poles + '-pole'; break; case 'ol': d = 'set ' + p.amps + ' A'; break
      case 'lamp': case 'heater': d = p.watts + ' W, ' + p.volts + ' V'; break; case 'motor1': d = p.volts + ' V, ' + p.fla + ' FLA'; break; case 'motor3': d = p.volts + ' V, ' + p.fla + ' FLA, 3-phase'; break
      case 'coil': d = p.tag + ' ' + p.kind + (p.kind === 'timer' ? ' ' + (p.mode === 'off' ? 'off' : 'on') + '-delay ' + p.delay + ' s' : '') + ', ' + p.volts + ' V coil'; break
      case 'cnt': d = p.tag + ' ' + p.form; break; case 'cpoles': d = p.tag + ', ' + p.poles + '-pole'; break
      case 'xfmr1': d = p.vp + '/' + p.vs + ' V, ' + p.kva + ' kVA' + (p.ct ? ', center-tap' : ''); break
      case 'xfmr3': d = (p.conn || 'dy').toUpperCase().replace('D', 'Δ').replace('Y', 'Y').split('').join('-') + ' ' + p.vp + '/' + p.vs + ' V, ' + p.kva + ' kVA'; break
      default: d = ''
    }
    return { tag: name(c), type: t, spec: d }
  }

  function bounds(model) {
    var x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9
    model.comps.forEach(function (c) {
      var b = SYM.layout(c).box, cs = [[b[0], b[1]], [b[2], b[3]], [b[0], b[3]], [b[2], b[1]]]
      cs.forEach(function (q) { var x = q[0], y = q[1], i; for (i = 0; i < (c.rot || 0); i++) { var t = x; x = -y; y = t } x1 = Math.min(x1, c.x + x); x2 = Math.max(x2, c.x + x); y1 = Math.min(y1, c.y + y); y2 = Math.max(y2, c.y + y) })
    })
    model.wires.forEach(function (w) { var pts = root.Lab.helpers.wirePts(w); if (pts) pts.forEach(function (q) { x1 = Math.min(x1, q[0]); x2 = Math.max(x2, q[0]); y1 = Math.min(y1, q[1]); y2 = Math.max(y2, q[1]) }) })
    return [x1 - 50, y1 - 40, x2 + 90, y2 + 60]
  }

  function schematic(model, an) {
    var b = bounds(model), s = '<g>'
    model.wires.forEach(function (w) {
      var pts = root.Lab.helpers.wirePts(w); if (!pts) return
      s += '<polyline points="' + pts.map(function (q) { return q[0] + ',' + q[1] }).join(' ') + '" fill="none" stroke="#5d6b7a" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>'
    })
    model.comps.forEach(function (c) {
      s += '<g transform="translate(' + c.x + ' ' + c.y + ') rotate(' + (90 * (c.rot || 0)) + ')" font-family="system-ui,sans-serif">' + SYM.draw(c, null, { rot: c.rot || 0 })
      var lay = SYM.layout(c); Object.keys(lay.terms).forEach(function (t) { s += '<circle cx="' + lay.terms[t][0] + '" cy="' + lay.terms[t][1] + '" r="3.5" fill="#fff" stroke="#1B5FC0" stroke-width="1.6"/>' }); s += '</g>'
      var bb = SYM.layout(c).box, ang = (c.rot || 0) % 2
      s += '<text x="' + c.x + '" y="' + (c.y + (ang ? (bb[2] - bb[0]) / 2 + 14 : bb[3] + 14)) + '" font-size="12" font-weight="700" text-anchor="middle" fill="#27323d" font-family="system-ui,sans-serif">' + esc(name(c)) + '</text>'
    })
    // wire number badges on the longest segment of each net's first wire
    var done = {}
    model.wires.forEach(function (w) {
      var r = an.byWire[w.id]; if (!r || done[r.net]) return; done[r.net] = 1
      var pts = root.Lab.helpers.wirePts(w); if (!pts || pts.length < 2) return
      var best = 0, bi = 0, i; for (i = 0; i < pts.length - 1; i++) { var d = Math.abs(pts[i][0] - pts[i + 1][0]) + Math.abs(pts[i][1] - pts[i + 1][1]); if (d > best) { best = d; bi = i } }
      var x = (pts[bi][0] + pts[bi + 1][0]) / 2, y = (pts[bi][1] + pts[bi + 1][1]) / 2
      s += '<g><rect x="' + (x - 11) + '" y="' + (y - 9) + '" width="22" height="18" rx="9" fill="#fff7d6" stroke="#b58a00"/><text x="' + x + '" y="' + (y + 4) + '" font-size="11" font-weight="700" text-anchor="middle" fill="#5c4400" font-family="system-ui,sans-serif">' + r.net + '</text></g>'
    })
    return { svg: s + '</g>', box: b }
  }

  function diagramSVG(model) {
    var an = analyze(model), sc = schematic(model, an), b = sc.box, W = Math.max(1000, b[2] - b[0]), H = b[3] - b[1]
    var title = 'Wiring diagram', date = new Date().toISOString().slice(0, 10)
    var comps = model.comps.filter(function (c) { return c.type !== 'gnd' }).map(compSpec)
    var rows = []; var seen = {}
    an.rows.forEach(function (r) { rows.push(r) })
    var top = 56, y0 = top + H + 30, rowH = 18, svg = ''
    var tableH = (comps.length + 3) * rowH + (rows.length + 3) * rowH + 90, total = y0 + tableH + 60
    svg += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + total + '" width="' + W + '" height="' + total + '" font-family="system-ui,sans-serif">'
    svg += '<rect width="100%" height="100%" fill="#fff"/><text x="20" y="30" font-size="22" font-weight="700" fill="#12408A">' + title + '</text><text x="20" y="48" font-size="11" fill="#56636F">VoltCE Circuit Lab · ' + date + ' · teaching diagram: check sizes and protection against the NEC and your local rules before building</text>'
    svg += '<g transform="translate(' + (20 - b[0]) + ' ' + (top - b[1]) + ')">' + sc.svg + '</g>'
    var y = y0
    svg += '<text x="20" y="' + y + '" font-size="14" font-weight="700" fill="#14202C">Parts</text>'; y += rowH
    svg += '<text x="20" y="' + y + '" font-size="11" font-weight="700" fill="#56636F">TAG</text><text x="160" y="' + y + '" font-size="11" font-weight="700" fill="#56636F">PART</text><text x="360" y="' + y + '" font-size="11" font-weight="700" fill="#56636F">RATING</text>'; y += 4
    svg += '<line x1="20" y1="' + y + '" x2="' + (W - 20) + '" y2="' + y + '" stroke="#C9D0D7"/>'; y += rowH - 4
    comps.forEach(function (c) { svg += '<text x="20" y="' + y + '" font-size="12" fill="#14202C">' + esc(c.tag) + '</text><text x="160" y="' + y + '" font-size="12" fill="#14202C">' + esc(c.type) + '</text><text x="360" y="' + y + '" font-size="12" fill="#14202C">' + esc(c.spec) + '</text>'; y += rowH })
    y += 22
    svg += '<text x="20" y="' + y + '" font-size="14" font-weight="700" fill="#14202C">Wire schedule (wire number = electrical net)</text>'; y += rowH
    var cols = [20, 70, 250, 430, 560, 680, 770]
    ;['NO.', 'FROM', 'TO', 'COLOR', 'SIZE (AWG, Cu 75°C)', 'AMPS', 'VOLTS TO GND'].forEach(function (t, i) { svg += '<text x="' + cols[i] + '" y="' + y + '" font-size="11" font-weight="700" fill="#56636F">' + t + '</text>' }); y += 4
    svg += '<line x1="20" y1="' + y + '" x2="' + (W - 20) + '" y2="' + y + '" stroke="#C9D0D7"/>'; y += rowH - 4
    rows.forEach(function (r) { var vals = [r.net, r.from, r.to, r.color, r.size, r.amps < 0.02 ? '' : r.amps.toFixed(r.amps < 10 ? 2 : 1), r.volts < 1 ? '' : Math.round(r.volts)]; vals.forEach(function (v, i) { svg += '<text x="' + cols[i] + '" y="' + y + '" font-size="12" fill="#14202C">' + esc(v) + '</text>' }); y += rowH })
    y += 14
    svg += '<text x="20" y="' + y + '" font-size="10" fill="#56636F">Currents come from the simulation with all switches on and start buttons pressed once. Sizes use 125% of that current at 75 °C copper (NEC Table 310.16); motor circuits and overcurrent devices follow Article 430.</text>'
    return svg + '</svg>'
  }

  function csv(model) {
    var an = analyze(model), lines = ['Wire no.,From,To,Color,Size (AWG Cu 75C),Est. current (A),Voltage (V)']
    an.rows.forEach(function (r) { lines.push([r.net, r.from, r.to, r.color, r.size, r.amps < 0.02 ? '' : r.amps.toFixed(2), r.volts < 1 ? '' : Math.round(r.volts)].map(function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v }).join(',')) })
    return lines.join('\n')
  }
  function download(name, mime, data) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: mime }), a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove() }, 500)
  }
  function toPNG(svgText, cb) {
    var img = new Image(), url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }))
    img.onload = function () { var c = document.createElement('canvas'), k = 2; c.width = img.width * k; c.height = img.height * k; var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.scale(k, k); g.drawImage(img, 0, 0); URL.revokeObjectURL(url); c.toBlob(cb, 'image/png') }
    img.onerror = function () { URL.revokeObjectURL(url) }; img.src = url
  }
  function run(kind, Lab) {
    var model = Lab.model()
    if (!model.comps.length) { alert('Build a circuit first.'); return }
    if (kind === 'json') download('voltce-circuit.json', 'application/json', JSON.stringify({ app: 'VoltCE Circuit Lab', version: 1, comps: model.comps, wires: model.wires }, null, 1))
    else if (kind === 'wires') download('voltce-wire-schedule.csv', 'text/csv', csv(model))
    else if (kind === 'diagram') download('voltce-wiring-diagram.svg', 'image/svg+xml', diagramSVG(model))
    else if (kind === 'png') { var b = bounds(model), sc = schematic(model, analyze(model)); var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + b.join(' ') + '" width="' + (b[2] - b[0]) + '" height="' + (b[3] - b[1]) + '"><rect x="' + b[0] + '" y="' + b[1] + '" width="100%" height="100%" fill="#fff"/>' + sc.svg + '</svg>'; toPNG(svg, function (blob) { download('voltce-schematic.png', 'image/png', blob) }) }
    else if (kind === 'print') {
      var w = window.open('', '_blank'); if (!w) { alert('Allow pop-ups to print the diagram.'); return }
      w.document.write('<!doctype html><title>Wiring diagram</title><style>body{margin:12px}svg{max-width:100%;height:auto}</style>' + diagramSVG(model) + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>'); w.document.close()
    }
  }
  root.LabExport = { run: run, analyze: analyze, diagramSVG: diagramSVG, csv: csv, awg: awg }
})(typeof self !== 'undefined' ? self : this)
