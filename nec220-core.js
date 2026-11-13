/* VoltCE NEC 220 dwelling load calculator: pure logic (no DOM).
   Teaching model of NEC 2023 Article 220, Part III (standard method) and 220.82 (optional method).
   Learning tool, not a code-compliance determination: always verify with the adopted NEC and the AHJ. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Nec220 = factory() })(typeof self !== 'undefined' ? self : this, function () {
  'use strict'
  var STD_SIZES = [100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800]   // NEC 240.6(A)
  var RANGE_C = [0, 8000, 11000, 14000, 17000, 20000, 21000, 22000, 23000, 24000, 25000, 26000, 27000, 28000, 29000, 30000, 31000, 32000, 33000, 34000, 35000, 36000, 37000, 38000, 39000, 40000]   // Table 220.55 Col. C, 1-25 ranges
  function r(n) { return Math.round(n * 100) / 100 }
  function num(v) { v = parseFloat(v); return isFinite(v) && v > 0 ? v : 0 }

  function dryerFactor(n) {                                    // Table 220.54
    if (n <= 0) return 0
    if (n <= 4) return 1
    var t = { 5: .85, 6: .75, 7: .65, 8: .60, 9: .55, 10: .50, 11: .47 }
    if (t[n]) return t[n]
    if (n <= 23) return (47 - (n - 11)) / 100
    if (n <= 42) return (35 - 0.5 * (n - 23)) / 100
    return .25
  }
  function rangeDemand(n, kw) {                                // Table 220.55 Col. C (+ Note 1), ranges of equal rating <= 12 kW or 12-27 kW
    if (n <= 0) return 0
    if (n > 25) return null
    var base = RANGE_C[n]
    if (kw > 12) { var add = Math.floor(kw - 12 + 0.5); base = base * (1 + 0.05 * add) }   // +5% per kW (major fraction) over 12 kW
    return base
  }
  function nextSize(a) { for (var i = 0; i < STD_SIZES.length; i++) if (STD_SIZES[i] >= a) return STD_SIZES[i]; return null }

  // inputs: sqft, smallApp (circuits, min 2), laundry (bool), ranges {n, kw}, dryers {n, kw}, fixed [{name, va}], heat (VA), ac (VA), motor (VA largest, 25%), evse {n, va}, heatUnits (separately controlled), volts (240)
  function calc(inp) {
    var s = { method: 'standard', lines: [], notes: [] }, L = s.lines
    function line(label, va, ref, note, sub) { L.push({ label: label, va: r(va), ref: ref, note: note || '', sub: !!sub }) }
    var sqft = num(inp.sqft), sa = Math.max(2, Math.floor(num(inp.smallApp) || 2)), laundry = inp.laundry !== false
    var volts = num(inp.volts) || 240
    var rn = Math.floor(num(inp.rangeN)), rkw = num(inp.rangeKw) || 12
    var dn = Math.floor(num(inp.dryerN)), dkw = num(inp.dryerKw) || 5
    var fixed = (inp.fixed || []).map(function (f) { return { name: f.name || 'Appliance', va: num(f.va) } }).filter(function (f) { return f.va > 0 })
    var heat = num(inp.heat), ac = num(inp.ac), motor = num(inp.motor)
    var en = Math.floor(num(inp.evseN)), eva = num(inp.evseVa)
    var heatUnits = Math.floor(num(inp.heatUnits)) || 1
    var optional = inp.method === 'optional'

    var gen = sqft * 3, smallVA = sa * 1500, lndVA = laundry ? 1500 : 0
    var ev = en * Math.max(7200, eva)                               // 220.57
    if (!optional) {
      s.method = 'standard'
      line('General lighting and receptacles: ' + sqft + ' sq ft x 3 VA', gen, '220.12, Table 220.12', '', true)
      line('Small-appliance circuits: ' + sa + ' x 1,500 VA', smallVA, '220.52(A)', '', true)
      if (laundry) line('Laundry circuit: 1 x 1,500 VA', lndVA, '220.52(B)', '', true)
      var sub = gen + smallVA + lndVA
      var dem = sub <= 3000 ? sub : sub <= 120000 ? 3000 + (sub - 3000) * .35 : 3000 + 117000 * .35 + (sub - 120000) * .25
      line('Demand on the three items above (first 3,000 VA at 100%, the rest to 120,000 VA at 35%)', dem, 'Table 220.42', 'Total before demand: ' + r(sub) + ' VA')
      var fsum = fixed.reduce(function (a, f) { return a + f.va }, 0)
      if (fixed.length) {
        var ff = fixed.length >= 4 ? .75 : 1
        line('Fixed appliances (' + fixed.length + '): ' + r(fsum) + ' VA at ' + (ff * 100) + '%', fsum * ff, '220.53', fixed.length >= 4 ? '4 or more fastened-in-place appliances: 75%' : 'Fewer than 4: no demand factor')
      }
      if (dn > 0) { var dv = Math.max(5000, dkw * 1000) * dn; var df = dryerFactor(dn); line('Dryers: ' + dn + ' x ' + r(Math.max(5000, dkw * 1000)) + ' VA at ' + r(df * 100) + '%', dv * df, '220.54, Table 220.54', 'Larger of 5,000 VA or nameplate') }
      if (rn > 0) { var rd = rangeDemand(rn, rkw); if (rd == null) s.notes.push('More than 25 ranges: use Table 220.55 directly.'); else line('Cooking: ' + rn + ' range' + (rn > 1 ? 's' : '') + ' at ' + rkw + ' kW', rd, '220.55, Table 220.55 Col. C' + (rkw > 12 ? ' + Note 1' : '')) }
      var hv = Math.max(heat, ac)
      if (hv > 0) line('Heating or air conditioning, whichever is larger (not both): ' + (heat >= ac ? 'heating' : 'A/C'), hv, '220.60', 'Noncoincident loads: only the larger counts')
      if (ev > 0) line('EV charging: ' + en + ' x ' + r(Math.max(7200, eva)) + ' VA', ev, '220.57', 'Larger of 7,200 VA or nameplate, per EVSE')
      if (motor > 0) line('Largest motor: 25% of ' + r(motor) + ' VA', motor * .25, '220.50 / 430.24', 'Add 25% of the largest motor on top of its own demand already counted')
    } else {
      s.method = 'optional'
      var gl = gen + smallVA + lndVA
      line('General loads: lighting ' + r(gen) + ' + small-appliance ' + r(smallVA) + (laundry ? ' + laundry 1,500' : ''), gl, '220.82(B)(1)-(2)', '', true)
      var nameplate = fixed.reduce(function (a, f) { return a + f.va }, 0) + (rn > 0 ? rn * rkw * 1000 : 0) + (dn > 0 ? dn * dkw * 1000 : 0) + motor + ev
      if (nameplate > 0) line('Nameplate ratings of ranges, dryers, fixed appliances, motors and EV chargers', nameplate, '220.82(B)(3)-(4)', 'Listed at nameplate, with no 220.53/220.54/220.55 factors', true)
      var tot = gl + nameplate
      var dem2 = tot <= 10000 ? tot : 10000 + (tot - 10000) * .4
      line('Demand on the above (first 10,000 VA at 100%, the rest at 40%)', dem2, '220.82(B)', 'Total before demand: ' + r(tot) + ' VA')
      var hv2 = heat * (heatUnits >= 4 ? .4 : .65), acv = ac
      var pick = Math.max(hv2, acv)
      if (pick > 0) line('Heating or A/C, whichever is larger: ' + (hv2 >= acv ? 'electric heat at ' + (heatUnits >= 4 ? '40%' : '65%') : 'A/C at 100%'), pick, '220.82(C)', heatUnits >= 4 ? '4 or more separately controlled heat units: 40%' : 'Fewer than 4 separately controlled heat units: 65%')
    }
    var total = L.reduce(function (a, x) { return a + (x.sub ? 0 : x.va) }, 0)
    s.totalVA = r(total); s.volts = volts; s.amps = r(total / volts); s.service = nextSize(total / volts)
    if (!optional) s.notes.push('Standard method, 220.40 to 220.61.')
    if (optional) s.notes.push('Optional method 220.82 applies to a dwelling with a 120/240 V (or 208Y/120 V) single-phase service of 100 A or more.')
    s.notes.push('Service size is the next standard size from 240.6(A) at or above the calculated amps. Wire size and the dwelling-service conductor rule in 310.12 are separate steps.')
    return s
  }
  return { calc: calc, dryerFactor: dryerFactor, rangeDemand: rangeDemand, nextSize: nextSize, STD_SIZES: STD_SIZES }
})
