const S = require('../sim-core.js')
let pass = 0, fail = 0
function ok(c, m, extra) { if (c) pass++; else { fail++; console.log('FAIL', m, extra === undefined ? '' : extra) } }
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, m + ' (got ' + a + ', want ' + b + '±' + tol + ')')
function mk(comps, wires) {
  const cs = comps.map(c => Object.assign({ props: {} }, c))
  const ws = wires.map((w, i) => { const [a, b] = w.split('~'); return { id: 'w' + i, a, b } })
  return S.create({ comps: cs, wires: ws })
}
function run(sim, secs, dt) { dt = dt || 0.05; let r; for (let t = 0; t < secs; t += dt) r = sim.step(dt); return r }
const evs = r => r.events.map(e => e.type)
const allEv = sim => sim.events.map(e => e.type)

// 1. lamp on 120 V : 60 W -> 0.5 A, full brightness
{ const s = mk([{ id: 's', type: 'src1' }, { id: 'sw', type: 'sw', props: { on: true } }, { id: 'l', type: 'lamp' }], ['s.L~sw.a', 'sw.b~l.a', 'l.b~s.N'])
  const r = run(s, 1); near(r.comp.l.i, 0.5, 0.01, 'lamp current'); near(r.comp.l.v, 120, 0.5, 'lamp volts'); near(r.comp.l.brightness, 1, 0.02, 'lamp full'); near(r.wire.w0.i, 0.5, 0.01, 'wire current') }
// 2. switch off -> no current
{ const s = mk([{ id: 's', type: 'src1' }, { id: 'sw', type: 'sw', props: { on: false } }, { id: 'l', type: 'lamp' }], ['s.L~sw.a', 'sw.b~l.a', 'l.b~s.N'])
  const r = run(s, 1); near(r.comp.l.i, 0, 0.001, 'lamp off') }
// 3. lamp across 240 burns out fast
{ const s = mk([{ id: 's', type: 'src2' }, { id: 'l', type: 'lamp' }], ['s.L1~l.a', 'l.b~s.L2'])
  const r = run(s, 1); ok(allEv(s).includes('burn'), 'lamp burns on 240'); ok(r.comp.l.status === 'burnt', 'lamp status burnt') }
// 4. 240 heater on 240 works ~18.75A
{ const s = mk([{ id: 's', type: 'src2' }, { id: 'h', type: 'heater' }], ['s.L1~h.a', 'h.b~s.L2'])
  const r = run(s, 0.5); near(r.comp.h.i, 18.75, 0.1, 'heater amps'); near(r.comp.h.v, 240, 1, 'heater volts') }
// 5. dead short with no protection explodes
{ const s = mk([{ id: 's', type: 'src1' }], ['s.L~s.N'])
  const r = run(s, 0.2); ok(allEv(s).includes('explode'), 'dead short explodes', allEv(s)) }
// 6. dead short with breaker -> clears, no explosion
{ const s = mk([{ id: 's', type: 'src1' }, { id: 'b', type: 'brk' }], ['s.L~b.in1', 'b.out1~s.N'])
  const r = run(s, 0.5); ok(allEv(s).includes('fault') && !allEv(s).includes('explode'), 'breaker clears short', allEv(s)); ok(r.comp.b.status === 'tripped', 'breaker tripped') }
// 7. overloaded breaker trips on time (3 A load... use heater 240 on 15A fuse?)
{ const s = mk([{ id: 's', type: 'src1' }, { id: 'b', type: 'brk', props: { amps: 10 } }, { id: 'h', type: 'heater', props: { volts: 120, watts: 1800 } }], ['s.L~b.in1', 'b.out1~h.a', 'h.b~s.N'])
  run(s, 1); ok(!allEv(s).includes('trip'), 'no instant trip at 15A on 10A'); run(s, 15); ok(allEv(s).includes('trip'), 'inverse-time trip') }
// 8. fuse blows on moderate overload, not on slight
{ const s = mk([{ id: 's', type: 'src1' }, { id: 'f', type: 'fuse', props: { amps: 15 } }, { id: 'h', type: 'heater', props: { volts: 120, watts: 1800 } }], ['s.L~f.a', 'f.b~h.a', 'h.b~s.N'])
  run(s, 3); ok(!allEv(s).includes('blow'), 'fuse ok at 100%') }
{ const s = mk([{ id: 's', type: 'src1' }, { id: 'f', type: 'fuse', props: { amps: 10 } }, { id: 'h', type: 'heater', props: { volts: 120, watts: 2400 } }], ['s.L~f.a', 'f.b~h.a', 'h.b~s.N'])
  run(s, 8); ok(allEv(s).includes('blow'), 'fuse blows at 20A on 10A') }
