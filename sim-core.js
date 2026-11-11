/* VoltCE Circuit Lab: simulation engine (pure logic, no DOM).
   Steady-state AC phasor analysis (modified nodal analysis) stepped in time, so relays latch,
   timers count, breakers trip, fuses blow and wrong wiring fails.  Teaching model, not a design tool.
   Usage: var sim = SimCore.create(circuit); sim.step(0.05); sim.result */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.SimCore = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'
  var SQ3 = Math.sqrt(3), D2R = Math.PI / 180
  var G_ON = 200, GMIN = 1e-8
  function cx(re, im) { return { re: re, im: im || 0 } }
  function polar(m, deg) { return { re: m * Math.cos(deg * D2R), im: m * Math.sin(deg * D2R) } }
  function cabs(a) { return Math.hypot(a.re, a.im) }
  function cmul(a, b) { return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re } }
  function cdiv(a, b) { var d = b.re * b.re + b.im * b.im || 1e-30; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d } }
  function csub(a, b) { return { re: a.re - b.re, im: a.im - b.im } }
  function cadd(a, b) { return { re: a.re + b.re, im: a.im + b.im } }
  function cconj(a) { return { re: a.re, im: -a.im } }
  var ZERO = cx(0, 0)

  /* ---------- component catalog ---------- */
  var T = {}
  function def(type, label, group, defaults, terms) { T[type] = { type: type, label: label, group: group, defaults: defaults, terms: terms } }
  var fixed = function (a) { return function () { return a } }
  def('src1', '120 V source', 'Sources', { volts: 120, avail: 10000 }, fixed(['L', 'N']))
  def('src2', '240 V split-phase', 'Sources', { vln: 120, avail: 10000 }, fixed(['L1', 'N', 'L2']))
  def('src3', '3-phase source', 'Sources', { vll: 480, avail: 22000 }, fixed(['L1', 'L2', 'L3', 'N']))
  def('gnd', 'Ground', 'Sources', {}, fixed(['g']))
  def('sw', 'Switch', 'Controls', { on: false }, fixed(['a', 'b']))
  def('sw2', '3-way switch', 'Controls', { pos: 1 }, fixed(['c', 't1', 't2']))
  def('pbno', 'Push button (NO)', 'Controls', { tag: '' }, fixed(['a', 'b']))
  def('pbnc', 'Push button (NC)', 'Controls', { tag: '' }, fixed(['a', 'b']))
  def('estop', 'E-stop (NC)', 'Controls', { latched: false }, fixed(['a', 'b']))
  def('fuse', 'Fuse', 'Protection', { amps: 15 }, fixed(['a', 'b']))
  def('brk', 'Circuit breaker', 'Protection', { amps: 20, poles: 1, on: true }, function (p) { var o = [], i; for (i = 1; i <= (p.poles || 1); i++) o.push('in' + i, 'out' + i); return o })
  def('ol', 'Overload relay', 'Protection', { amps: 10 }, fixed(['L1', 'L2', 'L3', 'T1', 'T2', 'T3', '95', '96']))
  def('lamp', 'Lamp', 'Loads', { volts: 120, watts: 60 }, fixed(['a', 'b']))
  def('heater', 'Heater', 'Loads', { volts: 240, watts: 4500 }, fixed(['a', 'b']))
  def('motor1', 'Motor 1-phase', 'Loads', { volts: 120, fla: 9.8, pf: 0.85 }, fixed(['a', 'b']))
  def('motor3', 'Motor 3-phase', 'Loads', { volts: 480, fla: 7.6, pf: 0.85 }, fixed(['T1', 'T2', 'T3']))
  def('coil', 'Relay / contactor coil', 'Relays', { tag: 'M1', volts: 120, kind: 'relay', delay: 3, mode: 'on' }, fixed(['A1', 'A2']))
  def('cnt', 'Contact', 'Relays', { tag: 'M1', form: 'NO' }, fixed(['a', 'b']))
  def('cpoles', 'Power contacts', 'Relays', { tag: 'M1', poles: 3 }, function (p) { var o = [], i; for (i = 1; i <= (p.poles || 3); i++) o.push('L' + i, 'T' + i); return o })
  def('xfmr1', 'Transformer 1-phase', 'Transformers', { vp: 480, vs: 120, kva: 1, ct: false, zpu: 0.05 }, function (p) { return p.ct ? ['H1', 'H2', 'X1', 'X0', 'X2'] : ['H1', 'H2', 'X1', 'X2'] })
  def('xfmr3', 'Transformer 3-phase', 'Transformers', { conn: 'dy', vp: 480, vs: 208, kva: 15, zpu: 0.05 }, function (p) { var c = p.conn || 'dy', o = ['H1', 'H2', 'H3']; if (c[0] === 'y') o.push('H0'); o.push('X1', 'X2', 'X3'); if (c[1] === 'y') o.push('X0'); return o })
  def('vm', 'Voltmeter', 'Meters', {}, fixed(['a', 'b']))
  def('am', 'Ammeter', 'Meters', {}, fixed(['a', 'b']))

  function termsOf(c) { var d = T[c.type]; if (!d) return []; return d.terms(Object.assign({}, d.defaults, c.props || {})) }
  function propsOf(c) { return Object.assign({}, T[c.type].defaults, c.props || {}) }

  /* ---------- complex linear solve ---------- */
  function solveLinear(n, Are, Aim, bre, bim) {
    var i, j, k, p, m, f, tr, ti, mag, best
    for (k = 0; k < n; k++) {
      p = k; best = Math.hypot(Are[k][k], Aim[k][k])
      for (i = k + 1; i < n; i++) { mag = Math.hypot(Are[i][k], Aim[i][k]); if (mag > best) { best = mag; p = i } }
      if (best < 1e-30) { Are[k][k] = 1e-12; best = 1e-12 }
      if (p !== k) { tr = Are[k]; Are[k] = Are[p]; Are[p] = tr; tr = Aim[k]; Aim[k] = Aim[p]; Aim[p] = tr; tr = bre[k]; bre[k] = bre[p]; bre[p] = tr; tr = bim[k]; bim[k] = bim[p]; bim[p] = tr }
      var dr = Are[k][k], di = Aim[k][k], dd = dr * dr + di * di
      for (i = k + 1; i < n; i++) {
        var ar = Are[i][k], ai = Aim[i][k]; if (ar === 0 && ai === 0) continue
        var fr = (ar * dr + ai * di) / dd, fi = (ai * dr - ar * di) / dd
        for (j = k; j < n; j++) { tr = Are[k][j]; ti = Aim[k][j]; Are[i][j] -= fr * tr - fi * ti; Aim[i][j] -= fr * ti + fi * tr }
        tr = bre[k]; ti = bim[k]; bre[i] -= fr * tr - fi * ti; bim[i] -= fr * ti + fi * tr
      }
    }
    var xr = new Array(n), xi = new Array(n)
    for (i = n - 1; i >= 0; i--) {
      var sr = bre[i], si = bim[i]
      for (j = i + 1; j < n; j++) { sr -= Are[i][j] * xr[j] - Aim[i][j] * xi[j]; si -= Are[i][j] * xi[j] + Aim[i][j] * xr[j] }
      var qr = Are[i][i], qi = Aim[i][i], qd = qr * qr + qi * qi
      xr[i] = (sr * qr + si * qi) / qd; xi[i] = (si * qr - sr * qi) / qd
    }
    return { re: xr, im: xi }
  }

  /* ---------- simulator ---------- */
  function create(circuit) {
    var sim = { circuit: circuit, time: 0, events: [], result: null }
    var comps = circuit.comps, wires = circuit.wires || []
    var byId = {}, i
    comps.forEach(function (c) { byId[c.id] = c })
    var CS = {}   // per-component dynamic state
    var coilTags = {}   // tag -> {on, acc, active}

    function resetState() {
      comps.forEach(function (c) {
        CS[c.id] = { heat: 0, blown: false, tripped: false, burnt: false, destroyed: false, startT: 0, pressed: false, coilOn: false, sp: false, overheated: false, stall: false }
      })
      coilTags = {}
      sim.time = 0; sim.events = []
    }
    resetState()

    /* ---- node map ---- */
    var parent = {}
    function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a] } return a }
    function union(a, b) { a = find(a); b = find(b); if (a !== b) parent[a] = b }
    function key(c, t) { return c.id + '.' + t }
    var GKEY = '__ground'
    parent[GKEY] = GKEY
    comps.forEach(function (c) { termsOf(c).forEach(function (t) { parent[key(c, t)] = key(c, t) }) })
    comps.forEach(function (c) {
      if (c.type === 'gnd') union(key(c, 'g'), GKEY)
      if (c.type === 'src1' || c.type === 'src2' || c.type === 'src3') union(key(c, 'N'), GKEY)
    })
    wires.forEach(function (w) { if (parent[w.a] !== undefined && parent[w.b] !== undefined) union(w.a, w.b) })
    var nodeOf = {}, nNodes = 1, rootIdx = {}
    rootIdx[find(GKEY)] = 0
    Object.keys(parent).forEach(function (k) { var r = find(k); if (rootIdx[r] === undefined) rootIdx[r] = nNodes++; nodeOf[k] = rootIdx[r] })
    function nd(c, t) { return nodeOf[key(c, t)] }
    var internalBase = nNodes   // internal nodes (transformer leakage) are appended after these

    function ev(type, comp, msg, extra) { var e = { t: sim.time, type: type, comp: comp, msg: msg }; if (extra) Object.assign(e, extra); sim.events.push(e); sim.newEvents.push(e) }

    function pickR(c) { return c.props.on }
    /* is a two-terminal element conducting? */
    function closedState(c, p) {
      var s = CS[c.id], tag, ct
      switch (c.type) {
        case 'sw': return !!p.on
        case 'pbno': return s.pressed
        case 'pbnc': return !s.pressed
        case 'estop': return !p.latched
        case 'fuse': return !s.blown
        case 'ol': return true
        case 'cnt': ct = coilTags[String(p.tag).toLowerCase()] || { on: false, active: false }
          if (p.form === 'NO') return ct.active; if (p.form === 'NC') return !ct.active
          if (p.form === 'NOTD') return ct.timed; if (p.form === 'NCTD') return !ct.timed
          return false
      }
      return true
    }

    /* ---- build stamp description & solve ---- */
    function solve() {
      var extra = []  // ideal windings
      var nInternal = 0
      function newNode() { return internalBase + (nInternal++) }
      var stamps = []  // {a,b,g:{re,im}} admittances ; injections
      var inj = []     // {n, v:{re,im}}
      var info = {}    // per component data for current reporting
      function Y(a, b, y) { stamps.push({ a: a, b: b, y: y }) }
      var wind = []    // {p1,p2,s1,s2,n,comp,tag}
      var srcList = []

      comps.forEach(function (c) {
        var p = propsOf(c), s = CS[c.id], t = termsOf(c), g
        function N(x) { return nd(c, x) }
        switch (c.type) {
          case 'src1': case 'src2': case 'src3': {
            if (s.destroyed) break
            var phs = []
            if (c.type === 'src1') phs = [['L', polar(p.volts, 0)]]
            else if (c.type === 'src2') phs = [['L1', polar(p.vln, 0)], ['L2', polar(p.vln, 180)]]
            else { var vln = p.vll / SQ3; phs = [['L1', polar(vln, 0)], ['L2', polar(vln, -120)], ['L3', polar(vln, 120)]] }
            phs.forEach(function (ph) {
              var vmag = cabs(ph[1]), Z = vmag / (p.avail || 10000), G = 1 / Z
              Y(N(ph[0]), 0, cx(G, 0)); inj.push({ n: N(ph[0]), v: { re: ph[1].re * G, im: ph[1].im * G } })
              srcList.push({ comp: c, term: ph[0], vs: ph[1], G: G })
            })
            break
          }
          case 'sw': case 'pbno': case 'pbnc': case 'estop': case 'fuse': case 'cnt':
            if (closedState(c, p)) Y(N('a'), N('b'), cx(G_ON, 0))
            break
          case 'sw2': Y(N('c'), N(p.pos === 2 ? 't2' : 't1'), cx(G_ON, 0)); break
          case 'brk': if (p.on && !s.tripped) for (var k = 1; k <= p.poles; k++) Y(N('in' + k), N('out' + k), cx(G_ON, 0)); break
          case 'ol': Y(N('L1'), N('T1'), cx(G_ON, 0)); Y(N('L2'), N('T2'), cx(G_ON, 0)); Y(N('L3'), N('T3'), cx(G_ON, 0))
            if (!s.tripped) Y(N('95'), N('96'), cx(G_ON, 0)); break
          case 'cpoles': if (coilTags[String(p.tag).toLowerCase()] && coilTags[String(p.tag).toLowerCase()].active) for (var q = 1; q <= p.poles; q++) Y(N('L' + q), N('T' + q), cx(G_ON, 0)); break
          case 'lamp': case 'heater':
            if (!s.burnt) Y(N('a'), N('b'), cx(p.watts / (p.volts * p.volts), 0))
            break
          case 'coil':
            if (!s.burnt) Y(N('A1'), N('A2'), cx(10 / (p.volts * p.volts), 0))
            break
          case 'motor1': {
            if (s.burnt) break
            var z = p.volts / p.fla, ph = Math.acos(Math.min(1, p.pf)), f = s.lockedRotor ? 1 / 5 : 1
            var zr = z * Math.cos(ph) * f, zi = z * Math.sin(ph) * f; g = cdiv(cx(1, 0), cx(zr, zi)); Y(N('a'), N('b'), g); break
          }
          case 'motor3': {
            if (s.burnt) break
            var zy = (p.volts / SQ3) / p.fla, ph3 = Math.acos(Math.min(1, p.pf)), f3 = s.lockedRotor ? 1 / 5 : 1
            var zd = cx(3 * zy * Math.cos(ph3) * f3, 3 * zy * Math.sin(ph3) * f3), gd = cdiv(cx(1, 0), zd)
            Y(N('T1'), N('T2'), gd); Y(N('T2'), N('T3'), gd); Y(N('T3'), N('T1'), gd); break
          }
          case 'vm': Y(N('a'), N('b'), cx(1e-6, 0)); break
          case 'am': Y(N('a'), N('b'), cx(1000, 0)); break
          case 'xfmr1': {
            if (s.burnt) break
            var ct = p.ct, vwind = ct ? p.vs / 2 : p.vs, nr = p.vp / vwind, kvaW = ct ? p.kva / 2 : p.kva
            var Zb = (vwind * vwind) / (kvaW * 1000) * p.zpu, Z = cx(Zb * 0.24, Zb * 0.97), Yz = cdiv(cx(1, 0), Z)
            var pairs = ct ? [['X1', 'X0'], ['X0', 'X2']] : [['X1', 'X2']]
            pairs.forEach(function (pr, idx) {
              var sp = newNode()
              // series leakage between the internal node and the outward-facing terminal on the positive side
              var outTerm = pr[0]
              Y(sp, N(outTerm), Yz)
              wind.push({ p1: N('H1'), p2: N('H2'), s1: sp, s2: N(pr[1]), n: nr, comp: c, pole: idx })
            })
            break
          }
          case 'xfmr3': {
            if (s.burnt) break
            var cn = p.conn, pri = cn[0], sec = cn[1]
            var vpw = pri === 'd' ? p.vp : p.vp / SQ3, vsw = sec === 'd' ? p.vs : p.vs / SQ3, nr3 = vpw / vsw
            var kw = p.kva / 3, Zb3 = (vsw * vsw) / (kw * 1000) * p.zpu, Z3 = cx(Zb3 * 0.24, Zb3 * 0.97), Y3 = cdiv(cx(1, 0), Z3)
            var H = ['H1', 'H2', 'H3'], X = ['X1', 'X2', 'X3'], j
            for (j = 0; j < 3; j++) {
              var p1 = N(H[j]), p2 = pri === 'd' ? N(H[(j + 2) % 3]) : N('H0')
              var spn = newNode(), sTerm = X[j], s2n = sec === 'd' ? N(X[(j + 2) % 3]) : N('X0')
              // ANSI: low side lags high side by 30 degrees for Δ-Y
              Y(spn, N(sTerm), Y3)
              wind.push({ p1: p1, p2: p2, s1: spn, s2: s2n, n: nr3, comp: c, pole: j })
            }
            break
          }
        }
      })

      var nBase = nNodes - 1 + nInternal, nUnk = nBase + wind.length
      var Are = [], Aim = [], bre = new Array(nUnk).fill(0), bim = new Array(nUnk).fill(0), r, cI
      for (r = 0; r < nUnk; r++) { Are.push(new Array(nUnk).fill(0)); Aim.push(new Array(nUnk).fill(0)) }
      function row(nodeIdx) { return nodeIdx === 0 ? -1 : (nodeIdx < internalBase ? nodeIdx - 1 : (nNodes - 1) + (nodeIdx - internalBase)) }
      function add(rw, cl, y) { if (rw < 0 || cl < 0) return; Are[rw][cl] += y.re; Aim[rw][cl] += y.im }
      stamps.forEach(function (st) {
        var ra = row(st.a), rb = row(st.b)
        add(ra, ra, st.y); add(rb, rb, st.y)
        var ny = { re: -st.y.re, im: -st.y.im }
        add(ra, rb, ny); add(rb, ra, ny)
      })
      for (r = 0; r < nBase; r++) Are[r][r] += GMIN
      inj.forEach(function (x) { var rw = row(x.n); if (rw >= 0) { bre[rw] += x.v.re; bim[rw] += x.v.im } })
      wind.forEach(function (w, k) {
        var col = nBase + k, a = row(w.p1), b = row(w.p2), c1 = row(w.s1), c2 = row(w.s2)
        if (a >= 0) { Are[a][col] += 1; Are[col][a] += 1 }
        if (b >= 0) { Are[b][col] -= 1; Are[col][b] -= 1 }
        if (c1 >= 0) { Are[c1][col] -= w.n; Are[col][c1] -= w.n }
        if (c2 >= 0) { Are[c2][col] += w.n; Are[col][c2] += w.n }
      })
      var sol = solveLinear(nUnk, Are, Aim, bre, bim)
      var V = [cx(0, 0)]
      for (r = 1; r < internalBase; r++) V.push({ re: sol.re[r - 1], im: sol.im[r - 1] })
      var VI = []; for (r = 0; r < nInternal; r++) VI.push({ re: sol.re[nNodes - 1 + r], im: sol.im[nNodes - 1 + r] })
      function vAt(idx) { return idx < internalBase ? V[idx] : VI[idx - internalBase] }
      var Iw = wind.map(function (w, k) { return { re: sol.re[nBase + k], im: sol.im[nBase + k] } })
      return { V: V, vAt: vAt, stamps: stamps, wind: wind, Iw: Iw, srcList: srcList, nd: nd }
    }

    function vcomp(S, c, a, b) { return csub(S.V[nd(c, a)], S.V[nd(c, b)]) }
    function yI(S, c, a, b, y) { return cmul(y, csub(S.V[nd(c, a)], S.V[nd(c, b)])) }

    /* compute currents per terminal (into the component) and component readings */
    function measure(S) {
      var tI = {}, out = {}
      function addT(c, t, i) { var k = key(c, t); tI[k] = tI[k] ? cadd(tI[k], i) : i }
      comps.forEach(function (c) {
        var p = propsOf(c), s = CS[c.id], N = function (x) { return nd(c, x) }, V = S.V
        var o = { i: 0, v: 0, p: 0, status: 'ok' }
        out[c.id] = o
        function twoTerm(a, b, closed, y) {
          if (!closed) return cx(0, 0)
          var i = cmul(y, csub(V[N(a)], V[N(b)])); addT(c, a, i); addT(c, b, { re: -i.re, im: -i.im }); return i
        }
        switch (c.type) {
          case 'src1': case 'src2': case 'src3': {
            if (s.destroyed) { o.status = 'destroyed'; break }
            var tot = 0
            S.srcList.forEach(function (sl) { if (sl.comp !== c) return; var vp = V[N(sl.term)]; var iin = cmul(csub(vp, sl.vs), cx(sl.G, 0)); addT(c, sl.term, iin); tot = Math.max(tot, cabs(iin)) })
            var sumI = ZERO; S.srcList.forEach(function (sl) { if (sl.comp !== c) return; sumI = cadd(sumI, cmul(csub(V[N(sl.term)], sl.vs), cx(sl.G, 0))) }); addT(c, 'N', { re: -sumI.re, im: -sumI.im })
            o.i = tot; o.v = c.type === 'src1' ? p.volts : (c.type === 'src2' ? p.vln * 2 : p.vll); break
          }
          case 'sw': case 'pbno': case 'pbnc': case 'estop': case 'fuse': case 'cnt': {
            var closed = closedState(c, p), i2 = twoTerm('a', 'b', closed, cx(G_ON, 0)); o.i = cabs(i2); o.closed = closed; o.v = cabs(vcomp(S, c, 'a', 'b')); break
          }
          case 'sw2': { var tt = p.pos === 2 ? 't2' : 't1', i3 = cmul(cx(G_ON, 0), csub(V[N('c')], V[N(tt)])); addT(c, 'c', i3); addT(c, tt, { re: -i3.re, im: -i3.im }); o.i = cabs(i3); break }
          case 'brk': { var mx = 0; if (p.on && !s.tripped) for (var k = 1; k <= p.poles; k++) { var ik = cmul(cx(G_ON, 0), csub(V[N('in' + k)], V[N('out' + k)])); addT(c, 'in' + k, ik); addT(c, 'out' + k, { re: -ik.re, im: -ik.im }); mx = Math.max(mx, cabs(ik)) } o.i = mx; o.closed = p.on && !s.tripped; break }
          case 'ol': { var m2 = 0;[['L1', 'T1'], ['L2', 'T2'], ['L3', 'T3']].forEach(function (pr) { var ii = cmul(cx(G_ON, 0), csub(V[N(pr[0])], V[N(pr[1])])); addT(c, pr[0], ii); addT(c, pr[1], { re: -ii.re, im: -ii.im }); m2 = Math.max(m2, cabs(ii)) })
            if (!s.tripped) { var ia = cmul(cx(G_ON, 0), csub(V[N('95')], V[N('96')])); addT(c, '95', ia); addT(c, '96', { re: -ia.re, im: -ia.im }) }
            o.i = m2; break }
          case 'cpoles': { var tg = coilTags[String(p.tag).toLowerCase()], m3 = 0; o.closed = !!(tg && tg.active); if (o.closed) for (var q = 1; q <= p.poles; q++) { var iq = cmul(cx(G_ON, 0), csub(V[N('L' + q)], V[N('T' + q)])); addT(c, 'L' + q, iq); addT(c, 'T' + q, { re: -iq.re, im: -iq.im }); m3 = Math.max(m3, cabs(iq)) } o.i = m3; break }
          case 'lamp': case 'heater': { if (s.burnt) { o.status = 'burnt'; break } var Vv = vcomp(S, c, 'a', 'b'), y = p.watts / (p.volts * p.volts), ii2 = cmul(cx(y, 0), Vv); addT(c, 'a', ii2); addT(c, 'b', { re: -ii2.re, im: -ii2.im }); o.v = cabs(Vv); o.i = cabs(ii2); o.p = o.v * o.v * y; o.ratio = o.v / p.volts; break }
          case 'coil': { if (s.burnt) { o.status = 'burnt'; break } var Vc = vcomp(S, c, 'A1', 'A2'), yc = 10 / (p.volts * p.volts), ic = cmul(cx(yc, 0), Vc); addT(c, 'A1', ic); addT(c, 'A2', { re: -ic.re, im: -ic.im }); o.v = cabs(Vc); o.i = cabs(ic); o.ratio = o.v / p.volts; break }
          case 'motor1': { if (s.burnt) { o.status = 'burnt'; break } var Vm = vcomp(S, c, 'a', 'b'), z = p.volts / p.fla, ph = Math.acos(Math.min(1, p.pf)), f = s.lockedRotor ? 0.2 : 1
            var ym = cdiv(cx(1, 0), cx(z * Math.cos(ph) * f, z * Math.sin(ph) * f)), im1 = cmul(ym, Vm); addT(c, 'a', im1); addT(c, 'b', { re: -im1.re, im: -im1.im }); o.v = cabs(Vm); o.i = cabs(im1); o.ratio = o.v / p.volts; o.p = o.v * o.i * p.pf; break }
          case 'motor3': { if (s.burnt) { o.status = 'burnt'; break }
            var zy = (p.volts / SQ3) / p.fla, ph3 = Math.acos(Math.min(1, p.pf)), f3 = s.lockedRotor ? 0.2 : 1
            var gd = cdiv(cx(1, 0), cx(3 * zy * Math.cos(ph3) * f3, 3 * zy * Math.sin(ph3) * f3))
            var v12 = csub(V[N('T1')], V[N('T2')]), v23 = csub(V[N('T2')], V[N('T3')]), v31 = csub(V[N('T3')], V[N('T1')])
            var i12 = cmul(gd, v12), i23 = cmul(gd, v23), i31 = cmul(gd, v31)
            var l1 = csub(i12, i31), l2 = csub(i23, i12), l3 = csub(i31, i23)
            addT(c, 'T1', l1); addT(c, 'T2', l2); addT(c, 'T3', l3)
            var ia1 = cabs(l1), ia2 = cabs(l2), ia3 = cabs(l3), mxi = Math.max(ia1, ia2, ia3), mni = Math.min(ia1, ia2, ia3)
            o.i = mxi; o.imin = mni; o.v = (cabs(v12) + cabs(v23) + cabs(v31)) / 3; o.ratio = o.v / p.volts
            // rotation direction from phase sequence: ABC => V2 lags V1 by 120 => Im(conj(V1)*V2) < 0
            var cr = cmul(cconj(V[N('T1')]), V[N('T2')]); o.dir = cr.im < 0 ? 1 : -1
            o.p = SQ3 * o.v * ((ia1 + ia2 + ia3) / 3) * p.pf; break }
          case 'vm': { var vv = vcomp(S, c, 'a', 'b'), iv = cmul(cx(1e-6, 0), vv); addT(c, 'a', iv); addT(c, 'b', { re: -iv.re, im: -iv.im }); o.v = cabs(vv); o.reading = o.v; break }
          case 'am': { var ia_ = cmul(cx(1000, 0), vcomp(S, c, 'a', 'b')); addT(c, 'a', ia_); addT(c, 'b', { re: -ia_.re, im: -ia_.im }); o.i = cabs(ia_); o.reading = o.i; break }
          case 'xfmr1': case 'xfmr3': if (s.burnt) o.status = 'burnt'; break
        }
      })
      // transformer terminal currents, computed explicitly (primary side from windings, secondary through leakage Z)
      comps.forEach(function (c) {
        if ((c.type !== 'xfmr1' && c.type !== 'xfmr3') || CS[c.id].burnt) return
        var p = propsOf(c), idx = 0
        S.wind.forEach(function (w, k) {
          if (w.comp !== c) return
          var ip = S.Iw[k], isec = { re: -w.n * ip.re, im: -w.n * ip.im }
          if (c.type === 'xfmr1') {
            addT(c, 'H1', ip); addT(c, 'H2', { re: -ip.re, im: -ip.im })
            var outP = p.ct ? (w.pole === 0 ? 'X1' : 'X0') : 'X1', outN = p.ct ? (w.pole === 0 ? 'X0' : 'X2') : 'X2'
            // current flows from external terminal (positive side) into winding via leakage
            if (!p.ct) { addT(c, 'X1', isec); addT(c, 'X2', { re: -isec.re, im: -isec.im }) }
            else if (w.pole === 0) { addT(c, 'X1', isec); addT(c, 'X0', { re: -isec.re, im: -isec.im }) }
            else { addT(c, 'X0', isec); addT(c, 'X2', { re: -isec.re, im: -isec.im }) }
          } else {
            var cn = p.conn, j = w.pole, Hs = ['H1', 'H2', 'H3'], Xs = ['X1', 'X2', 'X3']
            addT(c, Hs[j], ip); addT(c, cn[0] === 'd' ? Hs[(j + 2) % 3] : 'H0', { re: -ip.re, im: -ip.im })
            addT(c, Xs[j], isec); addT(c, cn[1] === 'd' ? Xs[(j + 2) % 3] : 'X0', { re: -isec.re, im: -isec.im })
          }
        })
        var o = {}, ratedP = c.type === 'xfmr1' ? (p.kva * 1000 / p.vp) : (p.kva * 1000 / (SQ3 * p.vp))
        var tl = c.type === 'xfmr1' ? ['H1', 'H2'] : ['H1', 'H2', 'H3'], mx = 0
        tl.forEach(function (t) { var iv = tI[key(c, t)]; if (iv) mx = Math.max(mx, cabs(iv)) })
        out[c.id].i = mx; out[c.id].ratedI = ratedP; out[c.id].ratio = ratedP ? mx / ratedP : 0
        var tsx = c.type === 'xfmr1' ? (p.ct ? ['X1', 'X0', 'X2'] : ['X1', 'X2']) : ['X1', 'X2', 'X3']
        var vs2 = c.type === 'xfmr1' ? (p.ct ? V2(S, c, 'X1', 'X2') : V2(S, c, 'X1', 'X2')) : V2(S, c, 'X1', 'X2')
        out[c.id].vsec = vs2; out[c.id].vpri = c.type === 'xfmr1' ? V2(S, c, 'H1', 'H2') : V2(S, c, 'H1', 'H2')
      })
      function V2(S, c, a, b) { return cabs(csub(S.V[nd(c, a)], S.V[nd(c, b)])) }
      return { tI: tI, out: out }
    }

    function wireFlows(S, M) {
      // net graph over terminals; tree flow solution
      var adj = {}, wi = {}
      wires.forEach(function (w, idx) {
        if (parent[w.a] === undefined || parent[w.b] === undefined) return
        ;(adj[w.a] = adj[w.a] || []).push({ to: w.b, w: w, idx: idx, dir: 1 })
        ;(adj[w.b] = adj[w.b] || []).push({ to: w.a, w: w, idx: idx, dir: -1 })
      })
      var seen = {}, res = {}
      function injOf(k) { var v = M.tI[k]; return v ? { re: -v.re, im: -v.im } : { re: 0, im: 0 } }
      Object.keys(adj).forEach(function (start) {
        if (seen[start]) return
        // iterative DFS to build tree
        var order = [], par = {}, stack = [start]; seen[start] = true; par[start] = null
        while (stack.length) {
          var u = stack.pop(); order.push(u)
          ;(adj[u] || []).forEach(function (e) { if (!seen[e.to]) { seen[e.to] = true; par[e.to] = { from: u, e: e }; stack.push(e.to) } })
        }
        var sub = {}; order.forEach(function (u) { sub[u] = injOf(u) })
        for (var k = order.length - 1; k > 0; k--) {
          var u2 = order[k], pr = par[u2]; if (!pr) continue
          // flow from u2 toward its parent = sub[u2]
          var f = sub[u2], e = pr.e
          // e is the edge from parent (pr.from) to u2 ; flow along wire direction a->b
          // if wire.a === u2 then flow a->b = f ; else flow a->b = -f
          var ab = (e.w.a === u2) ? f : { re: -f.re, im: -f.im }
          res[e.w.id !== undefined ? e.w.id : e.idx] = ab
          sub[pr.from] = cadd(sub[pr.from], f)
        }
      })
      return res
    }

    /* ---- step logic ---- */
    function setCoils(S, M) {
      var changed = false, byTag = {}
      comps.forEach(function (c) {
        if (c.type !== 'coil') return
        var p = propsOf(c), s = CS[c.id], tag = String(p.tag).toLowerCase(), v = 0
        if (!s.burnt) { var cv = csub(S.V[nd(c, 'A1')], S.V[nd(c, 'A2')]); v = cabs(cv) }
        var ratio = v / p.volts, was = s.coilOn
        s.coilOn = was ? ratio >= 0.5 : ratio >= 0.85
        s.coilRatio = ratio
        var t = byTag[tag] = byTag[tag] || { on: false, kind: p.kind, delay: p.delay, mode: p.mode, ratio: 0 }
        if (s.coilOn) t.on = true
        t.ratio = Math.max(t.ratio, ratio); t.kind = p.kind; t.delay = p.delay; t.mode = p.mode
      })
      Object.keys(byTag).concat(Object.keys(coilTags)).forEach(function (tag) {
        var b = byTag[tag] || { on: false, kind: 'relay', delay: 0, mode: 'on', ratio: 0 }
        var cur = coilTags[tag] || (coilTags[tag] = { on: false, active: false, acc: 0, timed: false, kind: b.kind, delay: b.delay, mode: b.mode })
        cur.kind = b.kind; cur.delay = b.delay; cur.mode = b.mode
        cur.on = b.on
        var act = cur.on
        if (act !== cur.active) { cur.active = act; changed = true }
      })
      return changed
    }
    function settle() {
      var S, M, n = 0, chat = false
      do {
        S = solve(); M = measure(S)
        var chg = setCoils(S, M)
        n++
        if (!chg) break
        if (n >= 14) { chat = true; break }
      } while (true)
      return { S: S, M: M, chatter: chat }
    }

    function stepOnce(dt) {
      sim.newEvents = []
      var R = settle(), S = R.S, M = R.M
      // ---- instantaneous protective devices and fault handling (loop until stable) ----
      var guard = 0, again = true
      while (again && guard++ < 8) {
        again = false
        comps.forEach(function (c) {
          var p = propsOf(c), s = CS[c.id], o = M.out[c.id]
          if (c.type === 'brk' && p.on && !s.tripped) {
            var r = o.i / p.amps
            if (r >= 8) { s.tripped = true; again = true; faultTrip(c, o.i, 'magnetic') }
          } else if (c.type === 'fuse' && !s.blown) {
            var r2 = o.i / p.amps
            if (r2 >= 6) { s.blown = true; again = true; faultBlow(c, o.i) }
          }
        })
        if (again) { R = settle(); S = R.S; M = R.M }
      }
      // ---- explosion check ----
      var maxFault = 0, bigSrc = null
      comps.forEach(function (c) {
        if (!/^src/.test(c.type) || CS[c.id].destroyed) return
        var o = M.out[c.id]; if (o.i > maxFault) { maxFault = o.i; bigSrc = c }
      })
      if (bigSrc) {
        var pp = propsOf(bigSrc), limit = Math.max(600, (pp.avail || 10000) * 0.35)
        if (maxFault > limit) {
          // find the wire carrying the most current to place the blast
          var flows = wireFlows(S, M), best = null, bi = 0
          wires.forEach(function (w, idx) { var f = flows[w.id !== undefined ? w.id : idx]; if (f && cabs(f) > bi) { bi = cabs(f); best = w } })
          CS[bigSrc.id].destroyed = true
          ev('explode', bigSrc.id, 'Dead short! ' + fmtA(maxFault) + ' flowed with nothing to stop it, so the circuit blew up. Add a breaker or fuse in the line, and check your wiring.', { amps: maxFault, wire: best ? best.id : null })
          R = settle(); S = R.S; M = R.M
        }
      }
      // ---- time integration: heat, timers, motors ----
      var changedDiscrete = false
      comps.forEach(function (c) {
        var p = propsOf(c), s = CS[c.id], o = M.out[c.id]
        switch (c.type) {
          case 'brk': if (p.on && !s.tripped) { var r = o.i / p.amps; if (r > 1.05) s.heat += dt * (r * r - 1); else s.heat = Math.max(0, s.heat - dt * 0.6)
            if (s.heat > 10) { s.tripped = true; changedDiscrete = true; ev('trip', c.id, 'Breaker tripped: it carried ' + fmtA(o.i) + ' on a ' + p.amps + ' A breaker for too long (overload).', { amps: o.i }) } }
            else if (s.tripped) s.heat = Math.max(0, s.heat - dt * 1.2); break
          case 'fuse': if (!s.blown) { var rf = o.i / p.amps; if (rf > 1.35) s.heat += dt * (rf * rf - 1); else s.heat = Math.max(0, s.heat - dt * 0.3)
            if (s.heat > 12) { s.blown = true; changedDiscrete = true; ev('blow', c.id, 'Fuse blown: ' + fmtA(o.i) + ' through a ' + p.amps + ' A fuse.', { amps: o.i }) } } break
          case 'ol': { var ro = o.i / p.amps; if (ro > 1.0) s.heat += dt * (ro * ro - 1); else s.heat = Math.max(0, s.heat - dt * 0.4)
            if (s.heat > 15 && !s.tripped) { s.tripped = true; changedDiscrete = true; ev('oltrip', c.id, 'Overload relay tripped at ' + fmtA(o.i) + ' (set to ' + p.amps + ' A). Find the cause, then press reset.', { amps: o.i }) } break }
          case 'lamp': case 'heater': case 'coil': {
            if (s.burnt) break; var rv = o.ratio || 0, st = Math.pow(rv, 4) - 1.6
            if (st > 0) s.heat += dt * st; else s.heat = Math.max(0, s.heat - dt * 0.5)
            if (s.heat > 1) { s.burnt = true; changedDiscrete = true; ev('burn', c.id, (T[c.type].label) + ' burned out: it saw ' + Math.round(o.v) + ' V but is rated ' + p.volts + ' V.', { volts: o.v }) } break }
          case 'motor1': case 'motor3': {
            if (s.burnt) break
            var vr = o.ratio || 0, FLA = p.fla, ir = o.i / FLA
            var live = vr > 0.3
            // single phasing: one leg of a 3-phase motor lost (imin small while others normal)
            s.sp = c.type === 'motor3' && live && o.imin < 0.35 * o.i && o.i > 0.1 * FLA
            var wasLR = s.lockedRotor
            if (live) {
              if (vr < 0.8 || s.sp) s.stall = true; else s.stall = false
              if (s.startT < 0.35 && !s.stall) { s.startT += dt; s.lockedRotor = true } else s.lockedRotor = !!s.stall
              if (s.stall) s.lockedRotor = true
            } else { s.startT = 0; s.lockedRotor = false; s.stall = false }
            if (wasLR !== s.lockedRotor) changedDiscrete = true
            var rate = (ir * ir - 1.2)
            if (vr > 1.12) rate += 6 * (vr - 1.12) * 10
            if (s.sp) rate += 3
            if (s.lockedRotor && s.startT >= 0.35 || s.stall) rate = Math.max(rate, 20)
            if (s.lockedRotor && !s.stall && s.startT < 0.35) rate = 0
            if (rate > 0) s.heat += dt * rate; else s.heat = Math.max(0, s.heat - dt * 0.8)
            if (s.heat > 6 && !s.overheated) { s.overheated = true; ev('warn', c.id, 'Motor is overheating (' + fmtA(o.i) + ' vs ' + FLA + ' A rated).', { amps: o.i }) }
            if (s.heat < 3) s.overheated = false
            if (s.heat > 25) { s.burnt = true; changedDiscrete = true; ev('burn', c.id, 'Motor burned up: ' + (s.sp ? 'it lost a phase (single-phasing). ' : '') + 'it ran at ' + fmtA(o.i) + ' vs ' + FLA + ' A rated and ' + Math.round(o.v) + ' V vs ' + p.volts + ' V rated.', { amps: o.i }) }
            break }
          case 'xfmr1': case 'xfmr3': {
            if (s.burnt) break; var rt = o.ratio || 0
            if (rt > 1.5) s.heat += dt * (rt * rt - 2.2); else s.heat = Math.max(0, s.heat - dt * 0.5)
            if (s.heat > 15) { s.burnt = true; changedDiscrete = true; ev('burn', c.id, 'Transformer burned up: ' + fmtA(o.i) + ' is ' + Math.round(rt * 100) + '% of its rating.', { amps: o.i }) } break }
        }
      })
      // timers
      Object.keys(coilTags).forEach(function (tag) {
        var t = coilTags[tag]
        if (t.kind !== 'timer') { t.timed = t.active; return }
        var was = t.timed
        if (t.mode === 'on') { if (t.on) { t.acc += dt; t.timed = t.acc >= t.delay } else { t.acc = 0; t.timed = false } }
        else { // off-delay: contacts transfer when coil on, return after delay once coil drops
          if (t.on) { t.acc = 0; t.timed = true } else if (t.timed) { t.acc += dt; if (t.acc >= t.delay) { t.timed = false; t.acc = 0 } }
        }
        if (t.timed !== was) changedDiscrete = true
      })
      if (changedDiscrete) { R = settle(); S = R.S; M = R.M }
      sim.time += dt
      var flows = wireFlows(S, M), wres = {}
      wires.forEach(function (w, idx) {
        var id = w.id !== undefined ? w.id : idx
        var f = flows[id] || cx(0, 0)
        var v = S.V[nodeOf[w.a] === undefined ? 0 : nodeOf[w.a]] || cx(0, 0)
        wres[id] = { i: cabs(f), sgn: (f.re >= 0 ? 1 : -1), v: cabs(v), ang: Math.atan2(v.im, v.re) / D2R }
      })
      var termV = {}
      Object.keys(nodeOf).forEach(function (k) { termV[k] = cabs(S.V[nodeOf[k]]) })
      var comp = {}
      comps.forEach(function (c) {
        var s = CS[c.id], o = M.out[c.id], p = propsOf(c)
        comp[c.id] = Object.assign({}, o, { state: Object.assign({}, s) })
        if (s.burnt) comp[c.id].status = 'burnt'
        if (s.blown) comp[c.id].status = 'blown'
        if (s.tripped) comp[c.id].status = 'tripped'
        if (s.destroyed) comp[c.id].status = 'destroyed'
        if (c.type === 'motor1' || c.type === 'motor3') {
          var run = !s.burnt && (o.ratio || 0) > 0.8 && !s.stall
          comp[c.id].running = run; comp[c.id].stalled = !!s.stall && (o.ratio || 0) > 0.3 && !s.burnt
          comp[c.id].speed = run ? (s.startT < 0.35 ? s.startT / 0.35 * 0.8 : Math.min(1, Math.pow(o.ratio, 1.5))) : 0
          comp[c.id].heat = s.heat; comp[c.id].singlePhase = s.sp
        }
        if (c.type === 'lamp') comp[c.id].brightness = s.burnt ? 0 : Math.max(0, Math.min(1.3, Math.pow(o.ratio || 0, 2)))
        if (c.type === 'heater') comp[c.id].brightness = s.burnt ? 0 : Math.max(0, Math.min(1.3, Math.pow(o.ratio || 0, 2)))
        if (c.type === 'coil') comp[c.id].energized = s.coilOn && !s.burnt
        comp[c.id].heat = s.heat
      })
      var tags = {}; Object.keys(coilTags).forEach(function (k) { tags[k] = { on: coilTags[k].on, active: coilTags[k].active, timed: coilTags[k].timed, acc: coilTags[k].acc } })
      sim.result = { time: sim.time, comp: comp, wire: wres, termV: termV, tags: tags, events: sim.newEvents.slice(), chatter: R.chatter, tI: M.tI }
      return sim.result
    }

    function faultTrip(c, amps, why) {
      var big = amps > 1500
      ev(big ? 'fault' : 'trip', c.id, (big ? 'Short circuit! ' : 'Overcurrent: ') + 'breaker tripped at ' + fmtA(amps) + ' (rated ' + propsOf(c).amps + ' A). It cleared the fault before anything blew up.', { amps: amps })
    }
    function faultBlow(c, amps) {
      var big = amps > 1500
      ev(big ? 'fault' : 'blow', c.id, (big ? 'Short circuit! ' : 'Overcurrent: ') + 'fuse blew at ' + fmtA(amps) + ' (rated ' + propsOf(c).amps + ' A).', { amps: amps })
    }
    function fmtA(a) { return a >= 1000 ? (a / 1000).toFixed(1) + ' kA' : (a >= 100 ? Math.round(a) : a.toFixed(1)) + ' A' }

    sim.step = function (dt) { return stepOnce(dt == null ? 0.05 : dt) }
    sim.reset = function () { resetState(); sim.result = null }
    sim.press = function (id, v) { if (CS[id]) { var was = CS[id].pressed; CS[id].pressed = !!v; return was !== !!v } }
    sim.resetDevice = function (id) { var s = CS[id], c = byId[id]; if (!s || !c) return; s.heat = 0; if (c.type === 'brk') { s.tripped = false; if (c.props) c.props.on = false } if (c.type === 'fuse') s.blown = false; if (c.type === 'ol') s.tripped = false; if (/^src/.test(c.type)) s.destroyed = false; s.burnt = false; s.startT = 0; s.lockedRotor = false; s.stall = false }
    sim.state = function (id) { return CS[id] }
    sim.tags = function () { return coilTags }
    sim.solveNow = function () { return settle() }
    return sim
  }

  return { create: create, TYPES: T, termsOf: termsOf, propsOf: propsOf, version: 1 }
})
