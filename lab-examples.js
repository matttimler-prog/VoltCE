/* VoltCE Circuit Lab: ready-made circuits and guided challenges. */
(function (root) {
  'use strict'
  function P(type, id, x, y, rot, props, label) { var c = { id: id, type: type, x: x, y: y, rot: rot || 0, props: props || {} }; if (label !== undefined) c.label = label; return c }
  function W(a, b, via) { var w = { a: a, b: b }; if (via) w.via = via; return w }
  function mk(comps, wires) { wires.forEach(function (w, i) { w.id = 'w' + (i + 1) }); return { comps: comps, wires: wires } }

  var EX = []
  function ex(id, title, text, tryIt, build) { EX.push({ id: id, title: title, text: text, try: tryIt, build: build }) }

  ex('lamp', '1. Lamp and switch', 'A 120 V source, a switch and a lamp in one loop. Turn power on, then click the switch.', 'Delete the wire from the switch to the lamp, then turn power on.', function () {
    return mk([P('src1', 'V1', 0, 0, 3), P('sw', 'S1', 200, 20, 3), P('lamp', 'LP1', 340, 20, 3)],
      [W('V1.L', 'S1.a'), W('S1.b', 'LP1.a'), W('LP1.b', 'V1.N')])
  })
  ex('short', '2. Short circuit with a breaker', 'A wire bridges the lamp, so current skips the load. A breaker is the only thing between the source and a dead short.', 'Turn power on and watch the breaker clear it. Then delete the breaker, wire the source straight to the switch, and try again.', function () {
    return mk([P('src1', 'V1', 0, 0, 3), P('brk', 'CB1', 160, 20, 3, { amps: 15 }), P('sw', 'S1', 300, 20, 3, { on: true }), P('lamp', 'LP1', 440, 20, 3)],
      [W('V1.L', 'CB1.in1'), W('CB1.out1', 'S1.a'), W('S1.b', 'LP1.a'), W('LP1.b', 'V1.N'), W('S1.b', 'V1.N', [[340, -40], [80, -40]])])
  })
  ex('wrongvolt', '3. Wrong voltage burns the lamp', 'A 120 V lamp wired across 240 V (L1 to L2). It gets twice the voltage.', 'Move the lamp wire from L2 to N and it runs normally.', function () {
    return mk([P('src2', 'V1', 0, 0, 3), P('sw', 'S1', 200, 20, 3, { on: false }), P('lamp', 'LP1', 340, 20, 3)],
      [W('V1.L1', 'S1.a'), W('S1.b', 'LP1.a'), W('LP1.b', 'V1.L2', [[400, 20], [400, -80], [80, -80], [80, -40]])])
  })
  ex('threeway', '4. Three-way switches', 'Two 3-way switches control one lamp from two places. Click either switch while power is on.', 'Flip each switch and work out which combinations turn the lamp on.', function () {
    return mk([P('src1', 'V1', 0, 0, 3), P('sw2', 'S1', 180, 20, 3, { pos: 1 }), P('sw2', 'S2', 380, 20, 1, { pos: 1 }), P('lamp', 'LP1', 520, 20, 3)],
      [W('V1.L', 'S1.c'), W('S1.t2', 'S2.t1'), W('S1.t1', 'S2.t2'), W('S2.c', 'LP1.a'), W('LP1.b', 'V1.N')])
  })
  ex('heater', '5. Heater on a fuse', 'A 240 V, 4500 W heater draws 18.75 A. The 20 A fuse is fine; a 15 A fuse is not. The ammeter shows the current.', 'Select the fuse, change its rating to 15, and run it.', function () {
    return mk([P('src2', 'V1', 0, 0, 3), P('fuse', 'F1', 160, 20, 3, { amps: 20 }), P('sw', 'S1', 280, 20, 3, { on: true }), P('am', 'A1', 400, 20, 3), P('heater', 'HT1', 520, 20, 3, { volts: 240, watts: 4500 })],
      [W('V1.L1', 'F1.a'), W('F1.b', 'S1.a'), W('S1.b', 'A1.a'), W('A1.b', 'HT1.a'), W('HT1.b', 'V1.L2', [[580, 20], [580, -100], [80, -100], [80, -40]])])
  })
  ex('xfmr', '6. Transformer 480 V to 120 V', 'A single-phase transformer steps 480 V down to 120 V for a lamp. Click the transformer to see its readings.', 'Change the secondary to 240 V. What does the lamp do?', function () {
    return mk([P('src3', 'V1', 0, 0, 0), P('brk', 'CB1', -40, 180, 0, { amps: 15, poles: 2 }), P('xfmr1', 'T1', -40, 340, 0, { vp: 480, vs: 120, kva: 1 }), P('lamp', 'LP1', -40, 520, 0)],
      [W('V1.L1', 'CB1.in1'), W('V1.L2', 'CB1.in2'), W('CB1.out1', 'T1.H1'), W('CB1.out2', 'T1.H2'), W('T1.X1', 'LP1.a'), W('LP1.b', 'T1.X2', [[-40, 580], [0, 580], [0, 420]])])
  })
  ex('dy', '7. Delta–wye transformer feeding a motor', 'A 480 V delta primary and 208 V wye secondary run a 208 V motor. The neutral is grounded.', 'Change the transformer to Δ–Δ and set the motor to 480 V. Wrong combinations burn up.', function () {
    return mk([P('src3', 'V1', 0, 0, 0), P('brk', 'CB1', -20, 170, 0, { amps: 30, poles: 3 }), P('xfmr3', 'T1', -20, 330, 0, { conn: 'dy', vp: 480, vs: 208, kva: 15 }), P('motor3', 'M1', -20, 500, 0, { volts: 208, fla: 20 }), P('gnd', 'G1', 160, 400, 3)],
      [W('V1.L1', 'CB1.in1'), W('V1.L2', 'CB1.in2'), W('V1.L3', 'CB1.in3'), W('CB1.out1', 'T1.H1'), W('CB1.out2', 'T1.H2'), W('CB1.out3', 'T1.H3'), W('T1.X1', 'M1.T1'), W('T1.X2', 'M1.T2'), W('T1.X3', 'M1.T3'), W('T1.X0', 'G1.g')])
  })
  ex('starter', '8. Motor start/stop starter', 'A full 3-phase motor starter: breaker, contactor, overload relay, a control transformer, and stop/start buttons with a seal-in contact. Hold START to run, release it, and the motor keeps running.', 'Press STOP. Then add a load by raising the motor FLA to 12 and watch the overload relay trip.', function () {
    return mk([
      P('src3', 'V1', 0, 0, 0), P('brk', 'CB1', -20, 180, 0, { amps: 15, poles: 3 }), P('cpoles', 'K1', -20, 330, 0, { tag: 'M1', poles: 3 }), P('ol', 'OL1', -20, 480, 0, { amps: 8 }), P('motor3', 'M1', -20, 640, 0, { volts: 480, fla: 7.6 }),
      P('xfmr1', 'T1', 240, 180, 0, { vp: 480, vs: 120, kva: 0.25 }), P('gnd', 'G2', 280, 300, 0), P('gnd', 'G3', 160, 500, 3),
      P('pbnc', 'PB1', 380, 360, 3, { }, 'STOP'), P('pbno', 'PB2', 500, 360, 3, {}, 'START'), P('cnt', 'K1a', 500, 440, 3, { tag: 'M1', form: 'NO' }, 'M1 seal'), P('coil', 'K1c', 640, 360, 3, { tag: 'M1', volts: 120, kind: 'contactor' })],
      [W('V1.L1', 'CB1.in1'), W('V1.L2', 'CB1.in2'), W('V1.L3', 'CB1.in3'),
        W('CB1.out1', 'K1.L1'), W('CB1.out2', 'K1.L2'), W('CB1.out3', 'K1.L3'), W('K1.T1', 'OL1.L1'), W('K1.T2', 'OL1.L2'), W('K1.T3', 'OL1.L3'), W('OL1.T1', 'M1.T1'), W('OL1.T2', 'M1.T2'), W('OL1.T3', 'M1.T3'),
        W('V1.L1', 'T1.H1', [[-60, 100], [200, 100]]), W('V1.L2', 'T1.H2', [[-20, 90], [280, 90]]),
        W('T1.X2', 'G2.g'), W('T1.X1', 'PB1.a', [[200, 360]]), W('PB1.b', 'PB2.a'), W('PB1.b', 'K1a.a', [[440, 360], [440, 440]]), W('PB2.b', 'K1c.A1'), W('K1a.b', 'K1c.A1', [[580, 440], [580, 360]]),
        W('K1c.A2', 'OL1.95', [[700, 360], [700, 460], [80, 460]]), W('OL1.96', 'G3.g')])
  })
  ex('wrongmotor', '9. Wrong voltage on a motor', 'A 480 V motor is connected to a 208 V source. It is under-voltage: it cannot start, draws locked-rotor current, and overheats.', 'Add an overload relay, or change the source to 480 V.', function () {
    return mk([P('src3', 'V1', 0, 0, 0, { vll: 208 }), P('brk', 'CB1', -20, 180, 0, { amps: 30, poles: 3 }), P('motor3', 'M1', -20, 340, 0, { volts: 480, fla: 7.6 })],
      [W('V1.L1', 'CB1.in1'), W('V1.L2', 'CB1.in2'), W('V1.L3', 'CB1.in3'), W('CB1.out1', 'M1.T1'), W('CB1.out2', 'M1.T2'), W('CB1.out3', 'M1.T3')])
  })
  ex('phaseloss', '10. Single-phasing', 'Three switches, one per line. Turn them all on and the motor runs. Turn one off and the motor loses a phase: it hums, draws extra heat, and burns up if nothing protects it.', 'Turn on all three switches, then turn one off.', function () {
    return mk([P('src3', 'V1', 0, 0, 0), P('sw', 'S1', -60, 160, 0, { on: true }, 'L1'), P('sw', 'S2', -20, 160, 0, { on: true }, 'L2'), P('sw', 'S3', 20, 160, 0, { on: true }, 'L3'), P('motor3', 'M1', -20, 320, 0, { volts: 480, fla: 7.6 })],
      [W('V1.L1', 'S1.a'), W('V1.L2', 'S2.a'), W('V1.L3', 'S3.a'), W('S1.b', 'M1.T1'), W('S2.b', 'M1.T2'), W('S3.b', 'M1.T3')])
  })
  ex('timer', '11. On-delay timer', 'A timer relay turns a lamp on three seconds after the switch closes.', 'Change the delay, or switch the timer to off-delay.', function () {
    return mk([P('src1', 'V1', 0, 0, 3), P('sw', 'S1', 180, -40, 3, { on: false }), P('coil', 'TR1', 320, -40, 3, { tag: 'T1', kind: 'timer', mode: 'on', delay: 3, volts: 120 }), P('cnt', 'T1a', 320, 100, 3, { tag: 'T1', form: 'NOTD' }), P('lamp', 'LP1', 460, 100, 3)],
      [W('V1.L', 'S1.a', [[100, 20], [100, -40]]), W('S1.b', 'TR1.A1'), W('TR1.A2', 'V1.N', [[400, -40], [400, -80], [80, -80], [80, -20]]), W('S1.b', 'T1a.a', [[240, -40], [240, 100]]), W('T1a.b', 'LP1.a'), W('LP1.b', 'V1.N', [[520, 100], [520, -80], [80, -80], [80, -20]])])
  })


  /* ---------- guided challenges (check() runs each tick while power is on) ---------- */
  var CH = []
  function chal(id, title, goal, hint, win, start, check) { CH.push({ id: id, title: title, goal: goal, hint: hint, win: win, start: start, check: check }) }
  var comp = function (r, id) { return r.comp[id] || {} }

  chal('c1', 'Light the lamp', 'Wire the lamp to the source so it glows. Drag from one terminal to another, then press Power.', 'Run one wire from L to the lamp, and one from the other side of the lamp back to N.', 'A complete loop: out on the hot wire, back on the neutral.',
    function () { return mk([P('src1', 'V1', 0, 0, 3), P('lamp', 'LP1', 300, 20, 3)], []) },
    function (r) { return comp(r, 'LP1').brightness > 0.95 })
  chal('c2', 'Put a switch in the circuit', 'Wire the switch in series with the lamp, then turn the switch on. The lamp must light through the switch.', 'Source L to the switch, the switch to the lamp, the lamp back to N. Click the switch while power is on.', 'A switch goes in the hot (ungrounded) conductor, in series with the load.',
    function () { return mk([P('src1', 'V1', 0, 0, 3), P('sw', 'S1', 180, 20, 3, { on: false }), P('lamp', 'LP1', 340, 20, 3)], []) },
    function (r) { return comp(r, 'LP1').brightness > 0.95 && comp(r, 'S1').i > 0.4 })
  chal('c3', 'Fix the burned-out lamp', 'This 120 V lamp is wired across 240 V and burns out. Rewire it so it lights at full brightness.', 'A 120 V load goes from one hot leg to neutral (N), not across both hot legs.', 'Hot-to-neutral gives 120 V on a split-phase service.',
    function () { var m = EX.filter(function (e) { return e.id === 'wrongvolt' })[0].build(); m.comps.forEach(function (c) { if (c.id === 'S1') c.props.on = true }); return m },
    function (r) { var b = comp(r, 'LP1').brightness; return b > 0.9 && b < 1.1 })
  chal('c4', 'Run a 3-phase motor', 'Connect the motor to the source through the breaker. It must run at its rated voltage.', 'Three line conductors: L1, L2 and L3 go from the source, through the breaker, to T1, T2 and T3.', 'A 3-phase motor needs all three lines.',
    function () { return mk([P('src3', 'V1', 0, 0, 0), P('brk', 'CB1', -20, 180, 0, { amps: 15, poles: 3 }), P('motor3', 'M1', -20, 340, 0, { volts: 480, fla: 7.6 })], []) },
    function (r) { return comp(r, 'M1').running && comp(r, 'CB1').i > 1 })
  chal('c5', 'Step the voltage down', 'Use the transformer to power a 120 V lamp from the 480 V source.', 'The 480 V side is the primary (H1, H2). The lamp goes on the secondary (X1, X2).', 'The transformer turns 480 V into 120 V.',
    function () { return mk([P('src3', 'V1', 0, 0, 0), P('xfmr1', 'T1', -40, 220, 0, { vp: 480, vs: 120, kva: 1 }), P('lamp', 'LP1', -40, 400, 0)], []) },
    function (r) { var b = comp(r, 'LP1').brightness; return b > 0.9 && b < 1.1 })
  chal('c6', 'Seal in the starter', 'Add the missing wires so the motor keeps running after you release START. Press START, then let go.', 'The M1 seal-in contact goes in parallel with the START button: one side to the STOP/START junction, the other to the coil.', 'This is the seal-in (holding) circuit: the contactor holds itself in through its own contact.',
    function () { var m = EX.filter(function (e) { return e.id === 'starter' })[0].build(); m.wires = m.wires.filter(function (w) { return !((w.a === 'PB1.b' && w.b === 'K1a.a') || (w.a === 'K1a.b' && w.b === 'K1c.A1')) }); return m },
    function (r, M, sim) { return comp(r, 'K1c').energized && !sim.state('PB2').pressed && comp(r, 'M1').running })
  chal('c7', 'Stop the nuisance trip', 'This motor draws more than the overload relay allows, so it trips. Set the overload relay to the right size for the motor and keep it running.', 'Select the overload relay and set its rating to the motor’s full-load amps (12 A). Press START.', 'Overloads are set from the motor nameplate, not guessed.',
    function () { var m = EX.filter(function (e) { return e.id === 'starter' })[0].build(); m.comps.forEach(function (c) { if (c.id === 'M1') c.props.fla = 12; if (c.id === 'CB1') c.props.amps = 30 }); return m },
    function (r, M, sim) { return comp(r, 'M1').running && comp(r, 'M1').i > 10 && sim.time > 4 })
  chal('c8', 'Delta-wye to 208 V', 'Feed the 208 V motor from the 480 V source through the transformer. Remember the neutral ground.', 'Source lines to H1 H2 H3, then X1 X2 X3 to the motor. Add X0 to the ground symbol.', 'A delta-wye bank is how 480 V becomes 208Y/120 V.',
    function () { return mk([P('src3', 'V1', 0, 0, 0), P('brk', 'CB1', -20, 170, 0, { amps: 30, poles: 3 }), P('xfmr3', 'T1', -20, 330, 0, { conn: 'dy', vp: 480, vs: 208, kva: 15 }), P('motor3', 'M1', -20, 500, 0, { volts: 208, fla: 20 }), P('gnd', 'G1', 160, 400, 3)], []) },
    function (r) { return comp(r, 'M1').running && Math.abs(comp(r, 'M1').v - 208) < 12 })

  root.LabEx = { examples: EX, challenges: CH, P: P, W: W, mk: mk }
})(typeof self !== 'undefined' ? self : this)