// 9. voltage divider via transformer 480:120
{ const s = mk([{ id: 's', type: 'src3' }, { id: 't', type: 'xfmr1', props: { vp: 480, vs: 120, kva: 5 } }, { id: 'l', type: 'lamp' }], ['s.L1~t.H1', 's.L2~t.H2', 't.X1~l.a', 'l.b~t.X2'])
  const r = run(s, 0.5); near(r.comp.l.v, 120, 2.5, 'xfmr 480:120 secondary'); near(r.comp.l.brightness, 1, 0.06, 'lamp bright on xfmr') }
// 10. xfmr 480 -> lamp rated 120 but xfmr wired to 240 gives half
{ const s = mk([{ id: 's', type: 'src2' }, { id: 't', type: 'xfmr1', props: { vp: 480, vs: 120, kva: 5 } }, { id: 'l', type: 'lamp' }], ['s.L1~t.H1', 's.L2~t.H2', 't.X1~l.a', 'l.b~t.X2'])
  const r = run(s, 0.5); near(r.comp.l.v, 60, 2, 'half voltage out') }
// 11. center tapped 240/120
{ const s = mk([{ id: 's', type: 'src3', props: { vll: 480 } }, { id: 't', type: 'xfmr1', props: { vp: 480, vs: 240, kva: 5, ct: true } }, { id: 'l1', type: 'lamp' }, { id: 'l2', type: 'lamp' }, { id: 'g', type: 'gnd' }],
  ['s.L1~t.H1', 's.L2~t.H2', 't.X1~l1.a', 'l1.b~t.X0', 't.X0~l2.b', 'l2.a~t.X2', 't.X0~g.g'])
  const r = run(s, 0.5); near(r.comp.l1.v, 120, 3, 'CT leg 1'); near(r.comp.l2.v, 120, 3, 'CT leg 2') }
// 12. 3-phase motor
{ const s = mk([{ id: 's', type: 'src3' }, { id: 'm', type: 'motor3', props: { volts: 480, fla: 7.6 } }], ['s.L1~m.T1', 's.L2~m.T2', 's.L3~m.T3'])
  const r = run(s, 1); near(r.comp.m.i, 7.6, 0.2, 'motor FLA'); ok(r.comp.m.running, 'motor running'); ok(r.comp.m.dir === 1, 'forward rotation') }
// 13. swapped phases reverse
{ const s = mk([{ id: 's', type: 'src3' }, { id: 'm', type: 'motor3' }], ['s.L1~m.T1', 's.L2~m.T3', 's.L3~m.T2'])
  const r = run(s, 1); ok(r.comp.m.dir === -1, 'reverse rotation') }
// 14. motor wrong voltage (480V motor on 208V) stalls and burns/overload
{ const s = mk([{ id: 's', type: 'src3', props: { vll: 208 } }, { id: 'm', type: 'motor3', props: { volts: 480 } }], ['s.L1~m.T1', 's.L2~m.T2', 's.L3~m.T3'])
  const r = run(s, 5); ok(!r.comp.m.running || r.comp.m.status === 'burnt', 'undervolt motor not running'); ok(allEv(s).includes('burn'), 'undervolt motor burns without protection', allEv(s)) }
// 15. 230V motor on 480 burns fast
{ const s = mk([{ id: 's', type: 'src3', props: { vll: 480 } }, { id: 'm', type: 'motor3', props: { volts: 230, fla: 15 } }], ['s.L1~m.T1', 's.L2~m.T2', 's.L3~m.T3'])
  run(s, 6); ok(allEv(s).includes('burn'), 'overvolt motor burns') }
// 16. single-phasing: open one leg
{ const s = mk([{ id: 's', type: 'src3' }, { id: 'm', type: 'motor3' }], ['s.L1~m.T1', 's.L2~m.T2'])
  const r = run(s, 1); ok(r.comp.m.singlePhase, 'single phasing detected'); run(s, 8); ok(allEv(s).includes('burn'), 'single-phased motor eventually burns') }
