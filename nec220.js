/* NEC 220 dwelling load calculator UI. Logic in nec220-core.js. */
var N220 = (function () {
  var root, st = { method: 'standard', fixed: [{ name: 'Dishwasher', va: 1200 }, { name: 'Disposal', va: 900 }, { name: 'Water heater', va: 4500 }, { name: 'Microwave', va: 1500 }] }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] }) }
  function fmt(n) { return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }) }
  function v(id) { var e = root.querySelector('#n2-' + id); return e ? (e.type === 'checkbox' ? e.checked : e.value) : '' }
  function inputs() {
    return { method: st.method, sqft: v('sqft'), smallApp: v('sa'), laundry: v('lnd'), rangeN: v('rn'), rangeKw: v('rkw'), dryerN: v('dn'), dryerKw: v('dkw'), heat: v('heat'), ac: v('ac'), motor: v('motor'), evseN: v('en'), evseVa: v('eva'), heatUnits: v('hu'), fixed: st.fixed }
  }
  function fld(id, label, val, extra) { return '<label class="n2-f"><span>' + label + '</span><input id="n2-' + id + '" type="number" min="0" step="any" value="' + (val == null ? '' : val) + '" ' + (extra || '') + ' oninput="N220.run()"></label>' }
  function render() {
    root.innerHTML =
      '<div class="n2-note"><b>Teaching tool, not a code-compliance determination.</b> It follows NEC 2023 Article 220 for a single-family dwelling on a 120/240 V single-phase service. Verify with the adopted NEC and your inspector.</div>' +
      '<div class="n2-tabs" role="tablist"><button role="tab" class="' + (st.method === 'standard' ? 'on' : '') + '" onclick="N220.method(\'standard\')">Standard method (Part III)</button><button role="tab" class="' + (st.method === 'optional' ? 'on' : '') + '" onclick="N220.method(\'optional\')">Optional method (220.82)</button></div>' +
      '<div class="n2-grid"><div class="n2-card"><h3>House</h3>' + fld('sqft', 'Living area, sq ft (outside dimensions, no garage or open porch)', 2000) + fld('sa', 'Small-appliance circuits (2 minimum)', 2) +
      '<label class="n2-f n2-c"><input id="n2-lnd" type="checkbox" checked onchange="N220.run()"> <span>Laundry circuit (1,500 VA)</span></label>' +
      '<h3>Big loads</h3><div class="n2-two">' + fld('rn', 'Ranges', 1) + fld('rkw', 'Range kW each', 12) + fld('dn', 'Dryers', 1) + fld('dkw', 'Dryer kW each (5 kW minimum)', 5) + '</div>' +
      '<h3>Heat, cooling, EV, motor</h3><div class="n2-two">' + fld('heat', 'Electric heat, VA', '') + fld('ac', 'A/C, VA', 4800) + fld('hu', 'Separately controlled heat units', 1) + fld('motor', 'Largest motor, VA (25% added)', '') + fld('en', 'EV chargers', 0) + fld('eva', 'EV nameplate VA (7,200 minimum each)', '') + '</div></div>' +
      '<div class="n2-card"><h3>Fixed appliances</h3><div id="n2-fx"></div><button class="n2-add" onclick="N220.addFx()">Add appliance</button><div class="n2-hint">Count appliances fastened in place, not ranges, dryers, heat or A/C. Four or more get a 75% demand factor in the standard method.</div></div></div>' +
      '<div id="n2-out" aria-live="polite"></div>'
    fx(); run()
  }
  function fx() {
    var h = st.fixed.map(function (f, i) { return '<div class="n2-fx"><input value="' + esc(f.name) + '" aria-label="Appliance name" oninput="N220.setFx(' + i + ',\'name\',this.value)"><input type="number" min="0" value="' + f.va + '" aria-label="VA" oninput="N220.setFx(' + i + ',\'va\',this.value)"><span>VA</span><button aria-label="Remove" onclick="N220.delFx(' + i + ')">×</button></div>' }).join('')
    root.querySelector('#n2-fx').innerHTML = h || '<div class="n2-hint">None added.</div>'
  }
  function run() {
    var s = Nec220.calc(inputs()), o = root.querySelector('#n2-out'); if (!o) return
    o.innerHTML = '<div class="n2-res"><div class="n2-big"><div>' + fmt(s.totalVA) + ' VA</div><small>calculated load</small></div><div class="n2-big"><div>' + fmt(s.amps) + ' A</div><small>at ' + s.volts + ' V</small></div><div class="n2-big n2-svc"><div>' + (s.service ? s.service + ' A' : 'Over 800 A') + '</div><small>next standard service size (240.6)</small></div></div>' +
      '<table class="n2-t"><thead><tr><th>Step</th><th>VA</th><th>NEC</th></tr></thead><tbody>' + s.lines.map(function (l) { return '<tr class="' + (l.sub ? 'sub' : '') + '"><td>' + esc(l.label) + (l.note ? '<div class="n2-n">' + esc(l.note) + '</div>' : '') + '</td><td>' + (l.sub ? '(' + fmt(l.va) + ')' : fmt(l.va)) + '</td><td>' + esc(l.ref) + '</td></tr>' }).join('') + '<tr class="tot"><td>Total demand load</td><td>' + fmt(s.totalVA) + '</td><td></td></tr></tbody></table>' +
      '<div class="n2-hint">Amounts in parentheses are shown for the demand step and are not added again. ' + s.notes.map(esc).join(' ') + '</div>' +
      '<div class="n2-links"><button onclick="calcOpen()">Practice load calc problems</button><button onclick="openLab(\'svc\',\'home\')">Open a home service in the Service &amp; Panel Builder</button></div>'
  }
  return {
    mount: function (el) { root = el; if (!root.dataset.ok) { root.dataset.ok = 1; render() } },
    run: run, method: function (m) { st.method = m; render() },
    addFx: function () { st.fixed.push({ name: 'Appliance', va: 1000 }); fx(); run() },
    delFx: function (i) { st.fixed.splice(i, 1); fx(); run() },
    setFx: function (i, k, val) { st.fixed[i][k] = k === 'va' ? parseFloat(val) || 0 : val; run() }
  }
})()
