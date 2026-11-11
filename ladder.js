/* VoltCE Ladder Logic editor + live PLC simulation. Needs ladder-core.js. */
(function () {
  'use strict'
  var C = window.LadderCore, KEY = 'voltce_ladder_v1'
  var CW = 92, RH = 66, PAD = 16, RAIL = 26, TOP = 30
  var prog, R = null, sel = null, running = false, speed = 1, hist = [], histI = -1, mounted = null, el = {}, raf = 0, last = 0, acc = 0
  var ins = {}, power = {}, nodeEls = {}, wireEls = [], exName = ''
  var CSS = '.lw{fill:none;stroke:#5d6b7a;stroke-width:3;stroke-linecap:round}.lw.on{stroke:#1fa855}.ls{fill:none;stroke:#2b3947;stroke-width:3;stroke-linecap:round}.on .ls,.ls.on{stroke:#1fa855}.lt{font:600 12px system-ui,sans-serif;fill:#22303d;text-anchor:middle}.lt2{font:11px system-ui,sans-serif;fill:#6b7a89;text-anchor:middle}.lt3{font:600 12px system-ui,sans-serif;fill:#6b7a89}.lbx{fill:#fff;stroke:#2b3947;stroke-width:2.5}.on .lbx{fill:#e9f8ef;stroke:#1fa855}.lfill{fill:#2b3947}.on .lfill{fill:#1fa855}.lrail{stroke:#2b3947;stroke-width:5}.lslot{fill:#f4f8ff;stroke:#9db8e0;stroke-width:1.5;stroke-dasharray:4 3}.lsel{fill:rgba(27,95,192,.10);stroke:#1B5FC0;stroke-width:2;stroke-dasharray:5 4}.lcm{font:italic 12px system-ui,sans-serif;fill:#4a5d70}.lnum{font:700 12px ui-monospace,monospace;fill:#7a8794}'

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function clone(o) { return JSON.parse(JSON.stringify(o)) }
  function $(s, r) { return (r || el.host).querySelector(s) }

  /* ---------- model helpers ---------- */
  function find(id) {
    var out = null
    function ser(s, parPar) {
      if (s.id === id) { out = { kind: 'series', node: s, parent: parPar }; return true }
      for (var i = 0; i < s.nodes.length; i++) {
        var n = s.nodes[i]
        if (n.id === id) { out = { kind: 'node', node: n, series: s, index: i, parent: parPar }; return true }
        if (n.t === 'par') for (var j = 0; j < n.branches.length; j++) if (ser(n.branches[j], { par: n, series: s, index: i, bi: j })) return true
      }
      return false
    }
    for (var r = 0; r < prog.rungs.length; r++) { if (ser(prog.rungs[r], null)) { if (out) out.rung = r; return out } }
    return null
  }
  function rungOf(id) { var f = find(id); return f ? f.rung : -1 }
  function snap() { var s = JSON.stringify(prog); if (hist[histI] === s) return; hist = hist.slice(0, histI + 1); hist.push(s); if (hist.length > 80) hist.shift(); histI = hist.length - 1; save(); updBtns() }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ prog: prog, name: exName })) } catch (e) { } }
  function load(p, name) { prog = C.normalize(clone(p)); exName = name || ''; sel = null; rebuildRuntime(true); hist = []; histI = -1; snap(); render() }
  function undo(d) { var i = histI + d; if (i < 0 || i >= hist.length) return; histI = i; prog = JSON.parse(hist[i]); sel = null; rebuildRuntime(); save(); render(); updBtns() }
  function rebuildRuntime(fresh) {
    var old = R; R = C.Runtime(prog)
    if (old && !fresh) { R.bits = old.bits; R.timers = old.timers; R.counters = old.counters; R.scans = old.scans; R.time = old.time }
    if (fresh) { ins = {}; prog.tags.forEach(function (t) { if (t.kind === 'input') ins[t.name] = false }) }
    power = R.power
  }
  function tagsMap() { var m = {}; prog.tags.forEach(function (t) { m[t.name] = t }); return m }
  function usedBases() { return C.collectTags(prog) }
  function autoTags() {
    var m = tagsMap(), writes = {}
    function wr(s) { s.nodes.forEach(function (n) { if (n.t === 'par') n.branches.forEach(wr); else if (/^(OTE|OTL|OTU)$/.test(n.kind) && n.tag) writes[n.tag] = 1 }) }
    prog.rungs.forEach(wr)
    function walk(s) {
      s.nodes.forEach(function (n) {
        if (n.t === 'par') return n.branches.forEach(walk)
        if (!n.tag) return
        var b = C.split(n.tag)[0]
        if (m[b] || n.tag.indexOf('.') >= 0) return
        if (/^(XIC|XIO|ONS)$/.test(n.kind) && !writes[b]) { var t = C.tag(b, 'input', '', 'sw'); prog.tags.push(t); m[b] = t; ins[b] = false }
        else if (/^(OTE|OTL|OTU)$/.test(n.kind)) { var o = C.tag(b, 'output'); prog.tags.push(o); m[b] = o }
      })
    }
    prog.rungs.forEach(walk)
  }

  /* ---------- drawing ---------- */
  function symbol(n, x, y) {
    var cx = x + CW / 2, cy = y + RH / 2 + 4, k = n.kind, o = '', tg = esc(n.tag || '?')
    var top = '<text class="lt" x="' + cx + '" y="' + (y + 14) + '">' + tg + '</text>'
    function bars(slash) { return '<line class="ls" x1="' + (cx - 11) + '" y1="' + (cy - 14) + '" x2="' + (cx - 11) + '" y2="' + (cy + 14) + '"/><line class="ls" x1="' + (cx + 11) + '" y1="' + (cy - 14) + '" x2="' + (cx + 11) + '" y2="' + (cy + 14) + '"/>' + (slash ? '<line class="ls" x1="' + (cx - 9) + '" y1="' + (cy + 13) + '" x2="' + (cx + 9) + '" y2="' + (cy - 13) + '"/>' : '') }
    function coil(txt) { return '<path class="ls" d="M' + (cx - 11) + ' ' + (cy - 14) + 'Q' + (cx - 22) + ' ' + cy + ' ' + (cx - 11) + ' ' + (cy + 14) + '"/><path class="ls" d="M' + (cx + 11) + ' ' + (cy - 14) + 'Q' + (cx + 22) + ' ' + cy + ' ' + (cx + 11) + ' ' + (cy + 14) + '"/>' + (txt ? '<text class="lt" x="' + cx + '" y="' + (cy + 4) + '">' + txt + '</text>' : '') }
    function box(l1, l2) { return '<rect class="lbx" x="' + (x + 8) + '" y="' + (y + 20) + '" width="' + (CW - 16) + '" height="' + (RH - 28) + '" rx="4"/><text class="lt" x="' + cx + '" y="' + (y + 36) + '">' + l1 + '</text><text class="lt2" x="' + cx + '" y="' + (y + 50) + '">' + l2 + '</text>' }
    if (k === 'XIC') o = bars(false); else if (k === 'XIO') o = bars(true)
    else if (k === 'OTE') o = coil(''); else if (k === 'OTL') o = coil('L'); else if (k === 'OTU') o = coil('U')
    else if (k === 'ONS') o = box('ONS', 'one-shot')
    else if (k === 'CMP') o = box(esc(C.OPS[n.op] ? C.OPS[n.op][0] : '?') + ' ' + esc(n.value), 'compare')
    else if (k === 'TON' || k === 'TOF') o = box(k, 'PT ' + n.preset + ' s')
    else if (k === 'CTU' || k === 'CTD') o = box(k, 'PV ' + n.preset)
    else if (k === 'RES') o = box('RES', 'reset')
    var live = ''
    if (k === 'TON' || k === 'TOF') live = '<text class="lt3" data-live="' + esc(n.tag) + '" x="' + (cx - 28) + '" y="' + (y + RH + 7) + '"></text>'
    if (k === 'CTU' || k === 'CTD') live = '<text class="lt3" data-live="' + esc(n.tag) + '" x="' + (cx - 28) + '" y="' + (y + RH + 7) + '"></text>'
    return top + o + live
  }
  /* draw a series; returns {w,h,svg}. minW pads with wire. */
  function draw(s, x, y, minW, ctx) {
    var cx = x, svg = '', h = RH, wireY = y + RH / 2 + 4, nodes = s.nodes
    function wire(x1, x2, pid) { if (x2 <= x1) return ''; return '<line class="lw" data-p="' + pid + '" x1="' + x1 + '" y1="' + wireY + '" x2="' + x2 + '" y2="' + wireY + '"/>' }
    if (!nodes.length) {
      svg += wire(cx, cx + 14, s.id + ':i') + '<rect class="lslot" data-slot="' + s.id + '" x="' + (cx + 14) + '" y="' + (y + 22) + '" width="' + (CW - 28) + '" height="' + (RH - 34) + '" rx="4"/>' + wire(cx + CW - 14, cx + CW, s.id + ':i')
      cx += CW
    }
    nodes.forEach(function (n) {
      if (n.t === 'par') {
        var bw = 0, parts = [], yy = y, pH = 0
        n.branches.forEach(function (b) { var d = draw(b, 0, 0, 0, ctx); bw = Math.max(bw, d.w) })
        var lastY = wireY
        n.branches.forEach(function (b, bi) {
          var d = draw(b, cx + PAD, yy, bw, ctx)
          parts.push('<g>' + d.svg + '</g>')
          parts.push('<line class="lw" data-p="' + n.id + ':i" x1="' + cx + '" y1="' + (yy + RH / 2 + 4) + '" x2="' + (cx + PAD) + '" y2="' + (yy + RH / 2 + 4) + '"/>')
          parts.push('<line class="lw" data-p="' + b.id + ':o" x1="' + (cx + PAD + bw) + '" y1="' + (yy + RH / 2 + 4) + '" x2="' + (cx + 2 * PAD + bw) + '" y2="' + (yy + RH / 2 + 4) + '"/>')
          lastY = yy + RH / 2 + 4; yy += d.h; pH += d.h
        })
        parts.push('<line class="lw" data-p="' + n.id + ':i" x1="' + cx + '" y1="' + wireY + '" x2="' + cx + '" y2="' + lastY + '"/>')
        // right bar: color by par output
        parts.push('<line class="lw" data-p="' + n.id + ':o" x1="' + (cx + 2 * PAD + bw) + '" y1="' + wireY + '" x2="' + (cx + 2 * PAD + bw) + '" y2="' + lastY + '"/>')
        svg += parts.join('')
        cx += bw + 2 * PAD; h = Math.max(h, pH)
      } else {
        var isSel = sel === n.id
        svg += wire(cx, cx + 6, n.id + ':i') + '<g class="ln" data-id="' + n.id + '" data-p="' + n.id + ':e">' + (isSel ? '<rect class="lsel" x="' + (cx + 2) + '" y="' + (y + 2) + '" width="' + (CW - 4) + '" height="' + (RH + 6) + '" rx="6"/>' : '') + '<rect x="' + cx + '" y="' + y + '" width="' + CW + '" height="' + (RH + 8) + '" fill="transparent"/>' + symbol(n, cx, y) + '</g>' + wire(cx + CW - 6, cx + CW, n.id + ':o')
        cx += CW
      }
    })
    var w = cx - x
    if (minW && minW > w) { svg += wire(cx, x + minW, s.id + ':o'); w = minW }
    return { w: w, h: h, svg: svg }
  }
  function renderSVG(forExport) {
    var parts = [], y = TOP, maxW = 0, ds = []
    prog.rungs.forEach(function (r) { maxW = Math.max(maxW, draw(r, 0, 0, 0).w) })
    maxW = Math.max(maxW, CW * 6)
    var X0 = 70
    prog.rungs.forEach(function (r, i) {
      var d = draw(r, X0, y + (r.comment ? 18 : 0), maxW)
      var rh = d.h + (r.comment ? 18 : 0) + 24, isSel = sel === r.id
      parts.push('<g class="lr" data-rung="' + r.id + '">' + (isSel ? '<rect x="4" y="' + (y - 6) + '" width="' + (X0 + maxW + 50) + '" height="' + (rh - 6) + '" rx="8" fill="rgba(27,95,192,.06)" stroke="#9db8e0" stroke-dasharray="5 4"/>' : '') + '<rect class="lhit" x="0" y="' + (y - 6) + '" width="' + (X0 + maxW + 60) + '" height="' + rh + '" fill="transparent"/>' +
        (r.comment ? '<text class="lcm" x="' + X0 + '" y="' + (y + 10) + '">' + esc(r.comment) + '</text>' : '') +
        '<text class="lnum" x="6" y="' + (y + (r.comment ? 18 : 0) + RH / 2 + 8) + '">' + String(i).padStart(3, '0') + '</text>' +
        '<line class="lrail" x1="' + X0 + '" y1="' + (y + (r.comment ? 18 : 0) + 4) + '" x2="' + X0 + '" y2="' + (y + (r.comment ? 18 : 0) + d.h) + '"/>' +
        '<line class="lrail" x1="' + (X0 + maxW) + '" y1="' + (y + (r.comment ? 18 : 0) + 4) + '" x2="' + (X0 + maxW) + '" y2="' + (y + (r.comment ? 18 : 0) + d.h) + '"/>' +
        d.svg + '</g>')
      y += rh
    })
    parts.push('<g class="lend"><text class="lnum" x="6" y="' + (y + 14) + '">END</text><line class="lrail" x1="' + X0 + '" y1="' + (y + 8) + '" x2="' + (X0 + maxW) + '" y2="' + (y + 8) + '" style="stroke-width:3"/></g>')
    var W = X0 + maxW + 70, H = y + 36
    return { w: W, h: H, svg: '<svg xmlns="http://www.w3.org/2000/svg" class="lad-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="system-ui,sans-serif"><style>' + CSS + '</style>' + (forExport ? '<rect width="100%" height="100%" fill="#fff"/><text x="' + X0 + '" y="18" style="font:700 14px system-ui">' + esc(prog.name || 'Ladder program') + ' - VoltCE Ladder Logic</text>' : '') + parts.join('') + '</svg>' }
  }

  /* ---------- UI build ---------- */
  var PAL = [
    ['Inputs', ['XIC', 'XIO', 'ONS', 'CMP']],
    ['Outputs', ['OTE', 'OTL', 'OTU']],
    ['Timers & counters', ['TON', 'TOF', 'CTU', 'CTD', 'RES']]
  ]
  function build(host) {
    el.host = host
    var h = '<div class="lab-bar">'
    h += '<button class="btn lad-run" data-a="run"><span class="dot"></span><span class="lt">RUN</span></button>'
    h += '<button class="btn btn-outline" data-a="reset" title="Clear all bits, timers and counters">Reset</button>'
    h += '<span class="lab-sel">Speed <select data-a="speed"><option value="1">1×</option><option value="5">5×</option><option value="20">20×</option></select></span><span class="lab-sep"></span>'
    h += '<span class="lab-sel">Examples <select data-a="ex"><option value="">Choose…</option></select></span>'
    h += '<button class="btn btn-outline" data-a="new">New</button><span class="lab-sep"></span>'
    h += '<button class="btn btn-outline" data-a="undo">Undo</button><button class="btn btn-outline" data-a="redo">Redo</button><span class="lab-sep"></span>'
    h += '<span class="lab-sel">Export <select data-a="export"><option value="">Choose…</option><option value="st">Structured Text (.st)</option><option value="openplc">OpenPLC project (.st)</option><option value="il">Instruction list (.txt)</option><option value="svg">Ladder diagram (.svg)</option><option value="png">Ladder diagram (.png)</option><option value="csv">Tag list (.csv)</option><option value="json">Save program (.json)</option><option value="print">Print</option></select></span>'
    h += '<label class="btn btn-outline lad-imp">Import<input type="file" accept=".json,application/json" hidden data-a="import"></label>'
    h += '</div><div class="lad-main"><div class="lad-left"></div><div class="lad-cv"><div class="lad-note"></div><div class="lad-scroll"></div></div><div class="lad-right"></div></div>'
    host.innerHTML = h
    host.classList.add('lad-root')
    var left = $('.lad-left'), p = '<div class="lab-grp-t" style="margin-top:2px">Add to the selected spot</div>'
    PAL.forEach(function (g) {
      p += '<div class="lab-grp-t">' + g[0] + '</div><div class="lad-pal">'
      g[1].forEach(function (k) { p += '<button class="lad-pb" data-ins="' + k + '" title="' + esc(C.KINDS[k].label + ': ' + C.KINDS[k].desc) + '"><b>' + k + '</b><span>' + esc(C.KINDS[k].label) + '</span></button>' })
      p += '</div>'
    })
    p += '<div class="lab-grp-t">Structure</div><div class="lad-pal"><button class="lad-pb" data-a="rung"><b>Rung</b><span>Add a new rung</span></button><button class="lad-pb" data-a="branch" title="Put the selected element in parallel with a new branch"><b>Branch</b><span>Parallel path</span></button><button class="lad-pb" data-a="branch2" title="Add another parallel line next to the selected one"><b>+ Line</b><span>Extra branch</span></button><button class="lad-pb" data-a="del"><b>Delete</b><span>Remove selected</span></button></div>'
    p += '<div class="lad-help">Click a spot on a rung, then click an instruction to add it. Use <b>Branch</b> on a contact to put another contact in parallel, like a seal-in.</div>'
    left.innerHTML = p
    host.addEventListener('click', onClick)
    host.addEventListener('change', onChange)
    host.addEventListener('input', onInput)
    host.addEventListener('pointerdown', onDown)
    host.addEventListener('pointerup', onUp)
    host.addEventListener('pointercancel', onUp)
    document.addEventListener('keydown', function (e) { if (!mounted || !el.host.isConnected || !el.host.offsetParent) return; if (/input|select|textarea/i.test(e.target.tagName || '')) return; if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del() } else if (e.key === 'Escape') { sel = null; render() } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(e.shiftKey ? 1 : -1) } })
    var ex = $('[data-a=ex]'); Object.keys(EXAMPLES).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = EXAMPLES[k].title; ex.appendChild(o) })
  }
  function onUp() { Object.keys(pbHeld).forEach(function (n) { ins[n] = false }); pbHeld = {}; paintIO() }
  var pbHeld = {}
  function onDown(e) {
    var b = e.target.closest('[data-tagin]'); if (!b) return
    var n = b.getAttribute('data-tagin'), t = tagsMap()[n]
    if (t && t.dev === 'pb') { ins[n] = true; pbHeld[n] = 1; paintIO(); if (!running) tickOnce() }
  }
  function onClick(e) {
    var t = e.target
    var ib = t.closest('[data-ins]'); if (ib) return insert(ib.getAttribute('data-ins'))
    var ab = t.closest('[data-a]')
    if (ab && ab.tagName === 'BUTTON') return action(ab.getAttribute('data-a'), ab)
    var ti = t.closest('[data-tagin]')
    if (ti) { var n = ti.getAttribute('data-tagin'), tg = tagsMap()[n]; if (tg && tg.dev !== 'pb') { ins[n] = !ins[n]; paintIO(); if (!running) tickOnce() } return }
    var chip = t.closest('[data-chip]'); if (chip) { setTag(chip.getAttribute('data-chip')); return }
    var dt = t.closest('[data-deltag]'); if (dt) { prog.tags = prog.tags.filter(function (x) { return x.name !== dt.getAttribute('data-deltag') }); snap(); renderSide(); return }
    var n2 = t.closest('[data-id]'); if (n2) { sel = n2.getAttribute('data-id'); renderCanvas(); renderSide(); return }
    var sl = t.closest('[data-slot]'); if (sl) { sel = sl.getAttribute('data-slot'); renderCanvas(); renderSide(); return }
    var ru = t.closest('[data-rung]'); if (ru) { sel = ru.getAttribute('data-rung'); renderCanvas(); renderSide(); return }
  }
  function onInput(e) {
    var t = e.target
    if (t.matches('[data-f=tag]')) { var f = find(sel); if (f && f.kind === 'node') { f.node.tag = t.value.trim(); autoTagsSoft() ; updNodeLabel() } }
  }
  function autoTagsSoft() { }
  function onChange(e) {
    var t = e.target, a = t.getAttribute('data-a'), f = sel ? find(sel) : null
    if (a === 'speed') { speed = +t.value; return }
    if (a === 'ex') { if (t.value) { var x = EXAMPLES[t.value]; load(x.prog(), t.value); setNote(x.note); } t.value = ''; return }
    if (a === 'export') { doExport(t.value); t.value = ''; return }
    if (a === 'import') { var file = t.files[0]; if (!file) return; var rd = new FileReader(); rd.onload = function () { try { var j = JSON.parse(rd.result); if (!j.rungs) throw 0; load(j, '') ; setNote('Imported ' + esc(file.name) + '.') } catch (er) { setNote('That file is not a VoltCE ladder program (.json).') } }; rd.readAsText(file); t.value = ''; return }
    var fld = t.getAttribute('data-f')
    if (fld === 'tag' && f && f.kind === 'node') { f.node.tag = t.value.trim(); finishEdit() }
    else if (fld === 'preset' && f) { f.node.preset = Math.max(0, +t.value || 0); finishEdit() }
    else if (fld === 'op' && f) { f.node.op = t.value; finishEdit() }
    else if (fld === 'value' && f) { f.node.value = +t.value || 0; finishEdit() }
    else if (fld === 'comment' && f && f.kind === 'series') { f.node.comment = t.value; finishEdit() }
    else if (fld === 'name') { prog.name = t.value || 'Program'; snap() }
    else if (fld === 'newtagname') { }
  }
  function updNodeLabel() { var f = find(sel); if (!f || f.kind !== 'node') return; var g = el.host.querySelector('[data-id="' + sel + '"] .lt'); if (g) g.textContent = f.node.tag || '?' }
  function setTag(name) { var f = find(sel); if (!f || f.kind !== 'node') return; f.node.tag = name; finishEdit() }
  function finishEdit() { autoTags(); rebuildRuntime(); snap(); render() }
  function action(a, btn) {
    if (a === 'run') return toggleRun()
    if (a === 'reset') { R.reset(); paint(); return }
    if (a === 'new') { if (prog.rungs.length && !confirmNew()) return; load(C.newProgram('My program'), ''); setNote('Empty program. Click the rung, then add instructions from the left.'); prog.rungs.push(C.rung([])); sel = prog.rungs[0].id; snap(); render(); return }
    if (a === 'undo') return undo(-1)
    if (a === 'redo') return undo(1)
    if (a === 'rung') { var r = C.rung([]); var f = sel ? find(sel) : null; var at = f ? f.rung + 1 : prog.rungs.length; prog.rungs.splice(at, 0, r); sel = r.id; finishEdit(); return }
    if (a === 'branch') return branch()
    if (a === 'branch2') return branch2()
    if (a === 'del') return del()
    if (a === 'addtag') { var nm = $('[data-f=newtagname]').value.trim().replace(/\s+/g, '_'), ty = $('[data-f=newtagtype]').value; if (!nm) return; if (tagsMap()[nm]) return setNote('There is already a tag named ' + esc(nm) + '.'); var tg = ty === 'out' ? C.tag(nm, 'output') : C.tag(nm, 'input', '', ty === 'pb' ? 'pb' : 'sw'); prog.tags.push(tg); if (tg.kind === 'input') ins[nm] = false; snap(); renderSide(); return }
  }
  function confirmNew() { try { return window.confirm('Start a new program? Your current one will be replaced (you can Undo).') } catch (e) { return true } }
  function insert(kind) {
    var f = sel ? find(sel) : null, node = C.elem(kind, '')
    if (!prog.rungs.length) { prog.rungs.push(C.rung([])); }
    if (!f) { var lr = prog.rungs[prog.rungs.length - 1]; lr.nodes.push(node) }
    else if (f.kind === 'node') f.series.nodes.splice(f.index + 1, 0, node)
    else f.node.nodes.push(node)
    sel = node.id; finishEdit(); var inp = $('[data-f=tag]'); if (inp && !(el.host.querySelector('.lad-note') && 0)) { try { inp.focus() } catch (e) { } }
  }
  function branch() {
    var f = sel ? find(sel) : null
    if (!f || f.kind !== 'node' || f.node.t === 'par') return setNote('Click a contact or coil first, then press Branch to put a parallel path next to it.')
    var inner = C.newSeries([f.node]), empty = C.newSeries([]), p = C.par([inner, empty])
    f.series.nodes[f.index] = p; sel = empty.id; finishEdit()
  }
  function branch2() {
    var f = sel ? find(sel) : null
    if (!f || !f.parent) return setNote('Select something inside a branch first.')
    var b = C.newSeries([]); f.parent.par.branches.splice(f.parent.bi + 1, 0, b); sel = b.id; finishEdit()
  }
  function cleanup(s) {
    for (var i = s.nodes.length - 1; i >= 0; i--) {
      var n = s.nodes[i]
      if (n.t === 'par') {
        n.branches.forEach(cleanup)
        var live = n.branches.filter(function (b) { return b.nodes.length })
        if (!live.length) s.nodes.splice(i, 1)
        else if (n.branches.length === 1 || live.length === 1 && n.branches.length > 1 && !n.keep) { if (live.length === 1) { var rest = live[0].nodes; s.nodes.splice.apply(s.nodes, [i, 1].concat(rest)) } }
      }
    }
  }
  function del() {
    var f = sel ? find(sel) : null; if (!f) return
    if (f.kind === 'node') { f.series.nodes.splice(f.index, 1); sel = f.series.id; if (f.parent) { cleanup(prog.rungs[f.rung]); if (!find(sel)) sel = prog.rungs[f.rung] && prog.rungs[f.rung].id } }
    else if (f.parent) { f.parent.par.branches.splice(f.parent.bi, 1); sel = null; cleanup(prog.rungs[f.rung]) }
    else { prog.rungs.splice(f.rung, 1); sel = null }
    finishEdit()
  }

  /* ---------- rendering ---------- */
  function render() { renderCanvas(); renderSide(); updBtns(); paint() }
  function renderCanvas() {
    var r = renderSVG(false), sc = $('.lad-scroll')
    var top = sc.scrollTop, left = sc.scrollLeft
    sc.innerHTML = prog.rungs.length ? r.svg : '<div class="lad-empty">No rungs yet. Press <b>Rung</b> to add one, or pick an example from the Examples menu.</div>'
    sc.scrollTop = top; sc.scrollLeft = left
    nodeEls = {}; wireEls = []
    sc.querySelectorAll('[data-p]').forEach(function (n) { wireEls.push(n) })
    paint()
  }
  function paint() {
    var P = R ? R.power : {}
    wireEls.forEach(function (n) {
      var p = n.getAttribute('data-p').split(':'), on = false, pw = P[p[0]]
      if (pw) on = p[1] === 'i' ? pw.i : p[1] === 'o' ? pw.o : pw.o
      if (n.tagName === 'g') { var pn = P[p[0]]; var k = find(p[0]); on = !!pn && (k && k.node && /^(OT|TO|CT|RE)/.test(k.node.kind || '') ? pn.i : pn.o) }
      n.classList.toggle('on', !!(running || R.scans) && !!on)
    })
    el.host.querySelectorAll('[data-live]').forEach(function (t) {
      var nm = t.getAttribute('data-live'), tm = R.timers[nm], ct = R.counters[nm]
      t.textContent = tm ? tm.acc.toFixed(1) + ' / ' + tm.preset + ' s' : ct ? ct.acc + ' / ' + ct.preset : ''
    })
    paintIO()
  }
  function paintIO() {
    var host = $('.lad-io'); if (!host) return
    host.querySelectorAll('[data-tagin]').forEach(function (b) { var n = b.getAttribute('data-tagin'); b.classList.toggle('on', !!ins[n]) })
    host.querySelectorAll('[data-tagout]').forEach(function (b) { b.classList.toggle('on', !!R.bits[b.getAttribute('data-tagout')]) })
    host.querySelectorAll('[data-mem]').forEach(function (b) { var n = b.getAttribute('data-mem'); b.textContent = memVal(n); b.parentNode.classList.toggle('on', memOn(n)) })
  }
  function memOn(n) { var tm = R.timers[n], ct = R.counters[n]; return tm ? tm.dn : ct ? ct.dn : !!R.bits[n] }
  function memVal(n) { var tm = R.timers[n], ct = R.counters[n]; return tm ? 'DN ' + (tm.dn ? 1 : 0) + ' · ' + tm.acc.toFixed(1) + '/' + tm.preset + 's' : ct ? 'DN ' + (ct.dn ? 1 : 0) + ' · ' + ct.acc + '/' + ct.preset : R.bits[n] ? 'ON' : 'off' }
  function renderSide() {
    var side = $('.lad-right'), tm = tagsMap(), ct = usedBases(), h = ''
    var f = sel ? find(sel) : null
    h += '<div class="lab-ins-h">' + (f && f.kind === 'node' ? esc(C.KINDS[f.node.kind].label) : f && f.kind === 'series' ? (f.parent ? 'Parallel line' : 'Rung ' + f.rung) : 'Program') + '</div>'
    if (f && f.kind === 'node') {
      var n = f.node
      h += '<div class="lad-desc">' + esc(C.KINDS[n.kind].desc) + '</div>'
      h += '<label class="lad-f">Tag<input data-f="tag" list="lad-tags" value="' + esc(n.tag) + '" placeholder="' + (n.kind === 'CMP' ? 'e.g. C1.ACC' : 'name') + '" autocomplete="off"></label><datalist id="lad-tags">' + prog.tags.map(function (t) { return '<option value="' + esc(t.name) + '">' }).join('') + ct.order.map(function (b) { return '<option value="' + esc(b) + '">' }).join('') + '</datalist>'
      var chips = prog.tags.concat(ct.order.filter(function (b) { return !tm[b] }).map(function (b) { return { name: b, kind: 'mem' } }))
      if (chips.length) h += '<div class="lad-chips">' + chips.map(function (t) { return '<button class="lad-chip" data-chip="' + esc(t.name) + '">' + esc(t.name) + '</button>' }).join('') + '</div>'
      if (/^(TON|TOF)$/.test(n.kind)) h += '<label class="lad-f">Preset (seconds)<input data-f="preset" type="number" min="0" step="0.5" value="' + esc(n.preset) + '"></label>'
      if (/^(CTU|CTD)$/.test(n.kind)) h += '<label class="lad-f">Preset (counts)<input data-f="preset" type="number" min="1" step="1" value="' + esc(n.preset) + '"></label>'
      if (n.kind === 'CMP') h += '<label class="lad-f">Compare<select data-f="op">' + Object.keys(C.OPS).map(function (k) { return '<option value="' + k + '"' + (n.op === k ? ' selected' : '') + '>' + C.OPS[k][0] + '</option>' }).join('') + '</select></label><label class="lad-f">To<input data-f="value" type="number" value="' + esc(n.value) + '"></label>'
      if (/^(TON|TOF|CTU|CTD)$/.test(n.kind)) h += '<div class="lad-desc">Use <b>' + esc(n.tag || 'TAG') + '.DN</b> (done) in another contact, or <b>.ACC</b> in a compare.</div>'
    } else if (f && f.kind === 'series' && !f.parent) {
      h += '<label class="lad-f">Rung comment<input data-f="comment" value="' + esc(f.node.comment) + '" placeholder="What does this rung do?"></label>'
    } else if (f) h += '<div class="lad-desc">Pick an instruction on the left to add it here.</div>'
    else h += '<label class="lad-f">Program name<input data-f="name" value="' + esc(prog.name) + '"></label>'
    var v = C.validate(prog)
    h += '<div class="lab-grp-t">I/O</div><div class="lad-io">'
    var ins2 = prog.tags.filter(function (t) { return t.kind === 'input' }), outs = prog.tags.filter(function (t) { return t.kind === 'output' })
    h += '<div class="lad-io-t">Inputs <span class="muted">(click to switch)</span></div>' + (ins2.map(function (t) { return '<div class="lad-row"><button class="lad-sw" data-tagin="' + esc(t.name) + '"><i></i></button><span>' + esc(t.name) + (t.dev === 'pb' ? ' <em>push</em>' : '') + '</span>' + (t.comment ? '<small>' + esc(t.comment) + '</small>' : '') + '<button class="lad-x" data-deltag="' + esc(t.name) + '" title="Remove tag">×</button></div>' }).join('') || '<div class="muted">none yet</div>')
    h += '<div class="lad-io-t">Outputs</div>' + (outs.map(function (t) { return '<div class="lad-row"><span class="lad-lamp" data-tagout="' + esc(t.name) + '"></span><span>' + esc(t.name) + '</span>' + (t.comment ? '<small>' + esc(t.comment) + '</small>' : '') + '<button class="lad-x" data-deltag="' + esc(t.name) + '" title="Remove tag">×</button></div>' }).join('') || '<div class="muted">none yet</div>')
    var mem = ct.order.filter(function (b) { return !tm[b] })
    if (mem.length) h += '<div class="lad-io-t">Memory, timers, counters</div>' + mem.map(function (b) { return '<div class="lad-row"><span class="lad-dot"></span><span>' + esc(b) + '</span><small data-mem="' + esc(b) + '"></small></div>' }).join('')
    h += '<div class="lad-add"><input data-f="newtagname" placeholder="new tag name"><select data-f="newtagtype"><option value="sw">Switch in</option><option value="pb">Pushbutton in</option><option value="out">Output</option></select><button class="btn btn-outline" data-a="addtag">Add</button></div></div>'
    if (v.length) h += '<div class="lad-warn"><b>Check your program</b>' + v.slice(0, 6).map(function (x) { return '<div>' + esc(x.msg) + '</div>' }).join('') + '</div>'
    side.innerHTML = h
    paintIO()
  }
  function setNote(t) { var n = $('.lad-note'); n.innerHTML = t || ''; n.style.display = t ? '' : 'none' }
  function updBtns() {
    var u = $('[data-a=undo]'), r = $('[data-a=redo]'); if (u) u.disabled = histI <= 0; if (r) r.disabled = histI >= hist.length - 1
    var rb = $('.lad-run'); if (rb) { rb.classList.toggle('on', running); rb.querySelector('.lt').textContent = running ? 'STOP' : 'RUN' }
  }

  /* ---------- run loop ---------- */
  function applyInputs() { prog.tags.forEach(function (t) { if (t.kind === 'input') R.set(t.name, !!ins[t.name]) }) }
  function tickOnce() { applyInputs(); R.step(0.02); paint() }
  function toggleRun() { running = !running; if (running) { last = 0; acc = 0; raf = requestAnimationFrame(loop) } else cancelAnimationFrame(raf); updBtns(); paint() }
  function loop(ts) {
    if (!running) return
    if (!el.host.isConnected) { running = false; return }
    if (last) { acc += Math.min(0.2, (ts - last) / 1000) * speed; var n = 0; while (acc >= 0.02 && n < 120) { applyInputs(); R.step(0.02); acc -= 0.02; n++ } if (n) paint() }
    last = ts; raf = requestAnimationFrame(loop)
  }

  /* ---------- examples ---------- */
  var E = C.elem, P = C.par, Rg = C.rung, S = C.newSeries, T = C.tag
  var EXAMPLES = {
    seal: { title: 'Motor start / stop (seal-in)', note: 'Switch <b>START</b> on then off: the motor keeps running because the <b>MOTOR</b> contact seals around START. Switch <b>STOP</b> to drop it out. STOP is wired normally closed, like a real stop button.', prog: function () {
      var p = C.newProgram('Start-stop seal-in'); p.tags = [T('START', 'input', 'Start pushbutton (NO)', 'pb'), T('STOP', 'input', 'Stop pushbutton (shown as NC contact)', 'pb'), T('MOTOR', 'output', 'Motor contactor coil')]
      p.rungs = [Rg([P([S([E('XIC', 'START')]), S([E('XIC', 'MOTOR')])]), E('XIO', 'STOP'), E('OTE', 'MOTOR')], 'Press START to run, MOTOR seals itself in, STOP breaks the circuit')]; return p } },
    ondelay: { title: 'On-delay: light 3 s after switch', note: 'Turn <b>SW</b> on. The timer counts up and the lamp comes on when it reaches 3 seconds. Turn SW off and the timer resets.', prog: function () {
      var p = C.newProgram('On-delay timer'); p.tags = [T('SW', 'input', 'Enable switch', 'sw'), T('LAMP', 'output', 'Lamp')]
      p.rungs = [Rg([E('XIC', 'SW'), E('TON', 'T1', { preset: 3 })], 'T1 times while SW is on'), Rg([E('XIC', 'T1.DN'), E('OTE', 'LAMP')], 'Lamp follows the timer done bit')]; return p } },
    flasher: { title: 'Flasher (two timers)', note: 'Turn <b>RUN</b> on. The lamp flashes: the two timers hand off to each other every second.', prog: function () {
      var p = C.newProgram('Flasher'); p.tags = [T('RUN', 'input', 'Enable', 'sw'), T('LAMP', 'output', 'Flashing lamp')]
      p.rungs = [Rg([E('XIC', 'RUN'), E('XIO', 'T2.DN'), E('TON', 'T1', { preset: 1 })], 'T1 times 1 s'), Rg([E('XIC', 'T1.DN'), E('TON', 'T2', { preset: 1 })], 'T2 times 1 s more, then resets T1'), Rg([E('XIC', 'RUN'), E('XIO', 'T1.DN'), E('OTE', 'LAMP')], 'Lamp is on during the first second')]; return p } },
    counter: { title: 'Batch counter (5 parts)', note: 'Push <b>SENSOR</b> five times. The <b>FULL</b> light comes on at 5. Push <b>RESET</b> to start again.', prog: function () {
      var p = C.newProgram('Batch counter'); p.tags = [T('SENSOR', 'input', 'Part sensor', 'pb'), T('RESET', 'input', 'Reset pushbutton', 'pb'), T('FULL', 'output', 'Batch complete light')]
      p.rungs = [Rg([E('XIC', 'SENSOR'), E('CTU', 'C1', { preset: 5 })], 'Count each part'), Rg([E('XIC', 'C1.DN'), E('OTE', 'FULL')], 'Light when the count is reached'), Rg([E('XIC', 'RESET'), E('RES', 'C1')], 'Reset the counter')]; return p } },
    fwdrev: { title: 'Forward / reverse with interlock', note: 'Press <b>FWD</b> or <b>REV</b>. Each direction seals in, and the other direction\'s NC contact stops both contactors ever being on at once (a phase-to-phase short if they were).', prog: function () {
      var p = C.newProgram('Forward reverse'); p.tags = [T('FWD_PB', 'input', 'Forward pushbutton', 'pb'), T('REV_PB', 'input', 'Reverse pushbutton', 'pb'), T('STOP', 'input', 'Stop pushbutton', 'pb'), T('FWD', 'output', 'Forward contactor'), T('REV', 'output', 'Reverse contactor')]
      p.rungs = [Rg([P([S([E('XIC', 'FWD_PB')]), S([E('XIC', 'FWD')])]), E('XIO', 'STOP'), E('XIO', 'REV'), E('OTE', 'FWD')], 'Forward, interlocked against reverse'), Rg([P([S([E('XIC', 'REV_PB')]), S([E('XIC', 'REV')])]), E('XIO', 'STOP'), E('XIO', 'FWD'), E('OTE', 'REV')], 'Reverse, interlocked against forward')]; return p } },
    latch: { title: 'Latch and unlatch (alarm)', note: 'Switch <b>FAULT</b> on then off: the <b>ALARM</b> stays on (latched). Push <b>ACK</b> to clear it.', prog: function () {
      var p = C.newProgram('Latching alarm'); p.tags = [T('FAULT', 'input', 'Fault sensor', 'sw'), T('ACK', 'input', 'Acknowledge', 'pb'), T('ALARM', 'output', 'Alarm horn')]
      p.rungs = [Rg([E('XIC', 'FAULT'), E('OTL', 'ALARM')], 'Latch the alarm on'), Rg([E('XIC', 'ACK'), E('XIO', 'FAULT'), E('OTU', 'ALARM')], 'Clear only when acknowledged and the fault is gone')]; return p } },
    startup: { title: 'Sequence: motor 2 starts 5 s after motor 1', note: 'Press <b>START</b>. Motor 1 runs at once and motor 2 follows after 5 seconds. STOP kills both.', prog: function () {
      var p = C.newProgram('Delayed start'); p.tags = [T('START', 'input', 'Start', 'pb'), T('STOP', 'input', 'Stop', 'pb'), T('M1', 'output', 'Motor 1'), T('M2', 'output', 'Motor 2')]
      p.rungs = [Rg([P([S([E('XIC', 'START')]), S([E('XIC', 'M1')])]), E('XIO', 'STOP'), E('OTE', 'M1')], 'Motor 1 start / stop'), Rg([E('XIC', 'M1'), E('TON', 'T1', { preset: 5 })], 'Time 5 s after M1 starts'), Rg([E('XIC', 'T1.DN'), E('OTE', 'M2')], 'Motor 2 follows')]; return p } }
  }

  /* ---------- exports ---------- */
  function dl(name, text, mime) { var b = new Blob([text], { type: mime || 'text/plain' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove() }, 500) }
  function fname(ext) { return 'voltce-' + String(prog.name || 'ladder').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + ext }
  function doExport(k) {
    if (!k) return
    if (!prog.rungs.length) return setNote('Add at least one rung before exporting.')
    if (k === 'st') dl(fname('.st'), C.toST(prog), 'text/plain')
    else if (k === 'openplc') dl(fname('-openplc.st'), C.toST(prog, { openplc: true }), 'text/plain')
    else if (k === 'il') dl(fname('.txt'), '// ' + (prog.name || 'Program') + ' - VoltCE Ladder Logic instruction list\n' + C.mnemonic(prog) + '\n', 'text/plain')
    else if (k === 'csv') dl(fname('-tags.csv'), C.tagsCSV(prog), 'text/csv')
    else if (k === 'json') dl(fname('.json'), JSON.stringify(prog, null, 2), 'application/json')
    else if (k === 'svg') dl(fname('.svg'), renderSVG(true).svg, 'image/svg+xml')
    else if (k === 'png' || k === 'print') {
      var r = renderSVG(true), img = new Image(), url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.svg)
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = r.w * 2; c.height = r.h * 2; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height)
        if (k === 'png') c.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fname('.png'); document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove() }, 500) }, 'image/png')
        else { var w = window.open('', '_blank'); if (w) { w.document.write('<title>' + esc(prog.name) + '</title><body style="margin:0"><img src="' + c.toDataURL('image/png') + '" style="width:100%">'); w.document.close(); setTimeout(function () { w.print() }, 300) } }
      }
      img.src = url
    }
  }

  /* ---------- public ---------- */
  window.Ladder = {
    mount: function (host) {
      if (mounted === host) return
      build(host); mounted = host
      var saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || 'null') } catch (e) { }
      if (saved && saved.prog && saved.prog.rungs && saved.prog.rungs.length) { load(saved.prog, saved.name); setNote('Restored your last program.') } else { load(EXAMPLES.seal.prog(), 'seal'); setNote(EXAMPLES.seal.note) }
    },
    load: load, model: function () { return prog }, runtime: function () { return R }, run: function (v) { if (v !== running) toggleRun() }, setInput: function (n, v) { ins[n] = !!v; paintIO() }, tick: tickOnce, examples: function () { return Object.keys(EXAMPLES) }, loadExample: function (k) { load(EXAMPLES[k].prog(), k); setNote(EXAMPLES[k].note) }, select: function (id) { sel = id; render() }, insert: insert, exportSVG: function () { return renderSVG(true).svg }
  }
})()
