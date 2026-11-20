/* VoltCE test-taking process: article recall, keyword index drill, and a mock test run with the three-pass method.
   Study method by Matthew Timler. Uses window.ART_NAMES, IDX_BANK and CODE_BANK. Progress is saved in localStorage (best effort). */
(function () {
  'use strict'
  var KEY = 'vc_proc_v1', GOAL = 80, ART_PASS = 90, IDX_PASS = 80
  var root, S = { tab: 'method', art: null, idx: null, mock: null, data: { art: 0, idx: 0, mocks: [] } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t } return a }
  function load() { try { var d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d) S.data = Object.assign(S.data, d) } catch (e) {} }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S.data)) } catch (e) {} }
  function arts(major) { return (window.ART_NAMES || []).filter(function (a) { return !major || a.m }) }
  function loadBank(file, glob, cb) {
    if (window[glob]) return cb()
    var sc = document.createElement('script'); sc.src = file; sc.onload = cb
    sc.onerror = function () { root.querySelector('.pr-body').innerHTML = '<p class="pr-warn">Could not load the question bank. Check your connection and reload.</p>' }
    document.head.appendChild(sc)
  }

  /* ---------- shell ---------- */
  var TABS = [['method', 'The method'], ['art', '1. Know the articles'], ['idx', '2. Keyword index'], ['mock', '3. Mock test'], ['done', 'Your progress']]
  function shell() {
    var d = S.data
    var chk = function (id) { return (id === 'art' && d.art >= ART_PASS) || (id === 'idx' && d.idx >= IDX_PASS) || (id === 'mock' && d.mocks.some(function (m) { return m.act >= GOAL })) ? ' &#10003;' : '' }
    root.innerHTML = '<div class="pr-wrap"><div class="pr-tabs" role="tablist">' + TABS.map(function (t) { return '<button role="tab" class="pr-tab' + (S.tab === t[0] ? ' on' : '') + '" aria-selected="' + (S.tab === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + chk(t[0]) + '</button>' }).join('') + '</div><div class="pr-body"></div></div>'
    root.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { go(b.getAttribute('data-tab')) } })
  }
  function go(t) { S.tab = t; shell(); view(); window.scrollTo(0, 0) }
  function view() { var b = root.querySelector('.pr-body'); ({ method: method, art: artView, idx: idxView, mock: mockView, done: doneView })[S.tab](b) }

  /* ---------- the method ---------- */
  function method(b) {
    b.innerHTML = '<div class="pr-card"><h2>A test-taking process you can repeat</h2><p>This is a method for passing the journeyman or master exam, whether you take it on a computer or on paper. It is built around one idea: <b>stop flipping through the code book</b>. Know where you are going before you open it, and open it once per section, not once per question.</p>' +
      '<p class="pr-muted">Study method created by Matthew Timler, a master electrician licensed in many states. VoltCE practice questions are study practice, not official exam questions.</p></div>' +
      step(1, 'Know the major articles from memory', 'Hear "250" and think grounding. Hear "430" and think motors. If you already know where you are going, you spend your time reading the right page instead of hunting for it.', 'art') +
      step(2, 'Learn the keyword index', 'Know what the question is really asking, pick the word you would look up, and use the index to find the <b>subsection</b>, not just the article. Choose the sub-entry under the keyword so you land on the exact spot. Skimming pages is the biggest time waster.', 'idx') +
      '<div class="pr-card"><div class="pr-n">3</div><h3>Take the test in three passes</h3><ol class="pr-steps">' +
      '<li><b>Read the whole test front to back.</b> Answer every question you know right away. Do not go back to them and do not think about them twice. Mark each one as a <b>gimme</b> and keep a running count.</li>' +
      '<li><b>Answer the ones you think you know,</b> and mark them with a star or circle so you can check them later.</li>' +
      '<li><b>Write the article you expect each one to be in</b> next to it, in the test notes or on scratch paper. Do this for the questions where a keyword stands out, not for every question.</li>' +
      '<li><b>Group the questions by article.</b> When you open a section you can pick off 2, 3, 5, even 10 questions in one visit.</li>' +
      '<li><b>Keep the keyword index and your section bookmarked</b> with a pencil, paper or tab so you can jump back and forth quickly.</li>' +
      '<li><b>Count only what you are certain of.</b> Certain means you found it word for word in the code, or you know it is a theory question. By the end you should be able to say you are sure of about 80 percent.</li></ol>' +
      '<p>Done this way, you finish well ahead of the clock and your confidence comes from a number you can see, not a feeling.</p><button class="pr-btn pr-primary" data-tab="art">Start with step 1</button></div>'
    b.querySelectorAll('[data-tab]').forEach(function (x) { x.onclick = function () { go(x.getAttribute('data-tab')) } })
  }
  function step(n, t, p, tab) { return '<div class="pr-card"><div class="pr-n">' + n + '</div><h3>' + t + '</h3><p>' + p + '</p><button class="pr-btn" data-tab="' + tab + '">Practice this step</button></div>' }

  /* ---------- step 1: article recall ---------- */
  function artView(b) {
    var A = S.art
    if (!A) {
      b.innerHTML = '<div class="pr-card"><h2>Know the articles</h2><p>Twenty quick questions. Some give the article number and ask what it covers; others give the topic and ask for the number. A score of ' + ART_PASS + ' percent or better means you know them.</p>' +
        '<div class="pr-row"><label><input type="radio" name="sc" value="1" checked> The 36 major articles</label> <label><input type="radio" name="sc" value="0"> All ' + arts().length + ' articles</label></div>' +
        '<p class="pr-muted">Best so far: ' + (S.data.art ? S.data.art + '%' : 'none yet') + '</p><button class="pr-btn pr-primary" id="go">Start</button></div>' + artRef()
      b.querySelector('#go').onclick = function () {
        var major = b.querySelector('input[name=sc]:checked').value === '1', pool = arts(major)
        var qs = shuffle(pool).slice(0, 20).map(function (a, i) {
          var rev = i % 2 === 1, others = shuffle(pool.filter(function (x) { return x.n !== a.n })).slice(0, 3)
          var opts = shuffle([a].concat(others))
          return { a: a, rev: rev, opts: opts, pick: -1 }
        })
        S.art = { qs: qs, i: 0, score: 0, t0: Date.now() }; artView(b)
      }
      return
    }
    if (A.i >= A.qs.length) {
      var pct = Math.round(100 * A.score / A.qs.length), secs = Math.round((Date.now() - A.t0) / 1000)
      if (pct > S.data.art) { S.data.art = pct; save() }
      b.innerHTML = '<div class="pr-card pr-center"><div class="pr-score ' + (pct >= ART_PASS ? 'ok' : 'no') + '">' + pct + '%</div><p>' + A.score + ' of ' + A.qs.length + ' right in ' + secs + ' seconds (' + Math.round(secs / A.qs.length) + ' s each).</p><p>' + (pct >= ART_PASS ? 'You know your articles. Move on to the keyword index.' : 'Review the list below and try again. Aim for ' + ART_PASS + '%.') + '</p><div class="pr-row pr-c"><button class="pr-btn" id="again">Try again</button><button class="pr-btn pr-primary" id="nx">Next: keyword index</button></div></div>' + artRef()
      b.querySelector('#again').onclick = function () { S.art = null; shell(); artView(b) }
      b.querySelector('#nx').onclick = function () { S.art = null; go('idx') }
      return
    }
    var q = A.qs[A.i], a = q.a, done = q.pick >= 0
    var stem = q.rev ? 'Which article covers <b>' + esc(a.t) + '</b>?' : 'What does <b>Article ' + a.n + '</b> cover?'
    b.innerHTML = '<div class="pr-card"><div class="pr-muted">Question ' + (A.i + 1) + ' of ' + A.qs.length + '</div><h3>' + stem + '</h3><div class="pr-opts">' + q.opts.map(function (o, i) {
      var cls = done ? (o.n === a.n ? ' good' : i === q.pick ? ' bad' : '') : ''
      return '<button class="pr-opt' + cls + '" data-i="' + i + '"' + (done ? ' disabled' : '') + '>' + (q.rev ? 'Article ' + o.n : esc(o.t)) + '</button>'
    }).join('') + '</div>' + (done ? '<p class="pr-fb">' + (q.opts[q.pick].n === a.n ? '<b>Right.</b> ' : '<b>Not quite.</b> ') + 'Article ' + a.n + ' is ' + esc(a.t) + '.' + (a.h ? ' ' + esc(a.h) + '.' : '') + '</p><button class="pr-btn pr-primary" id="nx">Next</button>' : '') + '</div>'
    b.querySelectorAll('.pr-opt').forEach(function (x) { x.onclick = function () { q.pick = +x.getAttribute('data-i'); if (q.opts[q.pick].n === a.n) A.score++; artView(b) } })
    var nx = b.querySelector('#nx'); if (nx) { nx.onclick = function () { A.i++; artView(b) }; nx.focus() }
  }
  function artRef() {
    return '<details class="pr-card"><summary>Study list: the 36 major articles</summary><table class="pr-tbl"><tbody>' + arts(true).map(function (a) { return '<tr><th>' + a.n + '</th><td>' + esc(a.t) + '</td><td class="pr-muted">' + esc(a.h || '') + '</td></tr>' }).join('') + '</tbody></table></details>'
  }

  /* ---------- step 2: keyword index ---------- */
  function idxView(b) {
    if (!window.IDX_BANK) { b.innerHTML = '<div class="pr-card">Loading drills…</div>'; return loadBank('index-bank.js', 'IDX_BANK', function () { idxView(root.querySelector('.pr-body')) }) }
    var X = S.idx
    if (!X) {
      b.innerHTML = '<div class="pr-card"><h2>Keyword index drill</h2><p>Ten questions. For each one, first pick the keyword you would look up in the index. Then pick the section you would turn to. You only score a point when both are right. A score of ' + IDX_PASS + ' percent or better is the target.</p><p class="pr-muted">Best so far: ' + (S.data.idx ? S.data.idx + '%' : 'none yet') + '</p><button class="pr-btn pr-primary" id="go">Start</button></div>' +
        '<div class="pr-card"><h3>How to use the index well</h3><ul><li>Say what the question is asking in your own words first.</li><li>Pick the noun the Code would use, not your shop slang.</li><li>Under that keyword, choose the <b>sub-entry</b> that matches your situation so you land on the subsection.</li><li>Keep a tab or pencil mark in the index so you can jump back.</li></ul></div>'
      b.querySelector('#go').onclick = function () { S.idx = { qs: shuffle(window.IDX_BANK).slice(0, 10), i: 0, step: 1, k: -1, s: -1, score: 0 }; idxView(b) }
      return
    }
    if (X.i >= X.qs.length) {
      var pct = Math.round(100 * X.score / X.qs.length); if (pct > S.data.idx) { S.data.idx = pct; save() }
      b.innerHTML = '<div class="pr-card pr-center"><div class="pr-score ' + (pct >= IDX_PASS ? 'ok' : 'no') + '">' + pct + '%</div><p>' + X.score + ' of ' + X.qs.length + ' fully correct (keyword and section).</p><div class="pr-row pr-c"><button class="pr-btn" id="again">Try again</button><button class="pr-btn pr-primary" id="nx">Next: mock test</button></div></div>'
      b.querySelector('#again').onclick = function () { S.idx = null; shell(); idxView(b) }
      b.querySelector('#nx').onclick = function () { S.idx = null; go('mock') }
      return
    }
    var q = X.qs[X.i], fin = X.step === 3
    var list = X.step === 1 ? q.k : q.s, right = X.step === 1 ? q.ka : q.sa, sel = X.step === 1 ? X.k : X.s
    b.innerHTML = '<div class="pr-card"><div class="pr-muted">Question ' + (X.i + 1) + ' of ' + X.qs.length + '</div><h3>' + esc(q.q) + '</h3>' +
      (fin ? '' : '<p><b>Step ' + X.step + ':</b> ' + (X.step === 1 ? 'Which keyword would you look up in the index?' : 'Which section do you turn to?') + '</p>') +
      '<div class="pr-opts">' + (fin ? '' : list.map(function (o, i) { return '<button class="pr-opt' + (sel === i ? (i === right ? ' good' : ' bad') : '') + '" data-i="' + i + '"' + (sel >= 0 ? ' disabled' : '') + '>' + esc(o) + '</button>' }).join('')) + '</div>' +
      (X.step === 1 && X.k >= 0 || X.step === 2 && X.s >= 0 || fin ? '' : '') +
      (fin ? '<p class="pr-fb"><b>' + (X.k === q.ka && X.s === q.sa ? 'Both right.' : X.k === q.ka ? 'Right keyword, wrong section.' : X.s === q.sa ? 'Right section, but a better keyword was &ldquo;' + esc(q.k[q.ka]) + '&rdquo;.' : 'Both need another look.') + '</b> ' + esc(q.e) + '</p><p class="pr-muted">Reference: ' + esc(q.r) + '</p><button class="pr-btn pr-primary" id="nx">Next</button>'
        : (sel >= 0 ? '<button class="pr-btn pr-primary" id="nx">Continue</button>' : '')) + '</div>'
    b.querySelectorAll('.pr-opt').forEach(function (x) { x.onclick = function () { var i = +x.getAttribute('data-i'); if (X.step === 1) X.k = i; else X.s = i; idxView(b) } })
    var nx = b.querySelector('#nx'); if (nx) { nx.onclick = function () {
      if (X.step === 1) X.step = 2
      else if (X.step === 2) { X.step = 3; if (X.k === q.ka && X.s === q.sa) X.score++ }
      else { X.i++; X.step = 1; X.k = -1; X.s = -1 }
      idxView(b) }; nx.focus() }
  }

  /* ---------- step 3: mock test with three passes ---------- */
  var LET = 'ABCDEFGH'
  function mockView(b) {
    var M = S.mock
    if (!M) {
      b.innerHTML = '<div class="pr-card"><h2>Mock test: run the process</h2><p>You will get a set of code questions in a fixed order, like a real test. Work through them with the method:</p><ol class="pr-steps"><li>Read front to back. Answer what you know and mark it <b>Gimme</b>. Do not go back.</li><li>Answer what you think you know and mark it <b>Think</b>. Pick the article you expect it to be in.</li><li>Switch to <b>Group by article</b>. Open that section in your own code book, find the answer word for word, and mark it <b>Found in book</b>.</li></ol>' +
        '<p>Only Gimme and Found-in-book count toward your certainty tally. Aim for ' + GOAL + '% certain before you submit.</p>' +
        '<div class="pr-row"><label>Questions <select id="n"><option>20</option><option selected>30</option><option>50</option></select></label> <label>Time per question <select id="sec"><option value="60">1 min</option><option value="90" selected>1.5 min</option><option value="120">2 min</option></select></label></div>' +
        '<p class="pr-muted">Use your own NEC book for the lookups. Questions come from the VoltCE code bank and follow the 2023 NEC.</p><button class="pr-btn pr-primary" id="go">Start the mock test</button></div>'
      b.querySelector('#go').onclick = function () {
        var n = +b.querySelector('#n').value, sec = +b.querySelector('#sec').value
        loadBank('code-bank.js', 'CODE_BANK', function () {
          var qs = shuffle(window.CODE_BANK).slice(0, n).map(function (q, i) { return { id: i, q: q, pick: -1, tag: '', guess: '', found: false } })
          S.mock = { qs: qs, t0: Date.now(), limit: n * sec, view: 'order', done: false }; mockView(root.querySelector('.pr-body')); tick()
        })
      }
      return
    }
    if (M.done) return mockResult(b, M)
    var c = counts(M)
    var head = '<div class="pr-sticky"><div class="pr-tally"><span><b>' + c.gimme + '</b> gimme</span><span><b>' + c.think + '</b> think</span><span><b>' + c.found + '</b> found in book</span><span><b>' + c.blank + '</b> not answered</span><span class="pr-clock" id="clock"></span></div>' +
      '<div class="pr-meter" aria-label="certainty"><div class="pr-fill" style="width:' + Math.min(100, c.sure) + '%"></div><div class="pr-goal" style="left:' + GOAL + '%"></div></div><div class="pr-muted">Certain of ' + c.sure + '% (goal ' + GOAL + '%). Only gimmes and answers found in the book count.</div>' +
      '<div class="pr-row"><button class="pr-btn' + (M.view === 'order' ? ' pr-primary' : '') + '" data-v="order">Test order</button><button class="pr-btn' + (M.view === 'group' ? ' pr-primary' : '') + '" data-v="group">Group by article</button><button class="pr-btn" id="sub">Submit test</button></div></div>'
    var body = ''
    if (M.view === 'order') body = M.qs.map(qCard).join('')
    else {
      var g = {}, none = []
      M.qs.forEach(function (x) { if (x.tag === 'gimme') return; if (x.guess) (g[x.guess] = g[x.guess] || []).push(x); else none.push(x) })
      var keys = Object.keys(g).sort(function (a, b) { return g[b].length - g[a].length })
      body = '<p class="pr-muted">Gimmes are hidden. Open each article in your book once and clear every question listed under it.</p>' +
        keys.map(function (k) { return '<h3 class="pr-gh">' + esc(k) + ' <span class="pr-muted">(' + g[k].length + ')</span></h3>' + g[k].map(qCard).join('') }).join('') +
        (none.length ? '<h3 class="pr-gh">No article guessed yet <span class="pr-muted">(' + none.length + ')</span></h3>' + none.map(qCard).join('') : '')
    }
    b.innerHTML = head + '<div id="mq">' + body + '</div>'
    b.querySelectorAll('[data-v]').forEach(function (x) { x.onclick = function () { M.view = x.getAttribute('data-v'); mockView(b) } })
    b.querySelector('#sub').onclick = function () {
      var c2 = counts(M); if (c2.blank && !confirm(c2.blank + ' question(s) are not answered and will count as wrong. Submit anyway?')) return
      M.done = true; M.t1 = Date.now(); mockView(b)
    }
    bindQ(b, M); clock()
  }
  function counts(M) {
    var n = M.qs.length, g = 0, t = 0, f = 0, bl = 0
    M.qs.forEach(function (x) { if (x.pick < 0) bl++; else if (x.tag === 'gimme') g++; else if (x.found) f++; else t++ })
    return { gimme: g, think: t, found: f, blank: bl, sure: Math.round(100 * (g + f) / n) }
  }
  function qCard(x) {
    var q = x.q, lock = x.tag === 'gimme'
    return '<div class="pr-q' + (lock ? ' lock' : '') + '" data-id="' + x.id + '"><div class="pr-qh"><span class="pr-qn">' + (x.id + 1) + '</span>' + esc(q.q) + '</div>' +
      q.o.map(function (o, i) { return '<label class="pr-qo' + (x.pick === i ? ' sel' : '') + '"><input type="radio" name="q' + x.id + '" value="' + i + '"' + (x.pick === i ? ' checked' : '') + (lock ? ' disabled' : '') + '> <b>' + LET[i] + '.</b> ' + esc(o) + '</label>' }).join('') +
      '<div class="pr-marks"><button class="pr-m' + (x.tag === 'gimme' ? ' on g' : '') + '" data-m="gimme"' + (x.pick < 0 ? ' disabled' : '') + '>Gimme</button><button class="pr-m' + (x.tag === 'think' ? ' on t' : '') + '" data-m="think"' + (x.pick < 0 ? ' disabled' : '') + '>&#9733; Think</button>' +
      (x.tag === 'think' ? '<label class="pr-found"><input type="checkbox" data-f="1"' + (x.found ? ' checked' : '') + '> Found in book word for word</label>' : '') +
      (x.tag !== 'gimme' ? '<select class="pr-g" aria-label="Article you expect"><option value="">Article?</option>' + arts().map(function (a) { var v = 'Art. ' + a.n + ' ' + a.t; return '<option value="' + esc(v) + '"' + (x.guess === v ? ' selected' : '') + '>' + a.n + ' ' + esc(a.t) + '</option>' }).join('') + '</select>' : '') +
      (lock ? '<span class="pr-muted">Locked. Do not revisit.</span>' : '') + '</div></div>'
  }
  function bindQ(b, M) {
    b.querySelectorAll('.pr-q').forEach(function (el) {
      var x = M.qs[+el.getAttribute('data-id')]
      el.querySelectorAll('input[type=radio]').forEach(function (r) { r.onchange = function () { x.pick = +r.value; keep(b) } })
      el.querySelectorAll('[data-m]').forEach(function (m) { m.onclick = function () {
        var t = m.getAttribute('data-m'); x.tag = x.tag === t ? '' : t; if (x.tag !== 'think') x.found = false; if (x.tag === 'gimme') x.guess = ''; keep(b) } })
      var f = el.querySelector('[data-f]'); if (f) f.onchange = function () { x.found = f.checked; keep(b) }
      var g = el.querySelector('.pr-g'); if (g) g.onchange = function () { x.guess = g.value; keep(b) }
    })
  }
  function keep(b) { var y = window.scrollY; mockView(b); window.scrollTo(0, y) }
  var timer
  function tick() { clearInterval(timer); timer = setInterval(function () { if (!S.mock || S.mock.done || S.tab !== 'mock') return clearInterval(timer); clock() }, 1000) }
  function clock() {
    var el = document.getElementById('clock'), M = S.mock; if (!el || !M) return
    var used = Math.floor((Date.now() - M.t0) / 1000), left = M.limit - used, m = function (s) { s = Math.abs(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2) }
    el.textContent = (left >= 0 ? m(left) + ' left' : m(left) + ' over') + ' (used ' + m(used) + ')'
    el.className = 'pr-clock' + (left < 0 ? ' over' : '')
  }
  function mockResult(b, M) {
    var n = M.qs.length, c = counts(M), right = 0, grp = { gimme: [0, 0], found: [0, 0], think: [0, 0], blank: [0, 0] }, ah = 0, ag = 0
    M.qs.forEach(function (x) {
      var ok = x.pick === x.q.a, k = x.pick < 0 ? 'blank' : x.tag === 'gimme' ? 'gimme' : x.found ? 'found' : 'think'
      grp[k][1]++; if (ok) { grp[k][0]++; right++ }
      if (x.guess) { ag++; if (x.q.ar && x.guess.replace(/\s+/g, ' ').indexOf(x.q.ar.split(' ').slice(0, 2).join(' ')) === 0) ah++ }
    })
    var act = Math.round(100 * right / n), pred = c.sure, used = Math.round((M.t1 - M.t0) / 1000)
    var predRight = grp.gimme[0] + grp.found[0], predN = grp.gimme[1] + grp.found[1]
    S.data.mocks.push({ d: Date.now(), n: n, pred: pred, act: act, secs: used }); S.data.mocks = S.data.mocks.slice(-20); save()
    var line = function (l, g) { return '<tr><th>' + l + '</th><td>' + g[0] + ' of ' + g[1] + '</td><td>' + (g[1] ? Math.round(100 * g[0] / g[1]) + '%' : '-') + '</td></tr>' }
    var msg = predN === 0 ? 'You marked nothing as certain, so there is no prediction to check. Mark gimmes and found-in-book answers next time.' :
      predRight === predN ? 'Every answer you were certain of was right. That is exactly the calibration this method builds.' :
        'You were certain about ' + predN + ' answers and ' + (predN - predRight) + ' of them were wrong. Look at those first: either the keyword sent you to the wrong section, or you read the wrong table. Tighten what counts as certain.'
    b.innerHTML = '<div class="pr-card pr-center"><div class="pr-score ' + (act >= GOAL ? 'ok' : 'no') + '">' + act + '%</div><p>' + right + ' of ' + n + ' right. You predicted ' + pred + '% certain.</p><p>Time used: ' + Math.floor(used / 60) + ' min of ' + Math.floor(M.limit / 60) + ' min allowed' + (used <= M.limit ? ' (finished early)' : ' (over time)') + '.</p></div>' +
      '<div class="pr-card"><h3>How your marks held up</h3><table class="pr-tbl"><tbody>' + line('Gimme', grp.gimme) + line('Found in book', grp.found) + line('Think (not confirmed)', grp.think) + line('Not answered', grp.blank) + '</tbody></table><p>' + msg + '</p>' +
      (ag ? '<p>Your article guesses matched the question bank\'s article on ' + ah + ' of ' + ag + ' questions.</p>' : '') + '</div>' +
      '<div class="pr-card"><h3>Review</h3>' + (M.qs.filter(function (x) { return x.pick !== x.q.a }).map(function (x) {
        return '<div class="pr-rev"><b>' + (x.id + 1) + '. ' + esc(x.q.q) + '</b><br>Your answer: ' + (x.pick < 0 ? 'none' : LET[x.pick] + '. ' + esc(x.q.o[x.pick])) + '<br>Correct: ' + LET[x.q.a] + '. ' + esc(x.q.o[x.q.a]) + '<br><span class="pr-muted">' + esc(x.q.e || '') + (x.q.ar ? ' (' + esc(x.q.ar) + ')' : '') + '</span></div>' }).join('') || '<p>No misses. Nice.</p>') + '</div>' +
      '<div class="pr-row pr-c"><button class="pr-btn pr-primary" id="again">Take another mock test</button></div>'
    b.querySelector('#again').onclick = function () { S.mock = null; shell(); mockView(root.querySelector('.pr-body')) }
  }

  /* ---------- progress ---------- */
  function doneView(b) {
    var d = S.data
    b.innerHTML = '<div class="pr-card"><h2>Your progress</h2><table class="pr-tbl"><tbody><tr><th>Step 1: article recall</th><td>' + (d.art ? d.art + '% best' : 'not started') + '</td><td>' + (d.art >= ART_PASS ? 'Done' : 'Goal ' + ART_PASS + '%') + '</td></tr>' +
      '<tr><th>Step 2: keyword index</th><td>' + (d.idx ? d.idx + '% best' : 'not started') + '</td><td>' + (d.idx >= IDX_PASS ? 'Done' : 'Goal ' + IDX_PASS + '%') + '</td></tr></tbody></table>' +
      '<h3>Mock tests</h3>' + (d.mocks.length ? '<table class="pr-tbl"><thead><tr><th>Date</th><th>Questions</th><th>Predicted certain</th><th>Actual score</th><th>Time</th></tr></thead><tbody>' + d.mocks.slice().reverse().map(function (m) { return '<tr><td>' + new Date(m.d).toLocaleDateString() + '</td><td>' + m.n + '</td><td>' + m.pred + '%</td><td>' + m.act + '%</td><td>' + Math.round(m.secs / 60) + ' min</td></tr>' }).join('') + '</tbody></table>' : '<p class="pr-muted">No mock tests yet.</p>') +
      '<p class="pr-muted">Saved in this browser only.</p></div>'
  }

  window.Proc = { mount: function (el) { root = el; load(); if (!root.querySelector('.pr-wrap')) { shell(); view() } }, _state: S }
})()
