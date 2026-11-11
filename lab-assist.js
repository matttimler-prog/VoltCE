/* VoltCE Circuit Lab Assistant: explain a circuit, build one from a description (typed or spoken),
   trace over an uploaded diagram with free in-browser OCR hints, and find manuals. No paid services. */
(function (root) {
  'use strict'
  var SC = root.SimCore, Lab = root.Lab, LE = root.LabEx
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function clone(o) { return JSON.parse(JSON.stringify(o)) }
  function n1(v) { return (Math.round(v * 10) / 10).toString() }

  /* ---------- what each part does ---------- */
  var DESC = {
    src1: function (p) { return 'A ' + p.volts + ' V single-phase source. One hot line (L) and a neutral (N). Current flows out of L, through the circuit, and back on N.' },
    src2: function (p) { return 'A 240 V split-phase source. Two hot lines (L1, L2) are 240 V apart; each is ' + p.vln + ' V to the neutral. Loads can use 120 V (hot to neutral) or 240 V (hot to hot).' },
    src3: function (p) { return 'A ' + p.vll + ' V three-phase source. Three hot lines, ' + p.vll + ' V between any two and ' + n1(p.vll / Math.sqrt(3)) + ' V from each to neutral. The phases are 120° apart, which is what makes a motor turn.' },
    gnd: function () { return 'A ground connection. It ties that point to the earth reference (0 V) so faults have a path back to the source.' },
    sw: function () { return 'A switch. Closed it is a wire; open it breaks the circuit and no current flows.' },
    sw2: function () { return 'A three-way (SPDT) switch. The common (C) connects to one of two travelers. Two of them in a row let you control a light from two places.' },
    pbno: function () { return 'A normally open pushbutton. It conducts only while held. Used as a START button.' },
    pbnc: function () { return 'A normally closed pushbutton. It conducts until pressed, which breaks the circuit. Used as a STOP button.' },
    estop: function () { return 'An emergency stop. Normally closed; pressing it breaks the control circuit and it stays latched until reset.' },
    fuse: function (p) { return 'A ' + p.amps + ' A fuse. It protects the wire by melting open if current stays well above ' + p.amps + ' A (and very quickly on a short circuit).' },
    brk: function (p) { return 'A ' + p.amps + ' A ' + (p.poles > 1 ? p.poles + '-pole ' : '') + 'circuit breaker. It trips on a sustained overload (thermal) or a large short-circuit current (magnetic), and can be reset.' },
    ol: function (p) { return 'An overload relay set at ' + p.amps + ' A. It sits after the contactor and opens the control circuit (contacts 95-96) if the motor draws too much current for too long. It protects the motor, not the wire.' },
    lamp: function (p) { return 'A ' + p.watts + ' W, ' + p.volts + ' V lamp (about ' + n1(p.watts / p.volts) + ' A). Too much voltage burns it out; too little makes it dim.' },
    heater: function (p) { return 'A ' + p.watts + ' W, ' + p.volts + ' V resistive heater (about ' + n1(p.watts / p.volts) + ' A). All of its power becomes heat.' },
    motor1: function (p) { return 'A single-phase ' + p.volts + ' V motor, full-load current ' + p.fla + ' A.' },
    motor3: function (p) { return 'A three-phase ' + p.volts + ' V motor, full-load current ' + p.fla + ' A. It starts with about 5x that current (locked-rotor), and swapping any two lines reverses its direction.' },
    coil: function (p) { return 'The ' + (p.kind === 'timer' ? 'timer' : p.kind === 'contactor' ? 'contactor' : 'relay') + ' coil ' + p.tag + ' (' + p.volts + ' V). When voltage is applied it becomes an electromagnet and moves every contact with tag ' + p.tag + (p.kind === 'timer' ? ' after ' + p.delay + ' s' : '') + '. The coil itself carries only a small current.' },
    cnt: function (p) { return 'A ' + p.tag + ' contact (' + p.form + '). It is a switch that the ' + p.tag + ' coil operates: ' + (/NC/.test(p.form) ? 'closed at rest, opens when the coil energizes.' : 'open at rest, closes when the coil energizes.') },
    cpoles: function (p) { return 'The ' + p.poles + ' power contacts of ' + p.tag + '. They carry the motor current and close together when the ' + p.tag + ' coil energizes.' },
    xfmr1: function (p) { return 'A single-phase transformer, ' + p.vp + ' V to ' + p.vs + ' V, ' + p.kva + ' kVA. Voltage is multiplied by the turns ratio and current is divided by it, so power stays about the same.' },
    xfmr3: function (p) { return 'A three-phase transformer (' + String(p.conn).toUpperCase() + ' connection), ' + p.vp + ' V to ' + p.vs + ' V, ' + p.kva + ' kVA. The connection decides the secondary voltage and whether a neutral is available.' },
    vm: function () { return 'A voltmeter. Connect it across (in parallel with) the thing you want to measure.' },
    am: function () { return 'An ammeter. Connect it in the line (in series) so the current flows through it.' }
  }
  function props(c) { return SC.propsOf(c) }
  function labelOf(c) { return c.label || c.id }

  /* run the circuit headless the way it is normally used: switches closed, pushbuttons pressed once */
  function headless(model) {
    var m = clone(model), i, res
    m.comps.forEach(function (c) { c.props = c.props || {}; if (c.type === 'sw') c.props.on = true; if (c.type === 'estop') c.props.latched = false; if (c.type === 'brk') c.props.on = true })
    var wires = m.wires.map(function (w, k) { return { id: w.id || 'w' + k, a: w.a, b: w.b, via: w.via } })
    var sim = SC.create({ comps: m.comps, wires: wires })
    for (i = 0; i < 6; i++) res = sim.step(0.05)
    var pbs = m.comps.filter(function (c) { return c.type === 'pbno' })
    pbs.forEach(function (c) { sim.press(c.id, true) }); for (i = 0; i < 24; i++) res = sim.step(0.05); pbs.forEach(function (c) { sim.press(c.id, false) })
    for (i = 0; i < 100; i++) res = sim.step(0.05)
    return res
  }
  function fmtState(c, r) {
    if (!r) return ''
    var t = c.type, st = r.status
    if (st && st !== 'ok') return { burnt: 'burnt out', blown: 'blown', tripped: 'tripped', destroyed: 'destroyed' }[st] || st
    if (t === 'lamp') return r.brightness > 0.05 ? 'lit at ' + Math.round(Math.min(1.5, r.brightness) * 100) + '% (' + n1(r.i) + ' A)' : 'off'
    if (t === 'heater') return r.i > 0.05 ? 'heating, ' + n1(r.i) + ' A' : 'off'
    if (t === 'motor1' || t === 'motor3') return r.running ? 'running' + (r.dir ? (r.dir > 0 ? ' forward' : ' reversed') : '') + ', ' + n1(r.i) + ' A' : (r.i > 0.5 ? 'stalled, drawing ' + n1(r.i) + ' A' : 'stopped')
    if (t === 'coil') return r.energized ? 'energized' : 'de-energized'
    if (t === 'xfmr1' || t === 'xfmr3') return r.vsec ? 'secondary ' + n1(r.vsec) + ' V' : 'no output'
    if (t === 'fuse' || t === 'brk' || t === 'ol') return r.i > 0.05 ? 'closed, carrying ' + n1(r.i) + ' A' : 'closed, no load'
    return ''
  }

  /* plain-language explanation of any circuit */
  function explain(model) {
    var out = { big: [], parts: [], result: [], legend: [], tips: [] }, comps = model.comps || []
    if (!comps.length) { out.big.push('The canvas is empty. Add a source, a load and wire them in a loop. Current only flows when there is a complete path out of the source and back.'); return out }
    var has = function (t) { return comps.some(function (c) { return c.type === t }) }, cnt = function (t) { return comps.filter(function (c) { return c.type === t }).length }
    var coils = comps.filter(function (c) { return c.type === 'coil' })
    var hasSrc = comps.some(function (c) { return /^src/.test(c.type) }), hasLoad = comps.some(function (c) { return /^(lamp|heater|motor1|motor3|xfmr1|xfmr3)$/.test(c.type) })
    out.big.push('Electricity needs a complete loop: out of the source, through the load, and back to the source. A switch or fuse is just a part of that loop that can open it.')
    if (!hasSrc) out.tips.push('There is no source yet. Add one from the Sources group.')
    if (hasSrc && !hasLoad) out.tips.push('There is no load yet (lamp, heater, motor or transformer).')
    if (has('motor3')) out.big.push('A three-phase motor needs all three lines at the right voltage. Lose one line (single-phasing) or run it at the wrong voltage and it overheats; swap two lines and it reverses.')
    if (has('xfmr1') || has('xfmr3')) out.big.push('A transformer changes voltage and (inversely) current. It only works on AC, and it isolates the secondary from the primary.')
    if (coils.length) {
      var nc = has('pbnc') || has('estop'), no = has('pbno'), seal = coils.some(function (k) { return comps.some(function (c) { return c.type === 'cnt' && c.props && c.props.tag === (k.props || {}).tag }) })
      out.big.push('This is a control circuit: a small (control) voltage operates a coil, and the coil\'s contacts switch the big load current. That keeps people away from line voltage and lets one small button control a large motor.')
      if (no && nc && seal) out.big.push('Start/stop with seal-in: pressing START energizes the coil; the coil\'s own auxiliary contact then closes in parallel with START, so it stays on after you let go ("seals in"). The normally closed STOP (and the overload contact) are in series, so opening any of them drops the coil out.')
      if (coils.some(function (k) { return (k.props || {}).kind === 'timer' })) out.big.push('A timer coil delays its contacts instead of moving them instantly. On-delay: the contact changes a set time after the coil is energized.')
    }
    if (cnt('sw2') >= 2) out.big.push('Two three-way switches make a circuit you can toggle from either end: the travelers swap which path carries power, so any flip changes the lamp.')
    if (has('fuse') || has('brk')) out.big.push('Protection (fuse or breaker) is sized to protect the wire, so it must be larger than the normal load current but smaller than the wire\'s ampacity. A short circuit should open it fast.')
    var seen = {}
    comps.forEach(function (c) {
      var d = DESC[c.type]; if (!d) return
      out.parts.push({ id: c.id, name: labelOf(c), type: c.type, text: d(props(c)) })
      if (!seen[c.type]) { seen[c.type] = 1; out.legend.push({ type: c.type, name: (SC.TYPES[c.type] || {}).label || c.type, text: d(props(c)), comp: c }) }
    })
    var res = null; try { res = headless(model) } catch (e) { }
    if (res) {
      comps.forEach(function (c) { if (/^(lamp|heater|motor1|motor3|coil|xfmr1|xfmr3|fuse|brk|ol)$/.test(c.type)) { var s = fmtState(c, res.comp[c.id]); if (s) out.result.push({ id: c.id, name: labelOf(c), text: s, bad: /burnt|blown|tripped|destroyed|stalled/.test(s) }) } })
      var seenE = {}; res.events.forEach(function (e) { var k = e.type + e.comp; if (seenE[k]) return; seenE[k] = 1; if (/trip|blow|burn|explode|fault|oltrip/.test(e.type)) out.tips.push(e.msg) })
    }
    return out
  }

  /* ---------- build from a description ---------- */
  var TEMPLATES = [
    [/(start.?stop|seal.?in|starter|motor control|run.*stop|contactor)/, 'starter', 'a motor starter with start/stop buttons, a seal-in contact and an overload relay'],
    [/(three.?way|3.?way|two places|two switches)/, 'threeway', 'two 3-way switches controlling one lamp'],
    [/(short|dead short)/, 'short', 'a short circuit cleared by a breaker'],
    [/(delay|timer|time delay)/, 'timer', 'an on-delay timer'],
    [/(delta.*wye|wye.*delta|dy\b|d-y|delta.*y\b)/, 'dy', 'a delta-wye transformer feeding a motor'],
    [/(phase.?loss|single.?phas|lose.*phase|lost.*phase)/, 'phaseloss', 'a motor losing one phase'],
    [/(wrong|under.?volt|480.*208|208.*480).*motor|motor.*(wrong|under.?volt)/, 'wrongmotor', 'a motor on the wrong voltage'],
    [/(transformer|step.?down|step.?up)/, 'xfmr', 'a transformer stepping 480 V down to 120 V'],
    [/(240.*lamp.*burn|wrong.*volt.*lamp|lamp.*wrong.*volt)/, 'wrongvolt', 'a 120 V lamp on 240 V']
  ]
  var NUMW = { one: 1, two: 2, three: 3 }
  function parse(text) {
    var t = String(text || '').toLowerCase().replace(/-/g, ' ')
    var out = { text: t, template: null, spec: null }
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i][0].test(t)) { var ok = LE && LE.examples.some(function (e) { return e.id === TEMPLATES[i][1] }); if (ok) { out.template = TEMPLATES[i][1]; out.what = TEMPLATES[i][2]; return out } }
    var phase = /(3 ?phase|three ?phase|3 ?ph\b|3 ?φ|480|208|600|575)/.test(t) ? 3 : /(240|split|220|230)/.test(t) ? 2 : 1
    var vm = t.match(/(\d{3})\s*(v|volt)/), volts = vm ? +vm[1] : (phase === 3 ? 480 : phase === 2 ? 240 : 120)
    var load = /heater|heat|element/.test(t) ? 'heater' : /motor|pump|fan|compressor|conveyor/.test(t) ? 'motor' : 'lamp'
    var am = t.match(/(\d+(\.\d+)?)\s*(a\b|amp)/), amps = am ? +am[1] : null
    var order = [], rx = /(breaker|fuse|disconnect|switch|overload|e.?stop|emergency stop|ammeter|voltmeter)/g, m
    while ((m = rx.exec(t))) order.push(/breaker|disconnect/.test(m[1]) ? 'brk' : m[1] === 'fuse' ? 'fuse' : /overload/.test(m[1]) ? 'ol' : /e.?stop|emergency/.test(m[1]) ? 'estop' : m[1] === 'ammeter' ? 'am' : m[1] === 'voltmeter' ? 'vm' : 'sw')
    out.spec = { phase: phase, volts: volts, load: load, amps: amps, devices: order.slice(0, 5) }
    return out
  }
  function chain(spec) {
    var comps = [], wires = [], uidn = 0
    function id(p) { return p + (++uidn) }
    var P = LE.P, W = LE.W
    if (spec.phase === 3) {
      var vll = [208, 240, 480, 600].indexOf(spec.volts) >= 0 ? spec.volts : 480
      var src = P('src3', 'V1', 0, 0, 0, { vll: vll }); comps.push(src)
      var prev = ['V1.L1', 'V1.L2', 'V1.L3'], y = 180
      var devs = spec.devices.filter(function (d) { return /^(brk|fuse|sw|ol)$/.test(d) })
      if (!devs.length) devs = ['brk']
      devs.forEach(function (d, k) {
        var cid, ins, outs
        if (d === 'brk') { cid = id('CB'); comps.push(P('brk', cid, -20, y, 0, { amps: spec.amps || 30, poles: 3 })); ins = ['in1', 'in2', 'in3']; outs = ['out1', 'out2', 'out3']; for (var i = 0; i < 3; i++) wires.push(W(prev[i], cid + '.' + ins[i])); prev = outs.map(function (o) { return cid + '.' + o }) }
        else if (d === 'ol') { cid = id('OL'); comps.push(P('ol', cid, -20, y, 0, { amps: spec.amps || 10 })); for (var j = 0; j < 3; j++) wires.push(W(prev[j], cid + '.L' + (j + 1))); prev = ['T1', 'T2', 'T3'].map(function (o) { return cid + '.' + o }) }
        else { var np = []; for (var q = 0; q < 3; q++) { cid = id(d === 'fuse' ? 'F' : 'S'); comps.push(P(d, cid, -60 + 40 * q, y, 0, d === 'fuse' ? { amps: spec.amps || 30 } : { on: true })); wires.push(W(prev[q], cid + '.a')); np.push(cid + '.b') } prev = np }
        y += 160
      })
      var load
      if (spec.load === 'motor') { comps.push(P('motor3', 'M1', -20, y, 0, { volts: vll, fla: 7.6 })); for (var k2 = 0; k2 < 3; k2++) wires.push(W(prev[k2], 'M1.T' + (k2 + 1))) }
      else { comps.push(P('heater', 'HT1', -20, y, 0, { volts: vll, watts: 4500 })); wires.push(W(prev[0], 'HT1.a')); wires.push(W(prev[1], 'HT1.b')) }
      return LE.mk(comps, wires)
    }
    // single-phase / split-phase: a left-to-right loop
    var two = spec.phase === 2, v = two ? 240 : (spec.volts === 240 ? 240 : 120)
    comps.push(P(two ? 'src2' : 'src1', 'V1', 0, 0, 3, two ? { vln: 120 } : { volts: v }))
    var x = 160, prevT = two ? 'V1.L1' : 'V1.L', lastY = 20
    spec.devices.filter(function (d) { return /^(brk|fuse|sw|estop|am)$/.test(d) }).forEach(function (d) {
      var cid = id(d === 'brk' ? 'CB' : d === 'fuse' ? 'F' : d === 'sw' ? 'S' : d === 'am' ? 'A' : 'ES')
      comps.push(P(d, cid, x, lastY, 3, d === 'brk' ? { amps: spec.amps || 20, poles: 1 } : d === 'fuse' ? { amps: spec.amps || 20 } : d === 'sw' ? { on: false } : {}))
      wires.push(W(prevT, cid + '.' + (d === 'brk' ? 'in1' : 'a'))); prevT = cid + '.' + (d === 'brk' ? 'out1' : 'b'); x += 140
    })
    var ld = spec.load === 'motor' ? 'motor1' : spec.load === 'heater' ? 'heater' : 'lamp', lp = ld === 'lamp' ? { volts: v, watts: 60 } : ld === 'heater' ? { volts: v, watts: v === 240 ? 4500 : 1500 } : { volts: v, fla: 9.8 }
    comps.push(P(ld, 'LD1', x, lastY, 3, lp)); wires.push(W(prevT, 'LD1.a'))
    var ret = two ? 'V1.L2' : 'V1.N'
    wires.push(W('LD1.b', ret, [[x + 60, lastY], [x + 60, -100], [80, -100], [80, -40]]))
    return LE.mk(comps, wires)
  }
  function describeSpec(spec) {
    var names = { brk: 'breaker', fuse: 'fuse', sw: 'switch', ol: 'overload relay', estop: 'E-stop', am: 'ammeter', vm: 'voltmeter' }
    return (spec.phase === 3 ? spec.volts + ' V three-phase' : spec.phase === 2 ? '240 V' : '120 V') + ' source' + (spec.devices.length ? ', ' + spec.devices.map(function (d) { return names[d] }).join(', ') : '') + ', then a ' + spec.load
  }
  function build(text) {
    var p = parse(text)
    if (p.template) { var e = LE.examples.filter(function (x) { return x.id === p.template })[0]; return { model: e.build(), summary: 'I matched your description to the "' + e.title + '" example: ' + p.what + '.', template: p.template, assumptions: ['Matched by keywords. Use Examples to browse the full list.'] } }
    var s = p.spec, a = []
    if (!/lamp|heater|motor|pump|fan|compressor|conveyor/.test(p.text)) a.push('No load was mentioned, so I used a lamp.')
    if (!s.devices.length) a.push('No protection or switch was mentioned' + (s.phase === 3 ? ', so I added a 3-pole breaker.' : '.'))
    if (!/\d{3}\s*(v|volt)/.test(p.text)) a.push('No voltage was given, so I assumed ' + (s.phase === 3 ? '480 V three-phase' : s.phase === 2 ? '240 V' : '120 V') + '.')
    if (s.phase === 3 && s.load !== 'motor') a.push('A three-phase heater is wired here as a single element across two lines.')
    return { model: chain(s), summary: 'Built: ' + describeSpec(s) + '.', template: null, assumptions: a }
  }

  root.LabAssist = { explain: explain, parse: parse, build: build, headless: headless, DESC: DESC }
  if (typeof module === 'object' && module.exports) module.exports = root.LabAssist
})(typeof window !== 'undefined' ? window : globalThis)
