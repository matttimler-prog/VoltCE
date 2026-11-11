/* Circuit Lab Assistant panel: How it works / Describe it / Upload a diagram / Find the manual. */
(function (root) {
  'use strict'
  var A = root.LabAssist, Lab = root.Lab, SC = root.SimCore, LS = root.LabSym
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  var host, drawer, tab = 'how', under = null, ocrWords = [], busy = false, rec = null

  /* ----- OCR token -> part type ----- */
  var MATCH = [
    [/^(E.?STOP|ESTOP|EMERGENCY)/, 'estop', 'E-stop'],
    [/^(STOP|PB2|S2)$|^STOP/, 'pbnc', 'Stop button (NC)'],
    [/^(START|PB1|S1)$|^START/, 'pbno', 'Start button (NO)'],
    [/^(OL|OLR)\d*$|^OVERLOAD/, 'ol', 'Overload relay'],
    [/^(M|MTR|MOTOR)\d*$|^MOTOR/, 'motor3', 'Motor'],
    [/^(\d?CR|K|MC|CON|C)\d+$|^(CR|MC|CONTACTOR|RELAY)$/, 'coil', 'Relay / contactor coil'],
    [/^(TD|TR|TIMER)\d*$/, 'coil', 'Timer coil'],
    [/^(F|FU|FUSE)\d*$/, 'fuse', 'Fuse'],
    [/^(CB|QF|BRK|BREAKER|DISC|DS|MCB)\d*$/, 'brk', 'Breaker / disconnect'],
    [/^(T|TX|XFMR|TRANSFORMER)\d*$/, 'xfmr1', 'Transformer'],
    [/^(LT|LP|PL|LAMP|PILOT)\d*$/, 'lamp', 'Lamp / pilot light'],
    [/^(H|HTR|HEATER)\d*$/, 'heater', 'Heater'],
    [/^(SW|S)\d+$|^SWITCH$/, 'sw', 'Switch']
  ]
  function classify(w) { var t = String(w).toUpperCase().replace(/[^A-Z0-9\-]/g, ''); if (!t) return null; for (var i = 0; i < MATCH.length; i++) if (MATCH[i][0].test(t)) return { type: MATCH[i][1], name: MATCH[i][2], token: t }; if (/^L[123]$/.test(t)) return { type: 'src3', name: 'Three-phase source (line ' + t + ')', token: t, once: true }; return null }

  /* ----- manuals ----- */
  var MFR = { 'allen-bradley': 'rockwellautomation.com', rockwell: 'rockwellautomation.com', siemens: 'siemens.com', abb: 'abb.com', eaton: 'eaton.com', 'square d': 'se.com', schneider: 'se.com', ge: 'geindustrial.com', 'general electric': 'geindustrial.com', hubbell: 'hubbell.com', leviton: 'leviton.com', weg: 'weg.net', baldor: 'baldor.com', carrier: 'carrier.com', trane: 'trane.com', lennox: 'lennox.com', cutler: 'eaton.com', 'cutler-hammer': 'eaton.com', 'mitsubishi': 'mitsubishielectric.com', omron: 'omron.com', 'automation direct': 'automationdirect.com', automationdirect: 'automationdirect.com', siemens: 'siemens.com', honeywell: 'honeywell.com', cummins: 'cummins.com', generac: 'generac.com', 'marathon': 'regalrexnord.com', 'leeson': 'regalrexnord.com', 'franklin electric': 'franklin-electric.com' }
  function manualLinks(f) {
    var mfr = (f.mfr || '').trim(), pn = (f.pn || '').trim(), sn = (f.sn || '').trim(), ty = (f.type || '').trim()
    var core = [mfr, pn, ty].filter(Boolean).join(' '), g = 'https://www.google.com/search?q=', L = []
    if (!core && !sn) return L
    L.push({ t: 'Wiring diagram or schematic (web)', u: g + encodeURIComponent(core + ' wiring diagram schematic manual pdf') })
    L.push({ t: 'Installation / service manual (PDF only)', u: g + encodeURIComponent(core + ' installation manual filetype:pdf') })
    L.push({ t: 'Diagram pictures (image search)', u: 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(core + ' wiring diagram') })
    var dom = MFR[mfr.toLowerCase()]; if (dom) L.push({ t: 'Search ' + mfr + '\'s own site', u: g + encodeURIComponent('site:' + dom + ' ' + (pn || ty) + ' manual') })
    L.push({ t: 'ManualsLib', u: 'https://www.manualslib.com/search/?q=' + encodeURIComponent([mfr, pn].filter(Boolean).join(' ') || core) })
    if (sn) L.push({ t: 'Serial number lookup (age, factory)', u: g + encodeURIComponent((mfr ? mfr + ' ' : '') + 'serial number date code decoder ' + sn) })
    return L
  }

  /* ----- panel ----- */
  function attach(h) {
    if (!h || h.querySelector('.la-btn')) return
    host = h; h.style.position = 'relative'
    var bar = h.querySelector('.lab-bar'); if (!bar) return
    var b = document.createElement('button'); b.className = 'btn la-btn'; b.id = 'lab-assist'; b.textContent = 'Assistant'; b.title = 'Explain this circuit, build one from a description, or trace over an uploaded diagram'
    var sep = document.createElement('span'); sep.className = 'lab-sep'
    bar.appendChild(sep); bar.appendChild(b)
    drawer = document.createElement('aside'); drawer.className = 'la-drawer'; drawer.hidden = true; drawer.setAttribute('aria-label', 'Circuit Lab assistant')
    h.appendChild(drawer)
    b.onclick = function () { toggle() }
    drawer.addEventListener('click', onClick)
    drawer.addEventListener('input', onInput)
    drawer.addEventListener('change', onChange)
    render()
  }
  function toggle(show) { drawer.hidden = show === undefined ? !drawer.hidden : !show; if (!drawer.hidden) render() }
  function setTab(t) { tab = t; render() }
  function render() {
    if (!drawer) return
    var tabs = [['how', 'How it works'], ['desc', 'Describe it'], ['up', 'Upload diagram'], ['man', 'Find manual']]
    var h = '<div class="la-head"><b>Assistant</b><button class="la-x" data-la="close" aria-label="Close">×</button></div><div class="la-tabs" role="tablist">' + tabs.map(function (t) { return '<button role="tab" class="la-tab' + (tab === t[0] ? ' on' : '') + '" data-la-tab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>' }).join('') + '</div><div class="la-body">'
    h += tab === 'how' ? howHTML() : tab === 'desc' ? descHTML() : tab === 'up' ? upHTML() : manHTML()
    drawer.innerHTML = h + '</div>'
  }

  function icon(c) {
    try { var k = { id: 'p', type: c.type, props: c.props || {}, rot: 0 }, bx = LS.layout(k).box, w = bx[2] - bx[0] + 20, h = bx[3] - bx[1] + 20
      return '<svg class="la-ico" viewBox="' + (bx[0] - 10) + ' ' + (bx[1] - 10) + ' ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + LS.draw(k, null, { rot: 0 }) + '</svg>' } catch (e) { return '' }
  }
  function howHTML() {
    var m = Lab.model(), x = A.explain(m), h = ''
    h += '<p class="la-note">Plain-language walkthrough of what is on the canvas right now. Change the circuit and press Refresh.</p><button class="btn btn-outline la-sm" data-la="refresh">Refresh</button>'
    h += '<h4>The big picture</h4><ul>' + x.big.map(function (b) { return '<li>' + esc(b) + '</li>' }).join('') + '</ul>'
    if (x.result.length) h += '<h4>What happens when it runs</h4><ul class="la-res">' + x.result.map(function (r) { return '<li class="' + (r.bad ? 'bad' : '') + '"><b>' + esc(r.name) + '</b> ' + esc(r.text) + '</li>' }).join('') + '</ul>'
    if (x.tips.length) h += '<h4>Problems found</h4><ul class="la-tips">' + x.tips.map(function (t) { return '<li>' + esc(t) + '</li>' }).join('') + '</ul>'
    if (x.legend.length) h += '<h4>How to read these symbols</h4><div class="la-leg">' + x.legend.map(function (l) { return '<div class="la-lg">' + icon(l.comp) + '<div><b>' + esc(l.name) + '</b><p>' + esc(l.text) + '</p></div></div>' }).join('') + '</div>'
    h += '<h4>Reading any wiring diagram</h4><ul><li>Power runs top to bottom: line voltage (L1, L2, L3) at the top, loads at the bottom.</li><li>The control circuit (coils, buttons) is usually drawn separately as horizontal "rungs", read left to right.</li><li>Parts with the same tag (M, CR1, OL) belong together even if they are drawn far apart: a coil and its contacts.</li><li>Switches and contacts are always drawn in their resting, de-energized state.</li><li>A dot on a crossing means the wires connect; no dot means they pass over each other.</li></ul>'
    return h
  }
  var SAMPLES = ['120 volt lamp with a switch and a 15 amp breaker', '240 volt heater on a 20 amp fuse', '480 volt three phase motor with a breaker and overload', 'motor start stop with seal in', 'transformer 480 to 120 volts', 'two three way switches']
  function descHTML() {
    var sr = !!(root.SpeechRecognition || root.webkitSpeechRecognition)
    return '<p class="la-note">Describe the equipment or circuit in plain words. It builds the closest circuit, tells you what it assumed, and you can edit it.</p>' +
      '<textarea id="la-text" rows="4" placeholder="e.g. 480 volt three phase motor with a breaker and overload relay"></textarea>' +
      '<div class="la-row"><button class="btn la-go" data-la="build">Build it</button>' + (sr ? '<button class="btn btn-outline" data-la="mic" id="la-mic">🎤 Speak</button>' : '<span class="la-note">Voice needs Chrome, Edge or Safari.</span>') + '</div>' +
      '<div id="la-out" class="la-out" aria-live="polite"></div><h4>Try one</h4><div class="la-chips">' + SAMPLES.map(function (s) { return '<button class="la-chip" data-la-sample="' + esc(s) + '">' + esc(s) + '</button>' }).join('') + '</div>'
  }
  function upHTML() {
    var h = '<p class="la-note">Upload a photo, screenshot or PDF of a wiring diagram. It appears behind the canvas so you can trace it. Free, in-browser text reading suggests which parts are on it. Nothing leaves your device except the reading engine download.</p>'
    h += '<label class="btn la-go la-file">Choose image or PDF<input type="file" id="la-file" accept="image/*,application/pdf" hidden></label>'
    if (under) {
      h += '<div class="la-ctl"><label>Opacity <input type="range" min="10" max="100" value="' + Math.round(under.opacity * 100) + '" data-la-op></label><label>Size <input type="range" min="30" max="300" value="' + Math.round(under.size / 8) + '" data-la-sz></label><button class="btn btn-outline la-sm" data-la="rmunder">Remove image</button></div>'
      h += '<div class="la-row"><button class="btn la-go" data-la="ocr"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Reading…' : 'Read labels on the diagram') + '</button></div><div id="la-ocr-status" class="la-note"></div>'
      h += ocrHTML()
    }
    h += '<h4>How to trace it</h4><ol><li>Read the labels to find the parts, then press Place to drop each one where it sits on the image.</li><li>Drag the parts to line up with the picture and wire them the same way.</li><li>Turn power on. If it behaves as the diagram intends, you wired it right; the How it works tab explains what you built.</li></ol><p class="la-note">Reading diagrams automatically is imperfect. Treat suggestions as hints, and check them against the drawing.</p>'
    return h
  }
  function ocrHTML() {
    if (!ocrWords.length) return ''
    var seen = {}, rows = []
    ocrWords.forEach(function (w, i) { var c = classify(w.text); if (!c) return; var k = c.token; if (seen[k]) return; seen[k] = 1; rows.push('<div class="la-found"><span class="la-tok">' + esc(w.text) + '</span><span>' + esc(c.name) + '</span><button class="btn btn-outline la-sm" data-la-place="' + i + '">Place</button></div>') })
    return '<h4>Found on the diagram</h4>' + (rows.length ? rows.join('') + '<button class="btn btn-outline la-sm" data-la="placeall">Place all</button>' : '<p class="la-note">No part labels recognised. Try a larger or sharper image.</p>')
  }
  var NAMEPLATE = [['HP / kW', 'Mechanical output power.'], ['FLA / FLC / Amps', 'Full-load current: use it to size the overload and conductors.'], ['V', 'Rated voltage. A dual rating like 208-230/460 can be wired two ways.'], ['PH', 'Phase: 1 or 3.'], ['SF', 'Service factor: allowed short-term overload (1.15 means 15% extra).'], ['RPM', 'Speed at full load.'], ['Hz', 'Line frequency, 60 in North America.'], ['Ins. class / Temp rise', 'Heat rating of the winding insulation.'], ['KVA code / Code letter', 'Locked-rotor kVA per HP: tells you the starting current.'], ['Design letter', 'NEMA torque and starting-current class (A, B, C, D).'], ['Enclosure', 'ODP (open), TEFC (totally enclosed fan cooled), etc.']]
  function manHTML() {
    return '<p class="la-note">Enter what is on the equipment nameplate. The Assistant opens the right searches for you. It cannot fetch a manual by itself (browsers block that, and an automatic search would need a paid server), so download the diagram page and upload it in the Upload tab.</p>' +
      '<label class="la-f">Manufacturer<input id="la-mfr" list="la-mfrs" placeholder="e.g. Square D"></label><datalist id="la-mfrs">' + Object.keys(MFR).map(function (k) { return '<option value="' + esc(k) + '">' }).join('') + '</datalist>' +
      '<label class="la-f">Model / part number<input id="la-pn" placeholder="e.g. 8536SCO3V02S"></label><label class="la-f">Serial number (optional)<input id="la-sn"></label>' +
      '<label class="la-f">What is it?<select id="la-ty"><option value="">Not sure</option><option>motor starter</option><option>contactor</option><option>motor</option><option>transformer</option><option>circuit breaker</option><option>VFD drive</option><option>control panel</option><option>HVAC unit</option><option>generator</option><option>disconnect switch</option></select></label>' +
      '<div class="la-row"><button class="btn la-go" data-la="links">Find manuals</button></div><div id="la-links" class="la-links"></div>' +
      '<h4>Reading a motor nameplate</h4><dl class="la-dl">' + NAMEPLATE.map(function (n) { return '<dt>' + esc(n[0]) + '</dt><dd>' + esc(n[1]) + '</dd>' }).join('') + '</dl>'
  }

  /* ----- actions ----- */
  function onClick(e) {
    var t = e.target.closest('button,[data-la-tab]'); if (!t) return
    var tb = t.getAttribute('data-la-tab'); if (tb) return setTab(tb)
    var a = t.getAttribute('data-la')
    if (a === 'close') return toggle(false)
    if (a === 'refresh') return render()
    if (a === 'build') return doBuild($('#la-text').value)
    if (a === 'mic') return mic()
    if (a === 'links') return doLinks()
    if (a === 'ocr') return doOCR()
    if (a === 'rmunder') return removeUnder()
    if (a === 'placeall') { var seen = {}; ocrWords.forEach(function (w, i) { var c = classify(w.text); if (c && !seen[c.token]) { seen[c.token] = 1; place(i) } }); return }
    var s = t.getAttribute('data-la-sample'); if (s) { $('#la-text').value = s; return doBuild(s) }
    var p = t.getAttribute('data-la-place'); if (p !== null) return place(+p)
  }
  function $(s) { return drawer.querySelector(s) }
  function onInput(e) {
    var t = e.target
    if (t.hasAttribute('data-la-op') && under) { under.opacity = t.value / 100; under.el.setAttribute('opacity', under.opacity) }
    if (t.hasAttribute('data-la-sz') && under) { under.size = t.value * 8; layoutUnder() }
  }
  function onChange(e) { if (e.target.id === 'la-file') loadFile(e.target.files[0]) }

  function doBuild(text) {
    if (!text || !text.trim()) { $('#la-out').innerHTML = '<p class="la-warn">Describe something first.</p>'; return }
    var b = A.build(text), had = Lab.model().comps.length
    if (had && !window.confirm('Replace what is on the canvas? (Your current circuit will be cleared.)')) return
    Lab.load(b.model)
    $('#la-out').innerHTML = '<p class="la-ok">' + esc(b.summary) + '</p>' + (b.assumptions.length ? '<p><b>Assumptions</b></p><ul>' + b.assumptions.map(function (a) { return '<li>' + esc(a) + '</li>' }).join('') + '</ul>' : '') + '<button class="btn btn-outline la-sm" data-la-tab="how">Explain how it works</button>'
    root.__laLast = b
  }
  function mic() {
    var SR = root.SpeechRecognition || root.webkitSpeechRecognition, b = $('#la-mic'); if (!SR) return
    if (rec) { rec.stop(); return }
    rec = new SR(); rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false
    b.textContent = '■ Listening… tap to stop'
    rec.onresult = function (ev) { var s = ''; for (var i = 0; i < ev.results.length; i++) s += ev.results[i][0].transcript; var ta = $('#la-text'); if (ta) ta.value = s }
    rec.onerror = function () { var o = $('#la-out'); if (o) o.innerHTML = '<p class="la-warn">The microphone was blocked or unavailable. You can type instead.</p>' }
    rec.onend = function () { rec = null; var b2 = $('#la-mic'); if (b2) b2.textContent = '🎤 Speak'; var ta = $('#la-text'); if (ta && ta.value.trim()) doBuild(ta.value) }
    try { rec.start() } catch (er) { rec = null }
  }
  function doLinks() {
    var L = manualLinks({ mfr: $('#la-mfr').value, pn: $('#la-pn').value, sn: $('#la-sn').value, type: $('#la-ty').value })
    $('#la-links').innerHTML = L.length ? L.map(function (l) { return '<a class="la-link" target="_blank" rel="noopener noreferrer" href="' + esc(l.u) + '">' + esc(l.t) + '</a>' }).join('') + '<p class="la-note">When you find the diagram page, save or screenshot it, then upload it in the Upload tab.</p>' : '<p class="la-warn">Enter a manufacturer, part number or serial number.</p>'
  }

  /* ----- underlay + OCR ----- */
  function svgWorld() { return host.querySelector('#lab-world') }
  function setUnder(url, w, h) {
    removeUnder(true)
    var img = document.createElementNS('http://www.w3.org/2000/svg', 'image'); img.setAttribute('id', 'lab-under'); img.setAttribute('href', url); img.setAttribute('opacity', '0.55'); img.setAttribute('preserveAspectRatio', 'xMidYMid meet'); img.style.pointerEvents = 'none'
    var wd = svgWorld(); wd.insertBefore(img, wd.firstChild)
    under = { el: img, url: url, w: w, h: h, opacity: 0.55, size: 800, x: 0, y: 0 }; layoutUnder()
    Lab.focus(under.x, under.y, under.size, under.size * h / w)
    ocrWords = []; render()
  }
  function layoutUnder() { if (!under) return; var s = under.size, hh = s * under.h / under.w; under.el.setAttribute('x', under.x); under.el.setAttribute('y', under.y); under.el.setAttribute('width', s); under.el.setAttribute('height', hh) }
  function removeUnder(keep) { if (under) { under.el.remove(); under = null } ocrWords = []; if (!keep) render() }
  function loadFile(f) {
    if (!f) return
    var st = function (m) { var s = $('#la-ocr-status'); if (s) s.textContent = m }
    if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) { pdfToImage(f).then(function (r) { setUnder(r.url, r.w, r.h) }).catch(function () { alert('Could not read that PDF in the browser. Take a screenshot of the diagram page and upload the image instead.') }); return }
    var url = URL.createObjectURL(f), im = new Image()
    im.onload = function () { setUnder(url, im.naturalWidth, im.naturalHeight) }
    im.onerror = function () { alert('That file could not be opened as an image.') }
    im.src = url
  }
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('load ' + src)) }; document.head.appendChild(s) }) }
  function pdfToImage(f) {
    return (root.pdfjsLib ? Promise.resolve() : loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js')).then(function () {
      root.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      return f.arrayBuffer()
    }).then(function (buf) { return root.pdfjsLib.getDocument({ data: buf }).promise }).then(function (doc) { return doc.getPage(1) }).then(function (pg) {
      var vp = pg.getViewport({ scale: 2 }), c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height
      return pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function () { return { url: c.toDataURL('image/png'), w: c.width, h: c.height } })
    })
  }
  function doOCR() {
    if (!under || busy) return
    busy = true; render(); var st = function (m) { var s = $('#la-ocr-status'); if (s) s.textContent = m }
    st('Loading the reading engine (first time only, about 10 MB)…')
    ;(root.Tesseract ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js')).then(function () {
      return root.Tesseract.recognize(under.url, 'eng', { logger: function (m) { if (m.status === 'recognizing text') st('Reading… ' + Math.round(m.progress * 100) + '%') } })
    }).then(function (r) {
      var words = (r.data.words || []).filter(function (w) { return w.confidence > 55 && w.text && w.text.trim() }).map(function (w) { return { text: w.text.trim(), x: (w.bbox.x0 + w.bbox.x1) / 2, y: (w.bbox.y0 + w.bbox.y1) / 2 } })
      ocrWords = words; busy = false; render(); st(words.length + ' words read.')
    }).catch(function () { busy = false; render(); st('The reading engine could not load. Check your connection; you can still trace the image by hand.') })
  }
  function place(i) {
    var w = ocrWords[i], c = classify(w.text); if (!c || !under) return
    var k = under.size / under.w, x = under.x + w.x * k, y = under.y + w.y * k
    var type = c.type, label = c.token
    var part = Lab.addPart(type, x, y, label)
    if (part && type === 'motor3') { /* keep defaults */ }
  }

  root.LabAssist.attach = attach
  root.LabAssist.ui = { toggle: toggle, setTab: setTab, classify: classify, manualLinks: manualLinks, place: place, ocrSet: function (w) { ocrWords = w; render() }, setUnder: setUnder, under: function () { return under } }
})(window)
