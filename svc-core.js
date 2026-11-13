/* VoltCE Service & Panel Builder: one-line model, load / voltage-drop / fault-current calculations,
   plain-language narration and examples. Pure logic (no DOM). Teaching model: follows NEC practice in
   spirit (75 C copper/aluminum table, 125% continuous, 3% / 5% drop guidance) but is NOT a code-compliance tool. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.SvcCore = factory() })(typeof self !== 'undefined' ? self : this, function () {
  'use strict'
  var S3 = Math.sqrt(3), uidN = 1
  function uid(p) { return (p || 'n') + (uidN++) }
  var SYSTEMS = {
    '1P-120/240': { label: '120/240 V single-phase', ph: 1, vll: 240, vln: 120, wires: '2 hots + neutral' },
    '3P-120/208': { label: '120/208 V three-phase wye', ph: 3, vll: 208, vln: 120, wires: '3 hots + neutral' },
    '3P-277/480': { label: '277/480 V three-phase wye', ph: 3, vll: 480, vln: 277, wires: '3 hots + neutral' },
    '3P-480D': { label: '480 V three-phase (no neutral)', ph: 3, vll: 480, vln: 277, wires: '3 hots', noN: true },
    '3P-12470': { label: '12.47 kV three-phase (primary)', ph: 3, vll: 12470, vln: 7200, wires: '3 hots', mv: true }
  }
  var OCPD = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000]
  var SIZES = ['14', '12', '10', '8', '6', '4', '3', '2', '1', '1/0', '2/0', '3/0', '4/0', '250', '300', '350', '400', '500', '600', '750']
  var AMP_CU = [20, 25, 35, 50, 65, 85, 100, 115, 130, 150, 175, 200, 230, 255, 285, 310, 335, 380, 420, 475]
  var AMP_AL = [0, 20, 30, 40, 50, 65, 75, 90, 100, 120, 135, 155, 180, 205, 230, 250, 270, 310, 340, 385]
  var R_CU = [3.1, 2.0, 1.2, 0.78, 0.49, 0.31, 0.25, 0.19, 0.15, 0.12, 0.10, 0.079, 0.063, 0.054, 0.045, 0.039, 0.035, 0.029, 0.025, 0.021]
  var R_AL = [0, 3.2, 2.0, 1.3, 0.81, 0.51, 0.40, 0.32, 0.25, 0.20, 0.16, 0.13, 0.10, 0.085, 0.071, 0.061, 0.054, 0.043, 0.036, 0.029]
  var X_OHM = 0.045
  function ampacity(size, mat) { var i = SIZES.indexOf(String(size)); if (i < 0) return 0; var a = (mat === 'Al' ? AMP_AL : AMP_CU)[i]; return a }
  function resist(size, mat) { var i = SIZES.indexOf(String(size)); return i < 0 ? 0 : (mat === 'Al' ? R_AL : R_CU)[i] }
  function nextOCPD(a) { for (var i = 0; i < OCPD.length; i++) if (OCPD[i] >= a - 1e-9) return OCPD[i]; return OCPD[OCPD.length - 1] }
  function sizeFor(amps, mat, sets) { sets = sets || 1; var per = amps / sets; for (var i = 0; i < SIZES.length; i++) { var a = ampacity(SIZES[i], mat); if (a && a >= per && (sets === 1 || i >= 10)) return SIZES[i] } return SIZES[SIZES.length - 1] }
  /* NEC 430.248 / 430.250 full-load current (A) */
  var FLA = {
    '1P-115': { 0.5: 9.8, 0.75: 13.8, 1: 16, 1.5: 20, 2: 24, 3: 34, 5: 56, 7.5: 80, 10: 100 },
    '1P-230': { 0.5: 4.9, 0.75: 6.9, 1: 8, 1.5: 10, 2: 12, 3: 17, 5: 28, 7.5: 40, 10: 50 },
    '3P-208': { 0.5: 2.4, 0.75: 3.5, 1: 4.6, 1.5: 6.6, 2: 7.5, 3: 10.6, 5: 16.7, 7.5: 24.2, 10: 30.8, 15: 46.2, 20: 59.4, 25: 74.8, 30: 88, 40: 114, 50: 143, 60: 169, 75: 211, 100: 273 },
    '3P-460': { 0.5: 1.1, 0.75: 1.6, 1: 2.1, 1.5: 3, 2: 3.4, 3: 4.8, 5: 7.6, 7.5: 11, 10: 14, 15: 21, 20: 27, 25: 34, 30: 40, 40: 52, 50: 65, 60: 77, 75: 96, 100: 124, 125: 156, 150: 180, 200: 240 }
  }
  function motorFLA(hp, v, ph) { var key = ph === 3 ? (v >= 400 ? '3P-460' : '3P-208') : (v >= 200 ? '1P-230' : '1P-115'), t = FLA[key], best = null; Object.keys(t).forEach(function (k) { if (best === null || Math.abs(k - hp) < Math.abs(best - hp)) best = +k }); return t[best] }
  var KINDS = {
    lighting: { label: 'Lighting', cont: true, pf: 1 }, recep: { label: 'Receptacles', cont: false, pf: 1 }, range: { label: 'Electric range', cont: false, pf: 1 },
    dryer: { label: 'Dryer', cont: false, pf: 1 }, wh: { label: 'Water heater', cont: false, pf: 1 }, hvac: { label: 'HVAC / A/C', cont: false, pf: 0.9 },
    ev: { label: 'EV charger', cont: true, pf: 1 }, motor: { label: 'Motor', cont: false, pf: 0.85, motor: true }, heat: { label: 'Electric heat', cont: true, pf: 1 }, general: { label: 'General load', cont: false, pf: 1 }
  }

  function node(type, name, props, extra) {
    var n = { id: uid('n'), type: type, name: name || type, props: props || {}, kids: [] }
    if (type !== 'utility') { n.feeder = { size: '4', mat: 'Cu', len: 20, sets: 1 }; n.ocpd = 100; n.aic = 10 }
    if (type === 'panel') n.circuits = []
    if (extra) for (var k in extra) n[k] = extra[k]
    return n
  }
  function circuit(name, kind, v, amountVA, o) { var c = { id: uid('c'), name: name, kind: kind || 'general', v: v || '120', va: amountVA || 0, breaker: 20 }; if (o) for (var k in o) c[k] = o[k]; return c }
  function walk(n, f, par) { f(n, par); n.kids.forEach(function (k) { walk(k, f, n) }) }
  function find(model, id) { var out = null; walk(model.root, function (n, p) { if (n.id === id) out = { node: n, parent: p } }); return out }
  function normalize(m) { var seen = {}; walk(m.root, function (n) { if (!n.id || seen[n.id]) n.id = uid('n'); seen[n.id] = 1; n.kids = n.kids || []; n.props = n.props || {}; if (n.type === 'panel') n.circuits = n.circuits || []; (n.circuits || []).forEach(function (c) { if (!c.id || seen[c.id]) c.id = uid('c'); seen[c.id] = 1 }) }); return m }

  function circuitVA(c) {
    if (c.motor || c.kind === 'motor') { var hp = +c.hp || 1, v = c.v === '120' ? 115 : c.v === '240' ? 230 : c.v === '208' ? 208 : 460, ph = (c.v === '3P') || c.v === '208' || c.v === '480' ? 3 : 1; var fla = c.fla || motorFLA(hp, v, ph); return ph === 3 ? S3 * v * fla : v * fla }
    return +c.va || 0
  }
  function loadVoltageClass(c, sys) { var s = SYSTEMS[sys]; if (c.kind === 'motor' || c.motor) { return c.v === '3P' || c.v === '208' || c.v === '480' ? '3P' : (c.v === '120' ? '120' : '240') } return c.v === '3P' ? '3P' : (c.v === '240' || c.v === '208' || c.v === '480') ? 'LL' : 'LN' }

  /* ---------- calculation ---------- */
  function calc(model) {
    var R = {}, root = model.root
    function sysOf(n, parentSys) { return n.type === 'utility' ? n.props.sys : n.type === 'xfmr' ? n.props.sec : parentSys }
    /* pass 1: loads bottom-up. returns {I:[A,B,C] actual, Is:[A,B,C] sized, ln:[..], S, bigMotorI} at node's own system voltage */
    function loads(n, sys) {
      var sy = SYSTEMS[sys], np = sy.ph === 1 ? 2 : 3, I = [0, 0, 0], Is = [0, 0, 0], ln = [0, 0, 0], S = 0, big = 0, bigRaw = 0
      function addPhase(arr, amps, kind, cont, ci) {
        if (kind === '3P') { for (var k = 0; k < np; k++) arr[k] += amps }
        else if (kind === 'LL') { if (np === 2) { arr[0] += amps; arr[1] += amps } else { var pairs = [[0, 1], [1, 2], [2, 0]], bp = pairs[0], bm = 1e9; pairs.forEach(function (p) { var m = Math.max(arr[p[0]], arr[p[1]]); if (m < bm) { bm = m; bp = p } }); arr[bp[0]] += amps; arr[bp[1]] += amps } }
        else { var bi = 0, bmn = 1e9; for (var j = 0; j < np; j++) if (arr[j] < bmn) { bmn = arr[j]; bi = j } arr[bi] += amps; if (ci) ci[bi] += amps }
      }
      var spaceLoads = []
      ;(n.circuits || []).forEach(function (c) {
        var va = circuitVA(c), kd = KINDS[c.kind] || KINDS.general, cl = loadVoltageClass(c, sys), cont = c.cont !== undefined ? c.cont : kd.cont
        var amps = cl === '3P' ? va / (S3 * sy.vll) : cl === 'LL' ? va / sy.vll : va / sy.vln
        spaceLoads.push({ amps: amps, cl: cl, cont: cont, va: va, motor: !!(c.motor || kd.motor), c: c })
      })
      spaceLoads.forEach(function (l) { l.mult = l.cont ? 1.25 : 1 })
      spaceLoads.sort(function (a, b) { return b.amps - a.amps })
      spaceLoads.forEach(function (l) {
        var save = I.slice(); addPhase(I, l.amps, l.cl, l.cont, ln)
        for (var k = 0; k < 3; k++) { var d = I[k] - save[k]; Is[k] += d * l.mult }
        S += l.va; if (l.motor && l.amps > bigRaw) bigRaw = l.amps
      })
      n.kids.forEach(function (k) {
        var kr = R[k.id]; if (!kr) return
        // child load reflected to this node's voltage by apparent power
        var ksys = kr.sys, ks = SYSTEMS[ksys], kS = kr.S, Ik, Iks
        if (ks.ph === sy.ph && ks.vll === sy.vll) { Ik = kr.I.slice(); Iks = kr.Is.slice() }
        else if (ks.ph === 3 && sy.ph === 3) { var r = ks.vll / sy.vll; Ik = kr.I.map(function (x) { return x * r }); Iks = kr.Is.map(function (x) { return x * r }) }
        else {
          var Sc = kS, Ssz = kS * (kr.Imax ? kr.Imaxs / kr.Imax : 1)
          Ik = [0, 0, 0]; Iks = [0, 0, 0]
          if (sy.ph === 3) { var iL = Sc / (S3 * sy.vll), iLs = Ssz / (S3 * sy.vll); Ik = [iL, iL, iL]; Iks = [iLs, iLs, iLs] }
          else { var iL1 = Sc / sy.vll, iLs1 = Ssz / sy.vll; Ik = [iL1, iL1, 0]; Iks = [iLs1, iLs1, 0] }
        }
        // 1-phase subfeed on a 3-phase node: put on the two lightest phases
        if (ks.ph === 1 && sy.ph === 3 && ks.vll !== sy.vll) { }
        for (var j = 0; j < 3; j++) { I[j] += Ik[j]; Is[j] += Iks[j] }
        S += kS; if (kr.bigRaw > bigRaw) { bigRaw = kr.bigRaw }
        if (k.type === 'load') { }
      })
      if (n.type === 'load') {
        var c = n.props, va = circuitVA(c), cl2 = loadVoltageClass(c, sys), cont = c.cont !== undefined ? c.cont : (KINDS[c.kind] || KINDS.general).cont
        var am = cl2 === '3P' ? va / (S3 * sy.vll) : cl2 === 'LL' ? va / sy.vll : va / sy.vln
        for (var q = 0; q < np; q++) { if (cl2 === '3P' || (cl2 === 'LL' && (np === 2 || q < 2)) || (cl2 === 'LN' && q === 0)) { I[q] += am; Is[q] += am * (cont ? 1.25 : 1); if (cl2 === 'LN') ln[q] += am } }
        S += va; if (c.motor || c.kind === 'motor') bigRaw = Math.max(bigRaw, am)
      }
      var Imax = Math.max(I[0], I[1], I[2]), Imaxs = Math.max(Is[0], Is[1], Is[2]) + 0.25 * bigRaw
      var dem = n.type === 'panel' && n.props.demand ? n.props.demand / 100 : 1
      var nI = 0; if (sy.ph === 1) nI = Math.abs(ln[0] - ln[1]); else if (!sy.noN) nI = Math.sqrt(Math.max(0, ln[0] * ln[0] + ln[1] * ln[1] + ln[2] * ln[2] - ln[0] * ln[1] - ln[1] * ln[2] - ln[0] * ln[2]))
      return { I: I, Is: Is, ln: ln, S: S * dem, Imax: Imax, Imaxs: Imaxs, bigRaw: bigRaw, neutral: nI, sys: sys }
    }
    /* determine systems top-down, then compute loads bottom-up (post-order) */
    var sysMap = {}
    ;(function sy(n, ps) { sysMap[n.id] = sysOf(n, ps) || ps; n.kids.forEach(function (k) { sy(k, sysMap[n.id]) }) })(root, null)
    ;(function post(n) { n.kids.forEach(post); var r = loads(n, sysMap[n.id]); R[n.id] = r })(root)
    /* pass 2: voltages, drops, fault current, warnings top-down */
    function top(n, par, up) {
      var r = R[n.id], sys = r.sys, sy = SYSTEMS[sys], W = [], fd = n.feeder
      var info = { vNom: sy.vll, vln: sy.vln }
      var vUp = up ? up.vEnd : sy.vll, cumUp = up ? up.cumDrop : 0, iscUp = up ? up.isc : (n.props.isc || 10) * 1000
      var psys = par ? SYSTEMS[R[par.id].sys] : null
      r.name = n.name
      // feeder
      var ampz = 0, drop = 0, zc = 0
      if (n.type !== 'utility') {
        var sets = fd.sets || 1, ph = (psys || sy).ph, I = Math.max(r.Imax, 0.0001)
        // current on the feeder is measured at the parent's voltage
        var pI = par ? currentAtParent(n, par) : I
        ampz = ampacity(fd.size, fd.mat) * sets
        var Rk = resist(fd.size, fd.mat) / sets, L = (fd.len || 0) / 1000
        var Zeff = Rk * 0.9 + (X_OHM / sets) * 0.436
        var vd = (ph === 3 ? S3 : 2) * pI * Zeff * L
        drop = vd; zc = Math.sqrt(Rk * Rk + Math.pow(X_OHM / sets, 2)) * L
        r.feederI = pI; r.ampacity = ampz
        var parentV = vUp, vEnd = Math.max(0, parentV - vd)
        r.drop = vd; r.dropPct = parentV ? vd / parentV * 100 : 0
        // fault current at the downstream end of the feeder
        var isc = faultAt(iscUp, parentV, psys || sy, zc)
        r.isc = n.type === 'xfmr' ? xfmrIsc(n, isc, parentV) : isc
        r.iscIn = isc
        if (n.type === 'xfmr') { vEnd = vEnd * (n.props.sec ? SYSTEMS[n.props.sec].vll / SYSTEMS[n.props.pri || sys].vll : 1) }
        r.vEnd = vEnd; r.cumDrop = cumUp + r.dropPct
        // checks
        var need = pI * (r.Imax ? r.Imaxs / r.Imax : 1)
        r.need = need
        if (n.type === 'xfmr') need = (r.Imaxs / r.Imax || 1) * pI
        var isMot = n.type === 'load' && (n.props.motor || n.props.kind === 'motor')
        if (isMot) { need = pI * 1.25 }
        if (isMot) {
          if (ampz < need - 0.01) W.push({ lvl: 'bad', msg: n.name + ': ' + fd.size + ' ' + fd.mat + ' (' + ampz + ' A) is too small. Motor conductors must carry 125% of full-load current, ' + fmt(need) + ' A.' })
          if (n.ocpd > pI * 2.5 + 0.01) W.push({ lvl: 'bad', msg: n.name + ': the ' + n.ocpd + ' A breaker is more than 250% of the motor full-load current (' + fmt(pI) + ' A). Too large to protect the motor circuit.' })
          else if (n.ocpd < pI * 1.25 - 0.01) W.push({ lvl: 'bad', msg: n.name + ': the ' + n.ocpd + ' A breaker is too small. The motor draws about 6 times its running current at start and would trip it.' })
        } else if (n.ocpd < need - 0.01 && n.type !== 'load') W.push({ lvl: 'bad', msg: n.name + ': the ' + n.ocpd + ' A breaker is smaller than the ' + fmt(need) + ' A this feeder must carry (continuous loads count at 125%). It would trip under normal load.' })
        if (n.type === 'load' && !isMot && n.ocpd < pI * 1.0 - 0.01) W.push({ lvl: 'bad', msg: n.name + ': the ' + n.ocpd + ' A breaker is smaller than the ' + fmt(pI) + ' A load.' })
        if (isMot) { } else if (ampz < need - 0.01) W.push({ lvl: 'bad', msg: n.name + ': ' + fd.size + (sets > 1 ? ' x' + sets : '') + ' ' + fd.mat + ' carries ' + ampz + ' A but the load needs ' + fmt(need) + ' A. The wire would overheat. Use a bigger conductor.' })
        else if (isMot) { } else if (ampz < n.ocpd - 0.01 && !(n.ocpd <= 800 && ampz >= prevStd(n.ocpd))) W.push({ lvl: 'bad', msg: n.name + ': the ' + n.ocpd + ' A breaker is larger than the ' + ampz + ' A wire. A fault or overload could heat the wire before the breaker trips.' })
        else if (ampz < n.ocpd - 0.01) W.push({ lvl: 'info', msg: n.name + ': the wire (' + ampz + ' A) is between breaker sizes, so the next breaker size up is permitted (NEC 240.4(B)) on feeders and non-multioutlet circuits.' })
        if (r.dropPct > 3) W.push({ lvl: 'warn', msg: n.name + ': voltage drop is ' + fmt(r.dropPct) + '% on this feeder. Keep a feeder or branch circuit near 3% or less.' })
        if (r.cumDrop > 5) W.push({ lvl: 'warn', msg: n.name + ': total voltage drop from the service is ' + fmt(r.cumDrop) + '%. Recommended maximum is about 5%.' })
        if (n.aic && r.iscIn / 1000 > n.aic + 1e-9) W.push({ lvl: 'bad', msg: n.name + ': available fault current ' + fmt(r.iscIn / 1000) + ' kA exceeds the breaker\'s ' + n.aic + ' kA interrupting rating. It could fail violently clearing a short. Use a higher-AIC breaker or current-limiting fuse.' })
        if (par && R[par.id] && !ksysOk(n, par)) W.push({ lvl: 'bad', msg: n.name + ': voltage does not match its supply (' + SYSTEMS[R[par.id].sys].label + ').' })
      } else { r.vEnd = sy.vll; r.cumDrop = 0; r.isc = iscUp }
      // type specific
      if (n.type === 'panel') {
        var bus = n.props.bus || 200, used = (n.circuits || []).reduce(function (a, c) { return a + ((c.v === '3P') ? 3 : (c.v === '120' || c.v === 'LN') ? 1 : 2) }, 0) + n.kids.length * (SYSTEMS[sys].ph === 1 ? 2 : 3)
        r.bus = bus; r.spaces = n.props.spaces || 30; r.used = used
        if (r.Imaxs > bus + 0.01) W.push({ lvl: 'bad', msg: n.name + ': the load (' + fmt(r.Imaxs) + ' A) is more than the ' + bus + ' A bus rating.' })
        if (used > r.spaces) W.push({ lvl: 'bad', msg: n.name + ': ' + used + ' breaker spaces needed but the panel has ' + r.spaces + '.' })
        if (n.ocpd > bus + 0.01 && n.type === 'panel') W.push({ lvl: 'bad', msg: n.name + ': the feeder breaker (' + n.ocpd + ' A) is larger than the panel bus (' + bus + ' A).' })
        // 120 V imbalance
        if (SYSTEMS[sys].ph === 1 && r.Imax > 5) { var imb = Math.abs(r.I[0] - r.I[1]) / Math.max(r.I[0], r.I[1]) * 100; if (imb > 25) W.push({ lvl: 'warn', msg: n.name + ': the two legs are ' + fmt(imb) + '% out of balance. Move some 120 V circuits to the lighter leg; the neutral carries the difference.' }) }
        ;(n.circuits || []).forEach(function (c) {
          var va = circuitVA(c), cl = loadVoltageClass(c, sys), amps = cl === '3P' ? va / (S3 * SYSTEMS[sys].vll) : cl === 'LL' ? va / SYSTEMS[sys].vll : va / SYSTEMS[sys].vln, cont = c.cont !== undefined ? c.cont : (KINDS[c.kind] || KINDS.general).cont
          var need2 = amps * (cont ? 1.25 : 1) + ((c.motor || c.kind === 'motor') ? amps * 0.25 : 0)
          c._amps = amps; c._need = need2
          var cMot = !!(c.motor || c.kind === 'motor')
          if (cMot) { if (c.breaker > amps * 2.5 + 0.01) W.push({ lvl: 'bad', msg: n.name + ' / ' + c.name + ': breaker is over 250% of motor current.' }); if (c.breaker < amps * 1.25 - 0.01) W.push({ lvl: 'bad', msg: n.name + ' / ' + c.name + ': ' + c.breaker + ' A breaker is too small for a motor drawing ' + fmt(amps) + ' A.' }) }
          else if (c.breaker < need2 - 0.01) W.push({ lvl: 'bad', msg: n.name + ' / ' + c.name + ': ' + c.breaker + ' A breaker for ' + fmt(need2) + ' A of load. It will trip.' })
          var cw = c.wire ? ampacity(c.wire, c.mat || 'Cu') : 0
          if (cw && !cMot && cw < c.breaker - 0.01) W.push({ lvl: 'bad', msg: n.name + ' / ' + c.name + ': ' + c.wire + ' ' + (c.mat || 'Cu') + ' is only good for ' + cw + ' A but the breaker is ' + c.breaker + ' A.' })
        })
      }
      if (n.type === 'xfmr') {
        var kva = n.props.kva || 75, ps = SYSTEMS[n.props.pri || (psys && Object.keys(SYSTEMS).filter(function (k) { return SYSTEMS[k] === psys })[0])], ss = SYSTEMS[n.props.sec]
        var flaS = ss.ph === 3 ? kva * 1000 / (S3 * ss.vll) : kva * 1000 / ss.vll, flaP = ps ? (ps.ph === 3 ? kva * 1000 / (S3 * ps.vll) : kva * 1000 / ps.vll) : 0
        r.kva = kva; r.flaS = flaS; r.flaP = flaP; r.loadKVA = r.S / 1000; r.xloadPct = r.S / 1000 / kva * 100
        if (r.xloadPct > 100) W.push({ lvl: 'bad', msg: n.name + ': loaded to ' + fmt(r.xloadPct) + '% of its ' + kva + ' kVA rating. It will overheat. Use a larger transformer or shed load.' })
        else if (r.xloadPct > 80) W.push({ lvl: 'warn', msg: n.name + ': loaded to ' + fmt(r.xloadPct) + '%. Little room to grow.' })
        if (n.ocpd > flaP * 1.25 + 0.01 && n.ocpd > flaP * 1.25 * 1.0 && n.ocpd > nextOCPD(flaP * 1.25)) W.push({ lvl: 'warn', msg: n.name + ': primary breaker ' + n.ocpd + ' A is more than 125% of the primary full-load current (' + fmt(flaP) + ' A). Without secondary protection, primary protection is limited to about 125% (NEC 450.3(B)).' })
        r.sysBond = ss.noN ? 'none' : 'The secondary of a transformer is a "separately derived system": bond its neutral (X0) to ground here, at the transformer, once.'
      }
      if (n.type === 'ats') {
        var gk = +n.props.genKva || 0, gfla = gk ? (sy.ph === 3 ? gk * 1000 / (S3 * sy.vll) : gk * 1000 / sy.vll) : 0, gw = n.props.genWire || '4', gamp = ampacity(gw, 'Cu')
        r.genKva = gk; r.genFLA = gfla; r.genLoadPct = gk ? r.S / 1000 / gk * 100 : 0; r.genAmp = gamp; r.genWire = gw
        if (!gk) W.push({ lvl: 'warn', msg: n.name + ': no generator size is set, so nothing can power the load during an outage.' })
        else {
          if (r.genLoadPct > 100) W.push({ lvl: 'bad', msg: n.name + ': the loads add up to ' + fmt(r.S / 1000) + ' kVA but the generator is only ' + gk + ' kVA (' + fmt(r.genLoadPct) + '%). It will stall or trip. Use a larger generator or move loads off the transfer switch.' })
          else if (r.genLoadPct > 80) W.push({ lvl: 'warn', msg: n.name + ': generator would run at ' + fmt(r.genLoadPct) + '% of its ' + gk + ' kVA rating. Motor starting surges can make it sag. Leave more margin.' })
          if (gamp < gfla * 1.15 - 0.01) W.push({ lvl: 'bad', msg: n.name + ': generator conductors (' + gw + ' Cu, ' + gamp + ' A) are smaller than 115% of generator full-load current (' + fmt(gfla * 1.15) + ' A). NEC 445.13 needs at least 115%.' })
        }
        W.push({ lvl: 'info', msg: 'Transfer equipment must keep utility and generator from ever being connected together. The generator also needs its own overcurrent protection and, for a separately derived system, a plan for where the neutral is bonded (NEC 250.30, 702.' + '5, 700 / 701 / 702 by type of system).' })
      }
      if (n.type === 'utility') {
        // nothing
      }
      r.warnings = W
      // children
      n.kids.forEach(function (k) { top(k, n, { vEnd: r.vEnd, cumDrop: r.cumDrop, isc: r.isc }) })
    }
    function currentAtParent(n, par) {
      var r = R[n.id], pr = SYSTEMS[R[par.id].sys], ks = SYSTEMS[r.sys]
      if (ks.ph === pr.ph && ks.vll === pr.vll) return r.Imax
      if (pr.ph === 3 && ks.ph === 3) return r.Imax * ks.vll / pr.vll
      if (pr.ph === 3) return r.S / (S3 * pr.vll) * (r.Imax && r.Imaxs ? 1 : 1)
      return r.S / pr.vll
    }
    function ksysOk(n, par) { return true }
    function faultAt(iscUp, v, sy, zc) {
      if (!iscUp) return 0
      if (sy.mv) return iscUp
      var zs = sy.ph === 3 ? v / (S3 * iscUp) : v / (2 * iscUp)
      var denom = sy.ph === 3 ? S3 * (zs + zc) : 2 * (zs + zc)
      return v / denom
    }
    function xfmrIsc(n, iscPrim, vPrim) {
      var ps = SYSTEMS[n.props.pri], ss = SYSTEMS[n.props.sec]; if (!ps || !ss) return 0
      var kva = n.props.kva || 75, z = (n.props.z || 5) / 100
      var Ssc = ps.ph === 3 ? S3 * ps.vll * iscPrim / 1000 : ps.vll * iscPrim / 1000
      var zsrc = Ssc > 0 ? kva / Ssc : 0
      var flaS = ss.ph === 3 ? kva * 1000 / (S3 * ss.vll) : kva * 1000 / ss.vll
      return flaS / (z + zsrc)
    }
    function prevStd(a) { var p = 0; for (var i = 0; i < OCPD.length; i++) { if (OCPD[i] < a) p = OCPD[i] } return p }
    function fmt(x) { return (Math.round(x * 10) / 10).toString() }
    top(root, null, null)
    return R
  }

  /* ---------- auto size ---------- */
  function autoSize(model) {
    var R = calc(model)
    walk(model.root, function (n, p) {
      if (n.type === 'utility' || !R[n.id]) return
      var r = R[n.id], need = r.need || r.Imaxs
      if (n.type === 'xfmr') { var fp = r.flaP; need = Math.max(r.need || 0, 0); n.ocpd = nextOCPD(Math.min(Math.max(need, fp * 1.0), fp * 1.25 || need)); if (n.ocpd < need) n.ocpd = nextOCPD(need) }
      else n.ocpd = nextOCPD(need)
      var sets = n.feeder.sets || 1; n.feeder.size = sizeFor(n.ocpd, n.feeder.mat, sets)
      if (n.type === 'ats') {
        var sy2 = SYSTEMS[r.sys], ld = r.S / 1000, GK = [10, 15, 20, 22, 25, 30, 35, 45, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500, 600], gkk = GK.filter(function (g) { return g >= ld / 0.8 })[0] || GK[GK.length - 1]
        if (!(+n.props.genKva) || +n.props.genKva * 1 < ld / 0.8) n.props.genKva = gkk
        var gf = sy2.ph === 3 ? n.props.genKva * 1000 / (S3 * sy2.vll) : n.props.genKva * 1000 / sy2.vll
        n.props.genWire = sizeFor(Math.ceil(gf * 1.15), 'Cu', 1)
      }
      if (n.type === 'panel') { n.props.bus = Math.max(n.props.bus || 100, [100, 125, 150, 200, 225, 400, 600, 800, 1200].filter(function (b) { return b >= n.ocpd })[0] || n.ocpd) }
      ;(n.circuits || []).forEach(function (c) { var amps = c._amps; if (amps === undefined) return; var cont = c.cont !== undefined ? c.cont : (KINDS[c.kind] || KINDS.general).cont; var nd = amps * (cont ? 1.25 : 1); c.breaker = nextOCPD(Math.max(15, nd)); c.wire = sizeFor(c.breaker, c.mat || 'Cu', 1); if (+c.wire.split('/')[0] > 12 && c.breaker <= 20) c.wire = '12' })
    })
    var R2 = calc(model), AIC = [10, 14, 22, 25, 35, 42, 65, 100, 200]
    walk(model.root, function (n) { if (n.type === 'utility' || !R2[n.id]) return; var kA = R2[n.id].iscIn / 1000; n.aic = AIC.filter(function (a) { return a >= kA })[0] || 200 })
    return calc(model)
  }

  /* ---------- plain-language narration ---------- */
  function fmt(x) { return (Math.round(x * 10) / 10).toString() }
  var TYPE_TEXT = {
    utility: 'The utility is where power comes from. It delivers a fixed system voltage and has a limit on how much fault current it can push into a short circuit.',
    meter: 'The meter counts the energy used (kWh) so the utility can bill for it. It sits in series with the service, so every amp passes through it. In a multi-tenant building each tenant gets their own meter.',
    disc: 'The service disconnect (main breaker) lets you shut off everything downstream in one move and protects the service conductors.',
    bus: 'A switchboard or meter bank is a bus that splits one big supply into several feeders. Each feeder leaves through its own breaker, sized for that feeder.',
    xfmr: 'A transformer changes voltage so the equipment gets what it needs: a lower voltage for ordinary loads, or a higher one to move big power with less current.',
    panel: 'A panel (panelboard) splits a feeder into branch circuits. Each breaker protects one circuit\'s wire; the panel\'s bus must be big enough for the sum of the loads.',
    load: 'A load is something that uses power: a motor, a heater, a chiller. It draws current set by its power and the voltage.'
  }
  function describe(model, id, R) {
    R = R || calc(model); var f = id ? find(model, id) : null, out = []
    if (!f) {
      var tot = R[model.root.id], n = 0, panels = 0, xf = 0, mt = 0, mx = 0
      walk(model.root, function (x) { n++; if (x.type === 'panel') panels++; if (x.type === 'xfmr') xf++; if (x.type === 'meter') mt++; var rr = R[x.id]; if (rr && rr.Imaxs > mx) mx = rr.Imaxs })
      var sy = SYSTEMS[tot.sys]
      out.push('The utility supplies ' + sy.label + ' (' + sy.wires + '). Power flows down the diagram: each box feeds the boxes below it.')
      out.push('This system has ' + panels + ' panel' + (panels === 1 ? '' : 's') + (xf ? ', ' + xf + ' transformer' + (xf === 1 ? '' : 's') : '') + (mt ? ' and ' + mt + ' meter' + (mt === 1 ? '' : 's') : '') + '. The total connected load is about ' + fmt(tot.S / 1000) + ' kVA, or about ' + fmt(tot.Imax) + ' A per phase at the service' + (tot.neutral ? ' with ' + fmt(tot.neutral) + ' A on the neutral' : '') + '.')
      var bad = 0, warn = 0; Object.keys(R).forEach(function (k) { (R[k].warnings || []).forEach(function (w) { if (w.lvl === 'bad') bad++; else if (w.lvl === 'warn') warn++ }) })
      out.push(bad ? 'There ' + (bad === 1 ? 'is 1 problem' : 'are ' + bad + ' problems') + ' to fix (red below). Click the box that shows the warning symbol.' : warn ? 'Nothing is unsafe, but there are ' + warn + ' warning' + (warn === 1 ? '' : 's') + ' worth a look.' : 'No problems found: every breaker, wire and transformer is sized for the load it serves.')
      out.push('Click any box to see what it does and the numbers for it. Use the Add buttons to grow the system, or Auto-size to let the tool pick breaker and wire sizes.')
      return out
    }
    var n = f.node, r = R[n.id], sys = SYSTEMS[r.sys]
    out.push(TYPE_TEXT[n.type])
    if (n.type === 'utility') out.push('Here: ' + sys.label + ', available fault current ' + (n.props.isc || 10) + ' kA at the service. That is how hard a short circuit at the meter could push; every breaker downstream must be rated to stop at least this much where it sits.')
    if (n.type !== 'utility') {
      var pS = f.parent ? SYSTEMS[R[f.parent.id].sys] : sys
      out.push('Fed from "' + f.parent.name + '" through a ' + n.ocpd + ' A breaker and ' + n.feeder.size + (n.feeder.sets > 1 ? ' x' + n.feeder.sets : '') + ' ' + n.feeder.mat + ' conductors, ' + n.feeder.len + ' ft. The wire carries up to ' + r.ampacity + ' A; the breaker is there so the wire never exceeds that.')
      out.push('It carries about ' + fmt(r.feederI) + ' A (' + fmt(r.need) + ' A for sizing, since continuous loads count at 125%). That is ' + fmt(r.need / n.ocpd * 100) + '% of the breaker.')
      out.push('Voltage drop on this run is ' + fmt(r.drop) + ' V (' + fmt(r.dropPct) + '%). Voltage at the end is about ' + fmt(r.vEnd) + ' V. A fault at this point could reach about ' + fmt(r.iscIn / 1000) + ' kA' + (n.aic ? ' against a ' + n.aic + ' kA breaker rating.' : '.'))
    }
    if (n.type === 'xfmr') {
      out.push('This transformer steps ' + SYSTEMS[n.props.pri].label + ' to ' + SYSTEMS[n.props.sec].label + '. Rated ' + r.kva + ' kVA: full-load current is ' + fmt(r.flaP) + ' A on the primary and ' + fmt(r.flaS) + ' A on the secondary. Today it carries ' + fmt(r.loadKVA) + ' kVA (' + fmt(r.xloadPct) + '%). Higher voltage means lower current for the same power, which is why long runs use higher voltage.')
      if (r.sysBond && r.sysBond !== 'none') out.push(r.sysBond)
      out.push('Available fault current on the secondary is about ' + fmt(r.isc / 1000) + ' kA, set mostly by the transformer\'s impedance (' + (n.props.z || 5) + '%).')
    }
    if (n.type === 'ats') {
      out.push('An automatic transfer switch (ATS) picks between two sources. Normally it passes utility power through. When the utility fails it starts the generator, then switches the load over once the generator is up to speed. It is built so the two sources can never be connected at the same time.')
      out.push('Generator: ' + (r.genKva ? r.genKva + ' kVA, full-load current about ' + fmt(r.genFLA) + ' A, carrying ' + fmt(r.S / 1000) + ' kVA of load (' + fmt(r.genLoadPct) + '%). Its conductors are ' + r.genWire + ' Cu rated ' + r.genAmp + ' A; the rule is at least 115% of its full-load current (' + fmt(r.genFLA * 1.15) + ' A).' : 'No generator size is set yet.'))
    }
    if (n.type === 'panel') {
      out.push('This panel has a ' + r.bus + ' A bus and ' + r.spaces + ' spaces (' + r.used + ' used). The branch circuits add up to about ' + fmt(r.S / 1000) + ' kVA. Per-leg current: ' + r.I.slice(0, SYSTEMS[r.sys].ph === 1 ? 2 : 3).map(fmt).join(' / ') + ' A' + (r.neutral ? '; neutral carries ' + fmt(r.neutral) + ' A, the difference between legs' : '') + '.')
      out.push('Neutral and ground: only at the service (or a transformer) are they bonded together. In a downstream panel keep them separate so normal return current never flows on the grounding conductors.')
    }
    if (n.type === 'meter') out.push('Total energy through here at the current load: about ' + fmt(r.S / 1000) + ' kVA. At 0.9 power factor, running all day that is about ' + fmt(r.S / 1000 * 0.9 * 24) + ' kWh.')
    if (n.type === 'load') out.push('It draws about ' + fmt(r.Imax) + ' A at ' + fmt(sys.vll) + ' V. Motors also pull about 5 to 6 times that for a moment while starting, which is why motor breakers are sized differently.')
    ;(r.warnings || []).forEach(function (w) { out.push((w.lvl === 'bad' ? 'PROBLEM: ' : w.lvl === 'warn' ? 'Warning: ' : 'Note: ') + w.msg) })
    return out
  }

  /* ---------- examples ---------- */
  var ex = []
  function EX(id, title, text, build) { ex.push({ id: id, title: title, text: text, build: build }) }
  function mdl(name, root) { return normalize({ name: name, root: root }) }
  function U(sys, kA) { return node('utility', 'Utility', { sys: sys, isc: kA || 10 }) }
  function add(parent, child) { parent.kids.push(child); return child }
  function f(n, size, len, ocpd, mat, aic) { n.feeder = { size: size, mat: mat || 'Cu', len: len, sets: 1 }; n.ocpd = ocpd; if (aic) n.aic = aic; return n }

  EX.push && 0
  EX('home', 'Single-family home, 200 A service', 'A typical 120/240 V home: meter, main breaker, and one panel with the loads you would expect.', function () {
    var u = U('1P-120/240', 10), m = add(u, f(node('meter', 'Meter'), '250', 5, 200, 'Al', 22)), d = add(m, f(node('disc', 'Main breaker', {}), '250', 3, 200, 'Al', 22))
    var p = add(d, f(node('panel', 'Main panel', { bus: 200, spaces: 40 }), '250', 5, 200, 'Al', 22))
    p.circuits = [circuit('Kitchen counter', 'recep', '120', 1800, { breaker: 20, wire: '12', cont: false }), circuit('Kitchen counter 2', 'recep', '120', 1800, { breaker: 20, wire: '12' }), circuit('Lighting', 'lighting', '120', 1440, { breaker: 15, wire: '14' }), circuit('Bedrooms', 'recep', '120', 1500, { breaker: 20, wire: '12' }), circuit('Dishwasher', 'general', '120', 1200, { breaker: 20, wire: '12' }),
      circuit('Range', 'range', '240', 9600, { breaker: 50, wire: '6' }), circuit('Dryer', 'dryer', '240', 5000, { breaker: 30, wire: '10' }), circuit('Water heater', 'wh', '240', 4500, { breaker: 30, wire: '10' }), circuit('A/C', 'hvac', '240', 4800, { breaker: 30, wire: '10' }), circuit('EV charger', 'ev', '240', 7680, { breaker: 50, wire: '6' })]
    return mdl('Home service', u)
  })
  EX('garage', 'Home with a detached garage subpanel', 'Adds a 60 A feeder to a subpanel in the garage. Look at how the voltage drop and wire size change with distance.', function () {
    var m = ex[0].build(), main = m.root.kids[0].kids[0].kids[0]
    var sp = add(main, f(node('panel', 'Garage subpanel', { bus: 100, spaces: 12 }), '6', 80, 60, 'Cu', 10))
    sp.circuits = [circuit('Garage lights', 'lighting', '120', 600, { breaker: 15, wire: '14' }), circuit('Garage outlets', 'recep', '120', 1800, { breaker: 20, wire: '12' }), circuit('Compressor outlet', 'general', '240', 2400, { breaker: 20, wire: '12' })]
    m.name = 'Home with garage'; return normalize(m)
  })
  EX('office', 'Small office building, 120/208 V', 'A 120/208 V three-phase service for a small building: main, a lighting/receptacle panel and an HVAC panel.', function () {
    var u = U('3P-120/208', 22), m = add(u, f(node('meter', 'Meter'), '500', 10, 400, 'Cu', 42)), d = add(m, f(node('disc', 'Main disconnect', {}), '500', 5, 400, 'Cu', 42)), b = add(d, f(node('bus', 'Distribution'), '500', 5, 400, 'Cu', 42))
    var pa = add(b, f(node('panel', 'Panel LP-1', { bus: 225, spaces: 42 }), '3/0', 60, 200, 'Cu', 22))
    pa.circuits = [circuit('Office lighting', 'lighting', '120', 1800, { breaker: 20, wire: '12' }), circuit('Office lighting 2', 'lighting', '120', 1800, { breaker: 20, wire: '12' }), circuit('Receptacles 1', 'recep', '120', 1800, { breaker: 20, wire: '12' }), circuit('Receptacles 2', 'recep', '120', 1800, { breaker: 20, wire: '12' }), circuit('Receptacles 3', 'recep', '120', 1800, { breaker: 20, wire: '12' }), circuit('Server room', 'general', '120', 1800, { breaker: 20, wire: '12', cont: true }), circuit('Kitchenette', 'general', '120', 1800, { breaker: 20, wire: '12' })]
    var pb = add(b, f(node('panel', 'Panel HP-1', { bus: 225, spaces: 24 }), '1/0', 50, 150, 'Cu', 22))
    pb.circuits = [circuit('RTU-1', 'hvac', '3P', 18000, { breaker: 60, wire: '6' }), circuit('RTU-2', 'hvac', '3P', 18000, { breaker: 60, wire: '6' }), circuit('Exhaust fan', 'motor', '3P', 0, { hp: 3, v: '208', breaker: 20, wire: '12' })]
    return mdl('Small office', u)
  })
  EX('apts', 'Multi-tenant building with a meter bank', 'One 120/208 V service feeds a meter bank. Each tenant has their own meter and panel, so every tenant pays for only what they use.', function () {
    var u = U('3P-120/208', 30), m = add(u, f(node('disc', 'Main disconnect', {}), '600', 10, 600, 'Cu', 42)); m.feeder.sets = 2; m.feeder.size = '400'
    var b = add(m, f(node('bus', 'Meter bank'), '600', 5, 600, 'Cu', 42)); b.feeder.sets = 2; b.feeder.size = '400'
    for (var i = 1; i <= 4; i++) {
      var mt = add(b, f(node('meter', 'Meter ' + i + 'A'), '2', 15, 100, 'Cu', 22)), p = add(mt, f(node('panel', 'Apt ' + i + 'A panel', { bus: 100, spaces: 24 }), '2', 25, 100, 'Cu', 22))
      p.circuits = [circuit('Kitchen', 'recep', '120', 1800, { breaker: 20, wire: '12' }), circuit('Lighting', 'lighting', '120', 1200, { breaker: 15, wire: '14' }), circuit('Bedrooms', 'recep', '120', 1500, { breaker: 20, wire: '12' }), circuit('Range', 'range', '208', 8000, { breaker: 40, wire: '8' }), circuit('A/C', 'hvac', '208', 3600, { breaker: 20, wire: '12' })]
    }
    return mdl('Multi-tenant building', u)
  })
  EX('plant', 'Industrial facility with multiple transformers', 'A 480 V service feeds a switchboard that serves motors directly, a 75 kVA transformer to 120/208 V panels, and a second transformer for the office. See how fault current drops downstream and how the transformers share the load.', function () {
    var u = U('3P-277/480', 35), m = add(u, f(node('meter', 'Utility meter'), '600', 10, 400, 'Cu', 65))
    var sw = add(m, f(node('bus', 'Main switchboard'), '600', 5, 400, 'Cu', 65))
    var mo = add(sw, f(node('load', 'Conveyor motor 50 HP', { kind: 'motor', motor: true, hp: 50, v: '480' }), '4', 120, 125, 'Cu', 35))
    var mo2 = add(sw, f(node('load', 'Pump motor 25 HP', { kind: 'motor', motor: true, hp: 25, v: '480' }), '8', 90, 60, 'Cu', 35))
    var x1 = add(sw, f(node('xfmr', 'T1 75 kVA', { pri: '3P-277/480', sec: '3P-120/208', kva: 75, z: 4 }), '1/0', 25, 100, 'Cu', 35))
    var p1 = add(x1, f(node('panel', 'Panel A (shop)', { bus: 225, spaces: 42 }), '3/0', 15, 225, 'Cu', 14))
    p1.circuits = [circuit('Shop lighting', 'lighting', '120', 1800, { breaker: 20, wire: '12' }), circuit('Bench receptacles', 'recep', '120', 1800, { breaker: 20, wire: '12' }), circuit('Welder', 'general', '208', 9000, { breaker: 50, wire: '6' }), circuit('Air compressor', 'motor', '3P', 0, { hp: 10, v: '208', breaker: 50, wire: '8' })]
    var x2 = add(sw, f(node('xfmr', 'T2 45 kVA', { pri: '3P-277/480', sec: '3P-120/208', kva: 45, z: 4 }), '4', 30, 60, 'Cu', 35))
    var p2 = add(x2, f(node('panel', 'Panel B (office)', { bus: 125, spaces: 30 }), '1/0', 15, 125, 'Cu', 14))
    p2.circuits = [circuit('Office lighting', 'lighting', '120', 1800, { breaker: 20, wire: '12' }), circuit('Office receptacles', 'recep', '120', 1800, { breaker: 20, wire: '12' }), circuit('Rooftop unit', 'hvac', '3P', 9000, { breaker: 30, wire: '10' })]
    return mdl('Industrial facility', u)
  })
  EX('trouble', 'Find the problems', 'This service has several mistakes: an undersized feeder, a breaker that is too small, an overloaded transformer and a long run with too much voltage drop. Click the red boxes, or press Auto-size to fix them.', function () {
    var u = U('1P-120/240', 25), d = add(u, f(node('disc', 'Main breaker', {}), '1', 5, 200, 'Cu', 10)), p = add(d, f(node('panel', 'House panel', { bus: 100, spaces: 20 }), '4', 10, 100, 'Cu', 10))
    p.circuits = [circuit('Range', 'range', '240', 12000, { breaker: 30, wire: '10' }), circuit('Dryer', 'dryer', '240', 5000, { breaker: 30, wire: '10' }), circuit('EV charger', 'ev', '240', 9600, { breaker: 40, wire: '8' }), circuit('Bedroom lights', 'lighting', '120', 2400, { breaker: 15, wire: '14' }), circuit('Kitchen', 'recep', '120', 3600, { breaker: 15, wire: '12' }), circuit('Space heaters', 'heat', '120', 1800, { breaker: 20, wire: '12' })]
    var s = add(p, f(node('panel', 'Barn subpanel', { bus: 60, spaces: 8 }), '10', 300, 60, 'Cu', 10)); s.circuits = [circuit('Shop welder', 'general', '240', 9600, { breaker: 60, wire: '6' }), circuit('Lights', 'lighting', '120', 1200, { breaker: 15, wire: '14' })]
    return mdl('Find the problems', u)
  })
  EX('standby', 'Business with a standby generator', 'A 120/208 V building with an automatic transfer switch (ATS) between the main and the critical-loads panel. The generator is sized for the critical loads only, with its conductors sized at 115% of its full-load current.', function () {
    var u = U('3P-120/208', 30), m = add(u, f(node('meter', 'Utility meter'), '500', 10, 400, 'Cu', 42)), d = add(m, f(node('disc', 'Main disconnect', {}), '500', 5, 400, 'Cu', 42))
    var a = add(d, f(node('ats', 'Transfer switch (ATS)', { genKva: 60, genWire: '3/0' }), '3/0', 10, 200, 'Cu', 42))
    var p = add(a, f(node('panel', 'Critical loads panel', { bus: 225, spaces: 42 }), '3/0', 10, 200, 'Cu', 42))
    p.circuits = [circuit('Server room A/C', 'hvac', '208', 6200, { breaker: 40, wire: '8' }), circuit('Emergency lighting', 'lighting', '120', 1500, { breaker: 20, wire: '12' }), circuit('Fire alarm and phones', 'general', '120', 1200, { breaker: 20, wire: '12' }), circuit('Sump pump', 'motor', '208', 0, { breaker: 25, wire: '10', motor: true, hp: 3, v: '208' }), circuit('Server rack', 'general', '208', 9000, { breaker: 50, wire: '6' })]
    return mdl('Standby generator', u)
  })

  /* ---------- guided challenges: a start model, goals checked live against calc() ---------- */
  var CH = []
  function CHAL(id, title, brief, hint, build, goals) { CH.push({ id: id, title: title, brief: brief, hint: hint, build: build, goals: goals }) }
  function badCount(R) { var n = 0; Object.keys(R).forEach(function (k) { (R[k].warnings || []).forEach(function (w) { if (w.lvl === 'bad') n++ }) }); return n }
  function ofType(model, t) { var out = []; walk(model.root, function (n) { if (n.type === t) out.push(n) }); return out }
  var G_CLEAN = { text: 'No red problems anywhere in the diagram', ok: function (m, R) { return badCount(R) === 0 } }

  CHAL('fixit', '1. Fix the red flags', 'This service has an undersized feeder, a breaker that is too small, an overloaded transformer and a long run. Clear every red problem.',
    'Click a red box and read what the right panel says. The Auto-size button picks safe breaker, wire and interrupting ratings for you, then see what it changed.',
    function () { return ex.filter(function (x) { return x.id === 'trouble' })[0].build() }, [G_CLEAN])
  CHAL('drop', '2. Long run to the garage', 'The garage subpanel sits 250 feet from the house on small wire, so lights dim and motors struggle. Cut the voltage drop on that feeder to 3% or less without creating new problems.',
    'Voltage drop falls when the wire gets bigger or the run gets shorter. Try a bigger wire size on the Garage subpanel feeder. Copper beats aluminum for drop.',
    function () { var m = ex.filter(function (x) { return x.id === 'garage' })[0].build(), g = ofType(m, 'panel').filter(function (p) { return /garage/i.test(p.name) })[0]; g.feeder = { size: '10', mat: 'Cu', len: 250, sets: 1 }; g.ocpd = 60; return m },
    [{ text: 'Garage feeder voltage drop is 3% or less', ok: function (m, R) { var g = ofType(m, 'panel').filter(function (p) { return /garage/i.test(p.name) })[0]; return !!g && R[g.id].dropPct <= 3.0001 } }, G_CLEAN])
  CHAL('motor', '3. A 25 HP motor, done right', 'A 25 HP, 460 V motor is wired with a 12 AWG feeder and a 100 A breaker. Fix the feeder and the breaker so the motor can start and run.',
    'Motor wire must carry 125% of the motor full-load current (NEC 430.22). The breaker can be up to 250% of full-load current so the starting surge does not trip it, but no less than 125%.',
    function () { var u = U('3P-277/480', 35), d = add(u, f(node('disc', 'Main disconnect', {}), '4/0', 5, 200, 'Cu', 35)); add(d, f(node('load', 'Pump motor 25 HP', { kind: 'motor', motor: true, hp: 25, v: '480' }), '12', 60, 100, 'Cu', 35)); return mdl('Motor circuit', u) },
    [{ text: 'The motor feeder wire and breaker are sized correctly', ok: function (m, R) { var l = ofType(m, 'load')[0]; return !!l && !(R[l.id].warnings || []).some(function (w) { return w.lvl === 'bad' }) } }, G_CLEAN])
  CHAL('xfmr', '4. Build a 208 V panel from a 480 V service', 'The utility brings 480 V but your shop equipment runs on 208 V. Add a transformer and a panel, give the panel loads, and size it so it is working but not overloaded.',
    'Select the Main disconnect, press Add to selected > Transformer, then select the transformer and add a Panel. Add a few circuits to the panel (the right panel has Add circuit). Aim for the transformer to be loaded between 25% and 80%.',
    function () { var u = U('3P-277/480', 35), m = add(u, f(node('meter', 'Utility meter'), '250', 10, 200, 'Cu', 42)); add(m, f(node('disc', 'Main disconnect', {}), '250', 5, 200, 'Cu', 42)); return mdl('480 V service', u) },
    [{ text: 'A transformer steps 480 V down to 120/208 V', ok: function (m) { return ofType(m, 'xfmr').some(function (x) { return x.props.sec === '3P-120/208' && x.props.pri === '3P-277/480' }) } },
      { text: 'A panel is fed from the transformer', ok: function (m) { return ofType(m, 'xfmr').some(function (x) { return x.kids.some(function (k) { return k.type === 'panel' }) }) } },
      { text: 'The transformer is loaded between 25% and 80%', ok: function (m, R) { return ofType(m, 'xfmr').some(function (x) { var p = R[x.id].xloadPct; return p >= 25 && p <= 80 }) } }, G_CLEAN])
  CHAL('aic', '5. Breakers that can survive a fault', 'This service is next to a strong utility transformer. A breaker with too low an interrupting rating (AIC) can explode in a short circuit. Raise the ratings that need it.',
    'Click each box and compare the available fault current with the breaker rating (kA). Pick an AIC rating at or above the available fault current. Auto-size also sets AIC.',
    function () { var u = U('1P-120/240', 65), d = add(u, f(node('disc', 'Main breaker', {}), '4/0', 3, 200, 'Cu', 10)), p = add(d, f(node('panel', 'Main panel', { bus: 200, spaces: 40 }), '4/0', 5, 200, 'Cu', 10)); p.circuits = [circuit('Range', 'range', '240', 9600, { breaker: 50, wire: '6' }), circuit('Lighting', 'lighting', '120', 1500, { breaker: 15, wire: '14' }), circuit('Receptacles', 'recep', '120', 1800, { breaker: 20, wire: '12' })]; return mdl('Strong utility', u) },
    [G_CLEAN])
  CHAL('gen', '6. Size the backup generator', 'A clinic wants standby power for its critical loads. The generator is too small and its conductors are too light. Make the generator big enough and fix its conductors, without overshooting wildly.',
    'The transfer switch box shows the generator size and its loading. Keep the generator under about 80% loaded. Generator conductors need at least 115% of its full-load current: Auto-size does both.',
    function () { var m = ex.filter(function (x) { return x.id === 'standby' })[0].build(), a = ofType(m, 'ats')[0]; a.props.genKva = 20; a.props.genWire = '8'; return m },
    [{ text: 'Generator loaded to 80% or less', ok: function (m, R) { var a = ofType(m, 'ats')[0]; return !!a && R[a.id].genLoadPct <= 80.01 && R[a.id].genKva > 0 } },
      { text: 'Generator is not oversized (loaded above 35%)', ok: function (m, R) { var a = ofType(m, 'ats')[0]; return !!a && R[a.id].genLoadPct >= 35 } }, G_CLEAN])
  function checkChallenge(id, model) {
    var c = CH.filter(function (x) { return x.id === id })[0]; if (!c) return null
    var R = calc(model); return c.goals.map(function (g) { var ok = false; try { ok = !!g.ok(model, R) } catch (e) {} return { text: g.text, ok: ok } })
  }

  var K = { SYSTEMS: SYSTEMS, OCPD: OCPD, SIZES: SIZES, KINDS: KINDS, node: node, circuit: circuit, walk: walk, find: find, normalize: normalize, calc: calc, autoSize: autoSize, describe: describe, examples: ex, challenges: CH, checkChallenge: checkChallenge, ampacity: ampacity, resist: resist, nextOCPD: nextOCPD, sizeFor: sizeFor, motorFLA: motorFLA, circuitVA: circuitVA, uid: uid }
  return K
})
