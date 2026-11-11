/* VoltCE Ladder Logic: program model, scan engine and exporters (pure logic, no DOM). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.LadderCore = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'
  var uidN = 1
  function uid(p) { return (p || 'n') + (uidN++) }
  var KINDS = {
    XIC: { label: 'Examine if closed', short: 'XIC', cat: 'input', desc: 'True when the bit is on (a normally open contact).' },
    XIO: { label: 'Examine if open', short: 'XIO', cat: 'input', desc: 'True when the bit is off (a normally closed contact).' },
    ONS: { label: 'One-shot', short: 'ONS', cat: 'input', desc: 'Passes power for one scan on each rising edge.' },
    CMP: { label: 'Compare', short: 'CMP', cat: 'input', desc: 'Compares a timer or counter value (for example C1.ACC) to a number.' },
    OTE: { label: 'Output energize', short: 'OTE', cat: 'output', desc: 'Turns the bit on while the rung is true.' },
    OTL: { label: 'Output latch', short: 'OTL', cat: 'output', desc: 'Sets the bit on and keeps it on.' },
    OTU: { label: 'Output unlatch', short: 'OTU', cat: 'output', desc: 'Clears a latched bit.' },
    TON: { label: 'Timer on-delay', short: 'TON', cat: 'output', desc: 'Counts while true. DN turns on when the preset is reached.' },
    TOF: { label: 'Timer off-delay', short: 'TOF', cat: 'output', desc: 'DN is on while true and stays on for the preset after the rung goes false.' },
    CTU: { label: 'Count up', short: 'CTU', cat: 'output', desc: 'Counts each false-to-true change. DN turns on at the preset.' },
    CTD: { label: 'Count down', short: 'CTD', cat: 'output', desc: 'Counts down on each false-to-true change. DN is on at or below zero.' },
    RES: { label: 'Reset', short: 'RES', cat: 'output', desc: 'Resets a timer or counter to zero.' }
  }
  var OPS = { EQU: ['=', '='], NEQ: ['<>', '<>'], GRT: ['>', '>'], GEQ: ['>=', '>='], LES: ['<', '<'], LEQ: ['<=', '<='] }

  function newSeries(nodes) { return { id: uid('s'), nodes: nodes || [] } }
  function elem(kind, tag, extra) { var e = { id: uid('n'), t: 'elem', kind: kind, tag: tag || '' }; if (extra) for (var k in extra) e[k] = extra[k]; if ((kind === 'TON' || kind === 'TOF') && e.preset === undefined) e.preset = 3; if ((kind === 'CTU' || kind === 'CTD') && e.preset === undefined) e.preset = 5; if (kind === 'CMP') { e.op = e.op || 'GEQ'; if (e.value === undefined) e.value = 1 } return e }
  function par(branches) { return { id: uid('n'), t: 'par', branches: branches } }
  function rung(nodes, comment) { var s = newSeries(nodes); s.comment = comment || ''; return s }
  function newProgram(name) { return { name: name || 'Program', rungs: [], tags: [] } }
  function tag(name, kind, comment, dev) { var t = { name: name, kind: kind, comment: comment || '' }; if (dev) t.dev = dev; return t }

  /* make sure every series/node has a unique id (after loading JSON) */
  function normalize(p) {
    var seen = {}
    function fixId(o, pre) { if (!o.id || seen[o.id]) o.id = uid(pre); seen[o.id] = 1 }
    function ser(s) { fixId(s, 's'); (s.nodes = s.nodes || []).forEach(function (n) { fixId(n, 'n'); if (n.t === 'par') (n.branches = n.branches || []).forEach(ser) }) }
    p.rungs = p.rungs || []; p.tags = p.tags || []; p.rungs.forEach(ser)
    return p
  }

  function split(t) { var i = String(t).indexOf('.'); return i < 0 ? [String(t), ''] : [t.slice(0, i), t.slice(i + 1).toUpperCase()] }

  /* ---------- runtime ---------- */
  function Runtime(prog) {
    var R = { prog: prog, bits: {}, timers: {}, counters: {}, onsPrev: {}, power: {}, scans: 0, time: 0 }
    function timer(n, preset) { return R.timers[n] || (R.timers[n] = { acc: 0, dn: false, en: false, tt: false, preset: preset || 0 }) }
    function counter(n, preset) { return R.counters[n] || (R.counters[n] = { acc: 0, dn: false, preset: preset || 0, prev: false }) }
    R.reset = function () { R.bits = {}; R.timers = {}; R.counters = {}; R.onsPrev = {}; R.power = {}; R.scans = 0; R.time = 0 }
    R.read = function (t) {
      var s = split(t), n = s[0], m = s[1]
      if (m) {
        var tm = R.timers[n], ct = R.counters[n]
        if (tm) return m === 'DN' ? tm.dn : m === 'EN' ? tm.en : m === 'TT' ? tm.tt : m === 'ACC' ? tm.acc : m === 'PRE' ? tm.preset : false
        if (ct) return m === 'DN' ? ct.dn : m === 'ACC' ? ct.acc : m === 'PRE' ? ct.preset : false
        return m === 'ACC' || m === 'PRE' ? 0 : false
      }
      return !!R.bits[n]
    }
    R.set = function (n, v) { R.bits[n] = !!v }
    function evalElem(e, p) {
      var k = e.kind, t = e.tag, s, c
      switch (k) {
        case 'XIC': return p && R.read(t)
        case 'XIO': return p && !R.read(t)
        case 'CMP': { var a = +R.read(e.tag) || 0, b = +e.value || 0, ok = e.op === 'EQU' ? a === b : e.op === 'NEQ' ? a !== b : e.op === 'GRT' ? a > b : e.op === 'GEQ' ? a >= b : e.op === 'LES' ? a < b : a <= b; return p && ok }
        case 'ONS': { var prev = !!R.onsPrev[e.id]; R.onsPrev[e.id] = !!p; return p && !prev }
        case 'OTE': R.bits[t] = !!p; return p
        case 'OTL': if (p) R.bits[t] = true; return p
        case 'OTU': if (p) R.bits[t] = false; return p
        case 'TON': s = timer(t, e.preset); s.preset = +e.preset || 0
          if (p) { s.en = true; s.acc = Math.min(s.preset, s.acc + R.dt); s.dn = s.acc >= s.preset; s.tt = !s.dn } else { s.en = false; s.acc = 0; s.dn = false; s.tt = false }
          return p
        case 'TOF': s = timer(t, e.preset); s.preset = +e.preset || 0
          if (p) { s.en = true; s.dn = true; s.acc = 0; s.tt = false } else { s.en = false; if (s.dn) { s.acc += R.dt; s.tt = true; if (s.acc >= s.preset) { s.dn = false; s.tt = false; s.acc = s.preset } } }
          return p
        case 'CTU': c = counter(t, e.preset); c.preset = +e.preset || 0; if (p && !c.prev) { c.acc++ } c.prev = !!p; c.dn = c.acc >= c.preset; return p
        case 'CTD': c = counter(t, e.preset); c.preset = +e.preset || 0; if (R.counters[t] && !c.init) { c.init = true; c.acc = c.preset } if (p && !c.prev) { c.acc-- } c.prev = !!p; c.dn = c.acc <= 0; return p
        case 'RES': if (p) { if (R.timers[t]) { R.timers[t].acc = 0; R.timers[t].dn = false; R.timers[t].tt = false; R.timers[t].en = false } if (R.counters[t]) { var cc = R.counters[t]; cc.acc = cc.init ? cc.preset : 0; cc.dn = cc.init ? false : false } } return p
      }
      return p
    }
    function evalSeries(ser, p) {
      var inP = p
      ser.nodes.forEach(function (n) {
        var before = p
        if (n.t === 'par') { var outs = n.branches.map(function (b) { return evalSeries(b, before) }); p = outs.some(Boolean) }
        else p = evalElem(n, p)
        R.power[n.id] = { i: !!before, o: !!p }
      })
      R.power[ser.id] = { i: !!inP, o: !!p }
      return p
    }
    R.step = function (dt) {
      R.dt = dt == null ? 0.02 : dt
      prog.rungs.forEach(function (r) { evalSeries(r, true) })
      R.scans++; R.time += R.dt
    }
    return R
  }

  /* ---------- text exports ---------- */
  function mnemonic(prog) {
    function node(n) {
      if (n.t === 'par') return '[' + n.branches.map(ser).join(' ,') + ' ]'
      var a = n.kind + '(' + (n.tag || '?')
      if (n.kind === 'TON' || n.kind === 'TOF' || n.kind === 'CTU' || n.kind === 'CTD') a += ',' + n.preset
      if (n.kind === 'CMP') a = 'CMP(' + (n.tag || '?') + ' ' + n.op + ' ' + n.value
      return a + ')'
    }
    function ser(s) { return s.nodes.map(node).join('') }
    return prog.rungs.map(function (r, i) { return (r.comment ? '// Rung ' + i + ': ' + r.comment + '\n' : '') + 'N: ' + ser(r) + ';' }).join('\n')
  }

  var RESERVED = 'IN,OUT,AT,IF,THEN,ELSE,END_IF,FOR,TO,DO,BY,WHILE,REPEAT,UNTIL,CASE,OF,VAR,END_VAR,TRUE,FALSE,AND,OR,XOR,NOT,MOD,PROGRAM,END_PROGRAM,TASK,TIME,BOOL,INT,REAL,TON,TOF,TP,CTU,CTD,R_TRIG,F_TRIG,R,S,Q,PT,ET,PV,CV,CU,CD,LD,CLK,EXIT,RETURN,FUNCTION,TYPE,STRUCT,ARRAY,STRING,WORD,DINT'.split(',')
  function ident(n) { var s = String(n).replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1'); if (RESERVED.indexOf(s.toUpperCase()) >= 0) s += '_'; return s }
  function tagInfo(prog) {
    var map = {}; prog.tags.forEach(function (t) { map[t.name] = t })
    return map
  }
  function collectTags(prog) {
    var used = {}, order = []
    function add(n, kind) { if (!n) return; var b = split(n)[0]; if (!used[b]) { used[b] = { kind: kind || null }; order.push(b) } else if (kind && !used[b].kind) used[b].kind = kind }
    function ser(s) { s.nodes.forEach(function (n) { if (n.t === 'par') n.branches.forEach(ser); else { var k = n.kind; if (k === 'TON' || k === 'TOF') add(n.tag, 'timer'); else if (k === 'CTU' || k === 'CTD') add(n.tag, 'counter'); else if (k === 'RES') add(n.tag, null); else if (k === 'ONS') { } else if (k === 'CMP') add(n.tag, null); else add(n.tag, null) } }) }
    prog.rungs.forEach(ser)
    return { used: used, order: order }
  }

  function toST(prog, opts) {
    opts = opts || {}
    var info = tagInfo(prog), ct = collectTags(prog), lines = [], decls = { input: [], output: [], mem: [], timer: [], counter: [], ons: [] }
    var kindOf = function (b) { var t = info[b]; if (t) return t.kind; return ct.used[b] && ct.used[b].kind || 'memory' }
    var inI = 0, outI = 0, stmts = [], onsN = 0, resExpr = {}
    // reset expressions per counter/timer
    function cond(a, b) { if (a === 'TRUE') return b; if (b === 'TRUE') return a; return a + ' AND ' + b }
    function wrap(s) { return /[ ]/.test(s) && !/^\(.*\)$/.test(s) ? '(' + s + ')' : s }
    var onsDecl = {}
    function lit(e) { var b = split(e.tag), id = ident(b[0]) + (b[1] ? '.' + (b[1] === 'DN' ? 'Q' : b[1] === 'ACC' ? (kindOf(b[0]) === 'timer' ? 'ET' : 'CV') : b[1] === 'TT' ? 'Q' : b[1]) : ''); if (b[1] === 'DN' && kindOf(b[0]) === 'timer' && stmts.__tof && stmts.__tof[b[0]]) id = ident(b[0]) + '.Q'; return id }
    // first pass: find resets
    function scanRes(s) { s.nodes.forEach(function (n) { if (n.t === 'par') n.branches.forEach(scanRes) }) }
    var resFor = {}
    function walkRes(s, c) { var cur = c; s.nodes.forEach(function (n) { if (n.t === 'par') { var outs = n.branches.map(function (b) { return walkRes(b, cur) }); cur = outs.length ? '(' + outs.join(') OR (') + ')' : cur } else cur = stepCond(n, cur, true) }) ; return cur }
    var emitRes = true
    function stepCond(n, c, resPass) {
      var k = n.kind
      if (k === 'XIC') return cond(c, lit(n))
      if (k === 'XIO') return cond(c, 'NOT ' + lit(n))
      if (k === 'CMP') return cond(c, '(' + lit(n) + ' ' + OPS[n.op][0] + ' ' + n.value + ')')
      if (k === 'ONS') { if (resPass) return c; var nm = 'ons' + (++onsN); decls.ons.push(nm); stmts.push(nm + '(CLK := ' + c + ');'); return nm + '.Q' }
      if (resPass) { if (k === 'RES') { var b = ident(split(n.tag)[0]); (resFor[b] = resFor[b] || []).push(c) } return c }
      var id = ident(split(n.tag || '?')[0])
      switch (k) {
        case 'OTE': stmts.push(id + ' := ' + c + ';'); break
        case 'OTL': stmts.push('IF ' + c + ' THEN ' + id + ' := TRUE; END_IF;'); break
        case 'OTU': stmts.push('IF ' + c + ' THEN ' + id + ' := FALSE; END_IF;'); break
        case 'TON': stmts.push(id + '(IN := ' + c + ', PT := T#' + Math.round((+n.preset || 0) * 1000) + 'ms);'); break
        case 'TOF': stmts.push(id + '(IN := ' + c + ', PT := T#' + Math.round((+n.preset || 0) * 1000) + 'ms);'); break
        case 'CTU': stmts.push(id + '(CU := ' + c + ', R := ' + (resFor[id] ? '(' + resFor[id].join(') OR (') + ')' : 'FALSE') + ', PV := ' + (+n.preset || 0) + ');'); break
        case 'CTD': stmts.push(id + '(CD := ' + c + ', LD := ' + (resFor[id] ? '(' + resFor[id].join(') OR (') + ')' : 'FALSE') + ', PV := ' + (+n.preset || 0) + ');'); break
        case 'RES': break
      }
      return c
    }
    // pass 1 for resets
    prog.rungs.forEach(function (r) { walkRes(r, 'TRUE') })
    function walk(s, c) {
      var cur = c
      s.nodes.forEach(function (n) {
        if (n.t === 'par') {
          var outs = n.branches.map(function (b) { return walk(b, cur) })
          var uniq = outs.filter(function (x, i) { return outs.indexOf(x) === i })
          cur = uniq.length === 1 ? uniq[0] : '(' + uniq.map(wrap).join(' OR ') + ')'
        } else cur = stepCond(n, cur, false)
      })
      return cur
    }
    prog.rungs.forEach(function (r, i) { stmts.push('(* Rung ' + i + (r.comment ? ': ' + r.comment : '') + ' *)'); walk(r, 'TRUE'); stmts.push('') })
    // declarations
    ct.order.forEach(function (b) {
      var k = kindOf(b), id = ident(b)
      if (k === 'input') decls.input.push(id); else if (k === 'output') decls.output.push(id)
      else if (k === 'timer') { var isTof = false; prog.rungs.forEach(function f(s) { s.nodes.forEach(function (n) { if (n.t === 'par') n.branches.forEach(f); else if (n.kind === 'TOF' && ident(split(n.tag)[0]) === id) isTof = true }) }); decls.timer.push([id, isTof ? 'TOF' : 'TON']) }
      else if (k === 'counter') { var isD = false; prog.rungs.forEach(function f(s) { s.nodes.forEach(function (n) { if (n.t === 'par') n.branches.forEach(f); else if (n.kind === 'CTD' && ident(split(n.tag)[0]) === id) isD = true }) }); decls.counter.push([id, isD ? 'CTD' : 'CTU']) }
      else decls.mem.push(id)
    })
    var name = ident(prog.name || 'Program')
    var o = []
    o.push('(* ' + (prog.name || 'Program') + ' : exported from VoltCE Ladder Logic *)')
    o.push('(* IEC 61131-3 Structured Text. Boolean logic is the same as the ladder rungs. *)')
    o.push('PROGRAM ' + name)
    if (decls.input.length) { o.push('  VAR_INPUT'); decls.input.forEach(function (n, i) { o.push('    ' + n + (opts.openplc ? ' AT %IX0.' + i : '') + ' : BOOL;') }); o.push('  END_VAR') }
    if (decls.output.length) { o.push('  VAR_OUTPUT'); decls.output.forEach(function (n, i) { o.push('    ' + n + (opts.openplc ? ' AT %QX0.' + i : '') + ' : BOOL;') }); o.push('  END_VAR') }
    var hasVar = decls.mem.length || decls.timer.length || decls.counter.length || decls.ons.length
    if (hasVar) {
      o.push('  VAR')
      decls.mem.forEach(function (n) { o.push('    ' + n + ' : BOOL;') })
      decls.timer.forEach(function (t) { o.push('    ' + t[0] + ' : ' + t[1] + ';') })
      decls.counter.forEach(function (t) { o.push('    ' + t[0] + ' : ' + t[1] + ';') })
      decls.ons.forEach(function (n) { o.push('    ' + n + ' : R_TRIG;') })
      o.push('  END_VAR')
    }
    o.push('')
    stmts.forEach(function (s) { o.push(s ? '  ' + s : '') })
    o.push('END_PROGRAM')
    if (opts.openplc) {
      o.push('', 'CONFIGURATION Config0', '  RESOURCE Res0 ON PLC', '    TASK task0(INTERVAL := T#20ms, PRIORITY := 0);', '    PROGRAM instance0 WITH task0 : ' + name + ';', '  END_RESOURCE', 'END_CONFIGURATION')
    }
    return o.join('\n')
  }

  function tagsCSV(prog) {
    var info = tagInfo(prog), ct = collectTags(prog), rows = ['Name,Type,Address,Comment'], i = 0, q = 0
    var seen = {}
    prog.tags.forEach(function (t) { seen[t.name] = 1 })
    var all = prog.tags.slice(); ct.order.forEach(function (b) { if (!seen[b]) all.push({ name: b, kind: ct.used[b].kind || 'memory', comment: '' }) })
    all.forEach(function (t) { var addr = t.kind === 'input' ? '%IX0.' + (i++) : t.kind === 'output' ? '%QX0.' + (q++) : ''; rows.push([t.name, t.kind, addr, t.comment || ''].map(function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v }).join(',')) })
    return rows.join('\n')
  }

  function validate(prog) {
    var out = [], info = tagInfo(prog), ct = collectTags(prog), outs = {}
    prog.rungs.forEach(function (r, i) {
      var has = false, empty = false
      ;(function f(s) { if (!s.nodes.length) empty = true; s.nodes.forEach(function (n) { if (n.t === 'par') n.branches.forEach(f); else { if (KINDS[n.kind].cat === 'output') has = true; if (!n.tag) out.push({ rung: i, msg: 'Rung ' + i + ': an instruction has no tag.' }); if (n.kind === 'OTE') { if (outs[n.tag] !== undefined && outs[n.tag] !== i) out.push({ rung: i, msg: 'Output ' + n.tag + ' is energized in rungs ' + outs[n.tag] + ' and ' + i + '. The last one wins; use OTL/OTU or merge them.' }); outs[n.tag] = i } } }) })(r)
      if (!has) out.push({ rung: i, msg: 'Rung ' + i + ' has no output.' })
    })
    return out
  }

  return { KINDS: KINDS, OPS: OPS, newProgram: newProgram, newSeries: newSeries, elem: elem, par: par, rung: rung, tag: tag, Runtime: Runtime, mnemonic: mnemonic, toST: toST, tagsCSV: tagsCSV, validate: validate, normalize: normalize, split: split, collectTags: collectTags, uid: uid }
})