// 17. start-stop motor starter (seal-in)
function starter() {
  return mk([
    { id: 's', type: 'src3' }, { id: 'b', type: 'brk', props: { amps: 20, poles: 3 } },
    { id: 'k', type: 'cpoles', props: { tag: 'M1', poles: 3 } }, { id: 'ol', type: 'ol', props: { amps: 8 } }, { id: 'm', type: 'motor3', props: { volts: 480, fla: 7.6 } },
    { id: 'x', type: 'xfmr1', props: { vp: 480, vs: 120, kva: 0.25 } }, { id: 'g', type: 'gnd' },
    { id: 'stop', type: 'pbnc' }, { id: 'start', type: 'pbno' }, { id: 'seal', type: 'cnt', props: { tag: 'M1', form: 'NO' } }, { id: 'coil', type: 'coil', props: { tag: 'M1', volts: 120 } }
  ], ['s.L1~b.in1', 's.L2~b.in2', 's.L3~b.in3', 'b.out1~k.L1', 'b.out2~k.L2', 'b.out3~k.L3', 'k.T1~ol.L1', 'k.T2~ol.L2', 'k.T3~ol.L3', 'ol.T1~m.T1', 'ol.T2~m.T2', 'ol.T3~m.T3',
    's.L1~x.H1', 's.L2~x.H2', 'x.X2~g.g',
    'x.X1~stop.a', 'stop.b~start.a', 'start.b~coil.A1', 'stop.b~seal.a', 'seal.b~coil.A1', 'coil.A2~ol.95', 'ol.96~x.X2'])
}
{ const s = starter(); let r = run(s, 0.5); ok(!r.comp.coil.energized, 'starter idle'); near(r.comp.m.i, 0, 0.01, 'motor stopped')
  s.press('start', true); r = run(s, 0.3); ok(r.comp.coil.energized, 'coil energized on start'); s.press('start', false); r = run(s, 1.5); ok(r.comp.coil.energized, 'seal-in holds'); ok(r.comp.m.running, 'motor runs'); near(r.comp.m.i, 7.6, 0.3, 'run current')
  s.press('stop', true); r = run(s, 0.3); ok(!r.comp.coil.energized, 'stop drops coil'); s.press('stop', false); r = run(s, 0.5); ok(!r.comp.coil.energized, 'stays off after stop released'); near(r.comp.m.i, 0, 0.01, 'motor off') }
// 18. overload trips the starter and drops it out
{ const s = starter(); s.circuit.comps.find(c => c.id === 'm').props.fla = 10.5  // overloaded vs relay setting 8A ... run current 10.5 => 131%
  s.press('start', true); run(s, 0.3); s.press('start', false); run(s, 40); ok(allEv(s).includes('oltrip'), 'overload relay trips', allEv(s)); const r = run(s, 0.5); ok(!r.comp.coil.energized, 'contactor drops on OL trip') }
// 19. 3-way switch truth table
{ const mk3 = (p1, p2) => mk([{ id: 's', type: 'src1' }, { id: 'a', type: 'sw2', props: { pos: p1 } }, { id: 'b', type: 'sw2', props: { pos: p2 } }, { id: 'l', type: 'lamp' }],
    ['s.L~a.c', 'a.t1~b.t1', 'a.t2~b.t2', 'b.c~l.a', 'l.b~s.N'])
  ;[[1, 1, true], [1, 2, false], [2, 1, false], [2, 2, true]].forEach(([p1, p2, on]) => { const r = run(mk3(p1, p2), 0.5); ok((r.comp.l.i > 0.4) === on, '3-way ' + p1 + p2) }) }
// 20. timer on-delay
{ const s = mk([{ id: 's', type: 'src1' }, { id: 'sw', type: 'sw', props: { on: true } }, { id: 'c', type: 'coil', props: { tag: 'T1', kind: 'timer', mode: 'on', delay: 2 } }, { id: 't', type: 'cnt', props: { tag: 'T1', form: 'NOTD' } }, { id: 'l', type: 'lamp' }],
  ['s.L~sw.a', 'sw.b~c.A1', 'c.A2~s.N', 's.L~t.a', 't.b~l.a', 'l.b~s.N'])
  let r = run(s, 1); near(r.comp.l.i, 0, 0.01, 'timer not yet'); r = run(s, 1.5); near(r.comp.l.i, 0.5, 0.02, 'timer done lamp on') }
// 21. gmin: floating things do not NaN
{ const s = mk([{ id: 'x', type: 'xfmr3', props: { conn: 'dy' } }], []); const r = run(s, 0.1); ok(!Object.values(r.comp).some(c => Number.isNaN(c.i)), 'no NaN') }
// 22. delta-wye transformer 480 -> 208 and load balance
{ const s = mk([{ id: 's', type: 'src3', props: { vll: 480 } }, { id: 't', type: 'xfmr3', props: { conn: 'dy', vp: 480, vs: 208, kva: 45 } }, { id: 'm', type: 'motor3', props: { volts: 208, fla: 10 } }, { id: 'g', type: 'gnd' }],
  ['s.L1~t.H1', 's.L2~t.H2', 's.L3~t.H3', 't.X1~m.T1', 't.X2~m.T2', 't.X3~m.T3', 't.X0~g.g'])
  const r = run(s, 1); near(r.comp.m.v, 208, 5, 'Δ-Y secondary line voltage'); near(r.comp.m.i, 10, 0.6, 'Δ-Y motor current'); ok(r.comp.m.running, 'motor runs on Δ-Y') }
