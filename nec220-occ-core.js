/* VoltCE NEC 220 load calculation lab, non-dwelling occupancies and multi-family (pure logic).
   Teaching model of NEC 2023 Article 220 Parts II, III and IV. Learning tool, not a code-compliance determination:
   verify every table against the adopted NEC and the AHJ. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Nec220Occ = factory() })(typeof self !== 'undefined' ? self : this, function () {
  'use strict'
  var STD = [100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000]   // NEC 240.6(A)
  // Table 220.12 general lighting VA per sq ft, and Table 220.42 demand type
  var OCC = {
    office: { name: 'Office building', va: 3.5, dem: 'none' },
    bank: { name: 'Bank', va: 3.5, dem: 'none' },
    store: { name: 'Store / retail', va: 3, dem: 'none' },
    school: { name: 'School', va: 3, dem: 'none' },
    restaurant: { name: 'Restaurant', va: 2, dem: 'none' },
    hospital: { name: 'Hospital', va: 2, dem: 'hospital' },
    hotel: { name: 'Hotel / motel', va: 2, dem: 'hotel' },
    warehouse: { name: 'Warehouse (storage)', va: 0.25, dem: 'warehouse' },
    church: { name: 'Church', va: 1, dem: 'none' },
    industrial: { name: 'Industrial / commercial loft', va: 2, dem: 'none' },
    garage: { name: 'Commercial garage (storage)', va: 0.5, dem: 'none' }
  }
  var SYS = { '208Y': { name: '208Y/120 V three-phase', v: 208, ph: 3 }, '480Y': { name: '480Y/277 V three-phase', v: 480, ph: 3 }, '240-3': { name: '240 V three-phase', v: 240, ph: 3 }, '240-1': { name: '120/240 V single-phase', v: 240, ph: 1 } }
  function r(n) { return Math.round(n * 100) / 100 }
  function num(v) { v = parseFloat(v); return isFinite(v) && v > 0 ? v : 0 }
  function nextSize(a) { for (var i = 0; i < STD.length; i++) if (STD[i] >= a) return STD[i]; return null }
  function amps(va, sys) { var s = SYS[sys] || SYS['208Y']; return va / (s.ph === 3 ? s.v * Math.sqrt(3) : s.v) }

  function lightingDemand(type, va) {                          // Table 220.42
    if (type === 'hospital') return va <= 50000 ? va * .4 : 20000 + (va - 50000) * .2
    if (type === 'hotel') return va <= 20000 ? va * .5 : va <= 100000 ? 10000 + (va - 20000) * .4 : 10000 + 32000 + (va - 100000) * .3
    if (type === 'warehouse') return va <= 12500 ? va : 12500 + (va - 12500) * .5
    return va
  }
  function receptDemand(va) { return va <= 10000 ? va : 10000 + (va - 10000) * .5 }   // Table 220.44
  function kitchenFactor(n) { return n <= 2 ? 1 : n === 3 ? .9 : n === 4 ? .8 : n === 5 ? .7 : .65 }   // Table 220.56
  function mfFactor(n) {                                        // Table 220.84 (3 or more dwelling units)
    var t = [[5, .45], [7, .44], [10, .43], [11, .42], [13, .41], [15, .40], [17, .39], [20, .38], [21, .37], [23, .36], [25, .35], [27, .34], [30, .33], [31, .32], [33, .31], [36, .30], [38, .29], [42, .28], [45, .27], [50, .26], [55, .25], [61, .24]]
    for (var i = 0; i < t.length; i++) if (n <= t[i][0]) return t[i][1]
    return .23
  }

  // inp: occ, sys, sqft, recepts (outlets, 180 VA each), multiFt (multioutlet ft, 180 VA per 5 ft), windowFt (200 VA/ft), trackFt (150 VA per 2 ft), signs (1200 VA each),
  //      heat, cool (VA), motors [{name,va}] at 100%, largestMotor (VA, +25%), kitchen [VA...], other [{name,va}] at 100%, continuous (default true)
  function calcOcc(inp) {
    var o = OCC[inp.occ] || OCC.office, s = { kind: 'occupancy', occ: o.name, lines: [], notes: [] }, L = s.lines
    function line(label, va, ref, note, sub) { L.push({ label: label, va: r(va), ref: ref, note: note || '', sub: !!sub }) }
    var cont = inp.continuous !== false, k = cont ? 1.25 : 1, kTxt = cont ? ' x 125% continuous' : ''
    var sqft = num(inp.sqft), sys = inp.sys || '208Y'
    var gen = sqft * o.va
    line('General lighting: ' + sqft + ' sq ft x ' + o.va + ' VA (' + o.name + ')', gen, '220.12, Table 220.12', '', true)
    var gd = lightingDemand(o.dem, gen)
    line('General lighting after demand factor' + kTxt, gd * k, o.dem === 'none' ? '220.12, 215.2(A)(1)' : 'Table 220.42', o.dem === 'none' ? 'No demand factor for this occupancy. Continuous loads are counted at 125%.' : 'Demand: ' + r(gd) + ' VA' + (cont ? ', then x 125% for continuous operation' : ''))
    var rec = num(inp.recepts) * 180 + Math.ceil(num(inp.multiFt) / 5) * 180
    if (rec > 0) { line('General-use receptacles: ' + num(inp.recepts) + ' outlets x 180 VA' + (num(inp.multiFt) ? ' + ' + num(inp.multiFt) + ' ft multioutlet (180 VA per 5 ft)' : ''), rec, '220.14(I), 220.44', '', true); line('Receptacle load after demand (first 10,000 VA at 100%, rest at 50%)', receptDemand(rec), 'Table 220.44') }
    var win = num(inp.windowFt) * 200, trk = Math.ceil(num(inp.trackFt) / 2) * 150, sg = num(inp.signs) * 1200
    if (win) line('Show-window lighting: ' + num(inp.windowFt) + ' ft x 200 VA' + kTxt, win * k, '220.14(G)')
    if (trk) line('Track lighting: ' + num(inp.trackFt) + ' ft, 150 VA per 2 ft' + kTxt, trk * k, '220.43(B)')
    if (sg) line('Sign and outline lighting: ' + num(inp.signs) + ' x 1,200 VA' + kTxt, sg * k, '220.14(F), 600.5')
    var kit = (inp.kitchen || []).map(num).filter(function (x) { return x > 0 }).sort(function (a, b) { return b - a })
    if (kit.length) { var ksum = kit.reduce(function (a, b) { return a + b }, 0), kd = Math.max(ksum * kitchenFactor(kit.length), kit[0] + (kit[1] || 0)); line('Commercial kitchen equipment: ' + kit.length + ' unit' + (kit.length > 1 ? 's' : '') + ' at ' + Math.round(kitchenFactor(kit.length) * 100) + '%', kd, 'Table 220.56', 'Never less than the two largest units: ' + r(kit[0] + (kit[1] || 0)) + ' VA. Total connected ' + r(ksum) + ' VA.') }
    var hv = Math.max(num(inp.heat), num(inp.cool)); if (hv > 0) line('Heating or cooling, whichever is larger (not both): ' + (num(inp.heat) >= num(inp.cool) ? 'heating' : 'cooling'), hv, '220.60', 'Noncoincident loads')
    var ms = (inp.motors || []).reduce(function (a, m) { return a + num(m.va) }, 0); if (ms > 0) line('Other motors at 100%', ms, '220.50, 430.24')
    var lm = num(inp.largestMotor); if (lm > 0) line('Largest motor: 25% of ' + r(lm) + ' VA', lm * .25, '430.24', 'The motor itself is counted above, this is the extra 25%.')
    var ot = (inp.other || []).reduce(function (a, m) { return a + num(m.va) }, 0); if (ot > 0) line('Other connected loads at 100%', ot, '220.40')
    s.totalVA = r(L.reduce(function (a, x) { return a + (x.sub ? 0 : x.va) }, 0)); s.sys = SYS[sys] ? sys : '208Y'; s.sysName = SYS[s.sys].name
    s.amps = r(amps(s.totalVA, s.sys)); s.service = nextSize(s.amps)
    if (o.dem !== 'none') s.notes.push('Table 220.42 demand factors apply to the lighting of this occupancy.')
    s.notes.push('Verify Table 220.12 and the other tables against your code book and the energy-code exception in 220.12.')
    return s
  }

  // inp: units, unitSqft, laundry (true if a laundry circuit in each unit), appliances [{name,va}] per unit at nameplate, heat, cool (VA per unit), houseVA, sys
  function calcMF(inp) {
    var s = { kind: 'multifamily', occ: 'Multi-family (optional method)', lines: [], notes: [] }, L = s.lines
    function line(label, va, ref, note, sub) { L.push({ label: label, va: r(va), ref: ref, note: note || '', sub: !!sub }) }
    var n = Math.floor(num(inp.units)), sys = inp.sys || '208Y'
    if (n < 3) { s.error = 'The optional multi-family method (220.84) needs three or more dwelling units. Use the dwelling calculator for fewer.'; s.totalVA = 0; s.amps = 0; s.service = null; return s }
    var sf = num(inp.unitSqft), lnd = inp.laundry !== false ? 1500 : 0
    var ap = (inp.appliances || []).reduce(function (a, x) { return a + num(x.va) }, 0), hv = Math.max(num(inp.heat), num(inp.cool))
    var per = sf * 3 + 3000 + lnd + ap + hv
    line('Each unit: lighting ' + sf + ' sq ft x 3 VA = ' + r(sf * 3) + ', small-appliance 3,000' + (lnd ? ', laundry 1,500' : '') + ', appliances ' + r(ap) + (hv ? ', heat or A/C ' + r(hv) : ''), per, '220.84(C)', 'Appliances at nameplate, larger of heating or cooling.', true)
    line('All ' + n + ' units connected: ' + n + ' x ' + r(per), per * n, '220.84(C)', '', true)
    var f = mfFactor(n)
    line('Demand on the units at ' + Math.round(f * 100) + '% (' + n + ' units)', per * n * f, 'Table 220.84')
    var h = num(inp.houseVA); if (h > 0) line('House loads (corridors, lobby, elevators, pumps) at their own demand', h, '220.84(B)', 'Calculate the house loads separately under Article 220 and enter the result here.')
    s.totalVA = r(L.reduce(function (a, x) { return a + (x.sub ? 0 : x.va) }, 0)); s.sys = SYS[sys] ? sys : '208Y'; s.sysName = SYS[s.sys].name
    s.amps = r(amps(s.totalVA, s.sys)); s.service = nextSize(s.amps)
    s.notes.push('220.84 applies when each unit has electric cooking, is metered, and the building has three or more units.')
    return s
  }
  return { calcOcc: calcOcc, calcMF: calcMF, OCC: OCC, SYS: SYS, nextSize: nextSize, lightingDemand: lightingDemand, receptDemand: receptDemand, kitchenFactor: kitchenFactor, mfFactor: mfFactor }
})
