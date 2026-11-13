/* NEC 220 load calculation lab UI: dwelling, other occupancies, multi-family. Logic in nec220-core.js and nec220-occ-core.js. */
var N220 = (function () {
  var root, st = {
    mode: 'dwelling', method: 'standard', occ: 'office', sys: '208Y',
    fixed: [{ name: 'Dishwasher', va: 1200 }, { name: 'Disposal', va: 900 }, { name: 'Water heater', va: 4500 }, { name: 'Microwave', va: 1500 }],
    kit: [],
    oth: [], mf: [{ name: 'Range', va: 12000 }, { name: 'Water heater', va: 4500 }, { name: 'Dishwasher', va: 1200 }]
  }
  var PRESETS = { office: { sqft: 20000, rec: 100, cool: 60000, lm: 10000 }, bank: { sqft: 8000, rec: 60, cool: 30000, lm: 5000 }, store: { sqft: 12000, rec: 40, cool: 40000, lm: 7500, win: 30, sign: 1 }, school: { sqft: 40000, rec: 150, cool: 120000, lm: 15000 }, restaurant: { sqft: 4000, rec: 30, cool: 25000, lm: 5000, sign: 1 }, hospital: { sqft: 50000, rec: 300, cool: 200000, lm: 25000 }, hotel: { sqft: 60000, rec: 200, cool: 150000, lm: 15000 }, warehouse: { sqft: 100000, rec: 20, cool: 0, lm: 5000 }, church: { sqft: 10000, rec: 25, cool: 40000, lm: 5000 }, industrial: { sqft: 30000, rec: 50, cool: 40000, lm: 10000 }, garage: { sqft: 15000, rec: 20, cool: 0, lm: 3000 } }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] }) }
  function fmt(n) { return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }) }
  function v(id) { var e = root.querySelector('#n2-' + id); return e ? (e.type === 'checkbox' ? e.checked : e.value) : '' }
  function fld(id, label, val, extra) { return '<label class="n2-f"><span>' + label + '</span><input id="n2-' + id + '" type="number" min="0" step="any" value="' + (val == null ? '' : val) + '" ' + (extra || '') + ' oninput="N220.run()"></label>' }
  function list(key, title, hint, addLabel) { return '<div class="n2-card"><h3>' + title + '</h3><div id="n2-l-' + key + '"></div><button class="n2-add" onclick="N220.add(\'' + key + '\')">' + addLabel + '</button><div class="n2-hint">' + hint + '</div></div>' }
  function sysSel() { var S = Nec220Occ.SYS; return '<label class="n2-f"><span>Service voltage</span><select id="n2-sys" onchange="N220.set(\'sys\',this.value)">' + Object.keys(S).map(function (k) { return '<option value="' + k + '"' + (st.sys === k ? ' selected' : '') + '>' + S[k].name + '</option>' }).join('') + '</select></label>' }

  function dwellingForm() {
    return '<div class="n2-tabs" role="tablist"><button role="tab" class="' + (st.method === 'standard' ? 'on' : '') + '" onclick="N220.method(\'standard\')">Standard method (Part III)</button><button role="tab" class="' + (st.method === 'optional' ? 'on' : '') + '" onclick="N220.method(\'optional\')">Optional method (220.82)</button></div>' +
      '<div class="n2-grid"><div class="n2-card"><h3>House</h3>' + fld('sqft', 'Living area, sq ft (outside dimensions, no garage or open porch)', 2000) + fld('sa', 'Small-appliance circuits (2 minimum)', 2) +
      '<label class="n2-f n2-c"><input id="n2-lnd" type="checkbox" checked onchange="N220.run()"> <span>Laundry circuit (1,500 VA)</span></label>' +
      '<h3>Big loads</h3><div class="n2-two">' + fld('rn', 'Ranges', 1) + fld('rkw', 'Range kW each', 12) + fld('dn', 'Dryers', 1) + fld('dkw', 'Dryer kW each (5 kW minimum)', 5) + '</div>' +
      '<h3>Heat, cooling, EV, motor</h3><div class="n2-two">' + fld('heat', 'Electric heat, VA', '') + fld('ac', 'A/C, VA', 4800) + fld('hu', 'Separately controlled heat units', 1) + fld('motor', 'Largest motor, VA (25% added)', '') + fld('en', 'EV chargers', 0) + fld('eva', 'EV nameplate VA (7,200 minimum each)', '') + '</div></div>' +
      list('fixed', 'Fixed appliances', 'Count appliances fastened in place, not ranges, dryers, heat or A/C. Four or more get a 75% demand factor in the standard method.', 'Add appliance') + '</div>'
  }
  function occForm() {
    var O = Nec220Occ.OCC, p = PRESETS[st.occ] || PRESETS.office
    return '<div class="n2-grid"><div class="n2-card"><h3>Building</h3><label class="n2-f"><span>Occupancy (Table 220.12)</span><select id="n2-occ" onchange="N220.setOcc(this.value)">' + Object.keys(O).map(function (k) { return '<option value="' + k + '"' + (st.occ === k ? ' selected' : '') + '>' + O[k].name + ' (' + O[k].va + ' VA/sq ft)</option>' }).join('') + '</select></label>' +
      sysSel() + fld('sqft', 'Floor area, sq ft', p.sqft) +
      '<label class="n2-f n2-c"><input id="n2-cont" type="checkbox" checked onchange="N220.run()"> <span>Lighting runs 3 hours or more (continuous, counted at 125%)</span></label>' +
      '<h3>Receptacles and lighting extras</h3><div class="n2-two">' + fld('rec', 'Receptacle outlets (180 VA each)', p.rec) + fld('mo', 'Multioutlet assembly, ft', '') + fld('win', 'Show-window lighting, ft', p.win || '') + fld('trk', 'Track lighting, ft', '') + fld('sign', 'Sign circuits (1,200 VA each)', p.sign || '') + '</div>' +
      '<h3>HVAC and motors</h3><div class="n2-two">' + fld('heat', 'Heating, VA', '') + fld('cool', 'Cooling, VA', p.cool) + fld('lm', 'Largest motor, VA (25% added)', p.lm) + '</div></div>' +
      '<div>' + list('kit', 'Commercial kitchen equipment', 'Table 220.56 factors apply to three or more units. Leave empty if there is no kitchen.', 'Add unit') + '<div style="height:14px"></div>' + list('oth', 'Other connected loads', 'Anything else at 100%: process equipment, elevators, data racks.', 'Add load') + '</div></div>'
  }
  function mfForm() {
    return '<div class="n2-grid"><div class="n2-card"><h3>Building</h3>' + sysSel() + '<div class="n2-two">' + fld('units', 'Dwelling units (3 or more)', 20) + fld('usf', 'Sq ft per unit', 1000) + fld('mheat', 'Heat per unit, VA', '') + fld('mcool', 'A/C per unit, VA', 3600) + '</div>' +
      '<label class="n2-f n2-c"><input id="n2-mlnd" type="checkbox" checked onchange="N220.run()"> <span>Laundry circuit in each unit</span></label>' + fld('house', 'House loads, VA (corridors, lobby, elevators, pumps)', 15000) + '</div>' +
      list('mf', 'Appliances in each unit (nameplate)', 'Range, water heater, dishwasher and similar. Heat and A/C are entered on the left and only the larger counts.', 'Add appliance') + '</div>'
  }
  function render() {
    var tab = function (m, t) { return '<button role="tab" class="' + (st.mode === m ? 'on' : '') + '" onclick="N220.mode(\'' + m + '\')">' + t + '</button>' }
    root.innerHTML =
      '<div class="n2-note"><b>Teaching tool, not a code-compliance determination.</b> It follows NEC 2023 Article 220. Verify every table against your code book, the adopted NEC and your inspector.</div>' +
      '<div class="n2-tabs n2-modes" role="tablist">' + tab('dwelling', 'House (dwelling)') + tab('occ', 'Offices, stores, schools and more') + tab('mf', 'Multi-family building') + '</div>' +
      (st.mode === 'dwelling' ? dwellingForm() : st.mode === 'occ' ? occForm() : mfForm()) + '<div id="n2-out" aria-live="polite"></div>'
    lists(); run()
  }
  var KEYS = { fixed: 'fixed', kit: 'kit', oth: 'oth', mf: 'mf' }
  function lists() {
    Object.keys(KEYS).forEach(function (k) {
      var el = root.querySelector('#n2-l-' + k); if (!el) return
      var h = st[k].map(function (f, i) { return '<div class="n2-fx"><input value="' + esc(f.name) + '" aria-label="Name" oninput="N220.setL(\'' + k + '\',' + i + ',\'name\',this.value)"><input type="number" min="0" value="' + f.va + '" aria-label="VA" oninput="N220.setL(\'' + k + '\',' + i + ',\'va\',this.value)"><span>VA</span><button aria-label="Remove" onclick="N220.del(\'' + k + '\',' + i + ')">×</button></div>' }).join('')
      el.innerHTML = h || '<div class="n2-hint">None added.</div>'
    })
  }
  function result(s) {
    if (s.error) return '<div class="n2-note">' + esc(s.error) + '</div>'
    return '<div class="n2-res"><div class="n2-big"><div>' + fmt(s.totalVA) + ' VA</div><small>calculated load</small></div><div class="n2-big"><div>' + fmt(s.amps) + ' A</div><small>at ' + (s.sysName || s.volts + ' V') + '</small></div><div class="n2-big n2-svc"><div>' + (s.service ? s.service + ' A' : 'Over the table') + '</div><small>next standard size (240.6)</small></div></div>' +
      '<table class="n2-t"><thead><tr><th>Step</th><th>VA</th><th>NEC</th></tr></thead><tbody>' + s.lines.map(function (l) { return '<tr class="' + (l.sub ? 'sub' : '') + '"><td>' + esc(l.label) + (l.note ? '<div class="n2-n">' + esc(l.note) + '</div>' : '') + '</td><td>' + (l.sub ? '(' + fmt(l.va) + ')' : fmt(l.va)) + '</td><td>' + esc(l.ref) + '</td></tr>' }).join('') + '<tr class="tot"><td>Total demand load</td><td>' + fmt(s.totalVA) + '</td><td></td></tr></tbody></table>' +
      '<div class="n2-hint">Amounts in parentheses feed a demand step and are not added again. ' + s.notes.map(esc).join(' ') + '</div>' +
      '<div class="n2-links"><button onclick="calcOpen()">Practice load calc problems</button><button onclick="openLab(\'svc\',\'' + (st.mode === 'dwelling' ? 'home' : st.mode === 'mf' ? 'apts' : 'office') + '\')">Open a matching service in the Service &amp; Panel Builder</button></div>'
  }
  function run() {
    var o = root.querySelector('#n2-out'); if (!o) return
    var s
    if (st.mode === 'dwelling') s = Nec220.calc({ method: st.method, sqft: v('sqft'), smallApp: v('sa'), laundry: v('lnd'), rangeN: v('rn'), rangeKw: v('rkw'), dryerN: v('dn'), dryerKw: v('dkw'), heat: v('heat'), ac: v('ac'), motor: v('motor'), evseN: v('en'), evseVa: v('eva'), heatUnits: v('hu'), fixed: st.fixed })
    else if (st.mode === 'occ') s = Nec220Occ.calcOcc({ occ: st.occ, sys: st.sys, sqft: v('sqft'), continuous: v('cont'), recepts: v('rec'), multiFt: v('mo'), windowFt: v('win'), trackFt: v('trk'), signs: v('sign'), heat: v('heat'), cool: v('cool'), largestMotor: v('lm'), kitchen: st.kit.map(function (x) { return x.va }), other: st.oth })
    else s = Nec220Occ.calcMF({ sys: st.sys, units: v('units'), unitSqft: v('usf'), heat: v('mheat'), cool: v('mcool'), laundry: v('mlnd'), houseVA: v('house'), appliances: st.mf })
    o.innerHTML = result(s)
  }
  return {
    mount: function (el) { root = el; if (!root.dataset.ok) { root.dataset.ok = 1; render() } },
    run: run, method: function (m) { st.method = m; render() }, mode: function (m) { st.mode = m; render() },
    set: function (k, val) { st[k] = val; run() },
    setOcc: function (k) { st.occ = k; st.kit = (k === 'restaurant' || k === 'hospital' || k === 'school' || k === 'hotel') ? [{ name: 'Fryer / oven', va: 12000 }, { name: 'Dishwasher', va: 6000 }, { name: 'Booster heater', va: 4000 }] : []; render() },
    add: function (k) { st[k].push({ name: 'Item', va: 1000 }); lists(); run() },
    del: function (k, i) { st[k].splice(i, 1); lists(); run() },
    setL: function (k, i, f, val) { st[k][i][f] = f === 'va' ? parseFloat(val) || 0 : val; run() }
  }
})()