// 23. Y-Y and Δ-Δ
{ ['yy', 'dd', 'yd'].forEach(cn => { const s = mk([{ id: 's', type: 'src3', props: { vll: 480 } }, { id: 't', type: 'xfmr3', props: { conn: cn, vp: 480, vs: 240, kva: 45 } }, { id: 'm', type: 'motor3', props: { volts: 240, fla: 10 } }],
  ['s.L1~t.H1', 's.L2~t.H2', 's.L3~t.H3', 't.X1~m.T1', 't.X2~m.T2', 't.X3~m.T3'].concat(cn[0] === 'y' ? [] : []))
  const r = run(s, 1); near(r.comp.m.v, 240, 6, cn + ' voltage') }) }
// 24. transformer secondary short: breaker on primary clears it (20x rated)
{ const s = mk([{ id: 's', type: 'src3', props: { vll: 480 } }, { id: 'b', type: 'brk', props: { amps: 15, poles: 2 } }, { id: 't', type: 'xfmr1', props: { vp: 480, vs: 120, kva: 5 } }],
  ['s.L1~b.in1', 's.L2~b.in2', 'b.out1~t.H1', 'b.out2~t.H2', 't.X1~t.X2'])
  run(s, 0.3); ok(allEv(s).some(e => e === 'trip' || e === 'fault'), 'secondary short trips primary breaker', allEv(s)); ok(!allEv(s).includes('explode'), 'no explosion') }
// 25. meters
{ const s = mk([{ id: 's', type: 'src1' }, { id: 'a', type: 'am' }, { id: 'l', type: 'lamp' }, { id: 'v', type: 'vm' }], ['s.L~a.a', 'a.b~l.a', 'l.b~s.N', 'v.a~l.a', 'v.b~l.b'])
  const r = run(s, 0.3); near(r.comp.a.reading, 0.5, 0.01, 'ammeter'); near(r.comp.v.reading, 120, 0.5, 'voltmeter') }
// 26. relay chatter does not hang (NC contact in own coil circuit)
{ const s = mk([{ id: 's', type: 'src1' }, { id: 'n', type: 'cnt', props: { tag: 'B', form: 'NC' } }, { id: 'c', type: 'coil', props: { tag: 'B' } }], ['s.L~n.a', 'n.b~c.A1', 'c.A2~s.N']); const r = run(s, 0.5); ok(r !== undefined, 'chatter circuit steps') }
// 27. neutral wire carries current in wire flows
{ const s = mk([{ id: 's', type: 'src1' }, { id: 'l', type: 'lamp' }], ['s.L~l.a', 'l.b~s.N']); const r = run(s, 0.2); near(r.wire.w1.i, 0.5, 0.01, 'neutral wire current') }
// 28. ground fault: hot to gnd symbol trips breaker
{ const s = mk([{ id: 's', type: 'src1' }, { id: 'b', type: 'brk' }, { id: 'g', type: 'gnd' }], ['s.L~b.in1', 'b.out1~g.g']); run(s, 0.3); ok(allEv(s).includes('fault'), 'ground fault trips') }

// forward/reverse starter example: direction flips, interlock blocks the other contactor
{ const E = require('../lab-examples.js').LabEx, ex = E.examples.find(x => x.id === 'fwdrev'); ok(!!ex, 'fwdrev example exists')
  const s = S.create(ex.build()); let r = run(s, 0.5)
  s.press('PB2', true); run(s, 0.4); s.press('PB2', false); r = run(s, 1.5); ok(r.comp.M1.running && r.comp.M1.dir === 1, 'forward runs forward')
  s.press('PB1', true); run(s, 0.4); s.press('PB1', false); r = run(s, 0.5); ok(!r.comp.M1.running, 'stop stops')
  s.press('PB3', true); run(s, 0.4); s.press('PB3', false); r = run(s, 1.5); ok(r.comp.M1.running && r.comp.M1.dir === -1, 'reverse runs reversed')
  s.press('PB2', true); run(s, 0.5); s.press('PB2', false); r = run(s, 0.5); ok(!r.comp.KFc.energized && r.comp.KRc.energized, 'interlock keeps forward contactor out while reverse runs') }
console.log('sim tests: pass', pass, 'fail', fail)
process.exit(fail ? 1 : 0)
