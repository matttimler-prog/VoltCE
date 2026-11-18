/* VoltCE course player: timed, interactive continuing-education courses.
   Data comes from courses/<slug>.js (window.CourseData). Time is counted only while the learner is active
   (tab visible, recent input, presence checks answered) and, for signed-in learners, is also recorded on the
   server (course_tick), which caps how much time one check-in can add. A certificate is issued by the server
   only after enough recorded time and all module quizzes passed (course_finish). */
(function () {
  'use strict'
  var CFG = { pass: 70, idleSec: 120, presenceMin: 720, presenceMax: 1080, presenceWait: 60, syncEvery: 30, tickMs: 1000, step: 1, slideMin: 150 }
  if (window.__courseTest) for (var k in window.__courseTest) CFG[k] = window.__courseTest[k]
  // Courses approved for CE credit, by state. Empty until a state approves a course.
  // Shape: { 'slug': [{ state: 'Wisconsin', board: 'DSPS', number: '12345' }] }
  var APPROVED = (window.CourseApprovals = window.CourseApprovals || {})

  var D = null, S = null, root = null, timer = null, lastInput = Date.now(), blocked = false, presenceAt = 0, presenceStarted = 0, serverSec = 0, ticks = 0, finishing = false

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function $(sel) { return root && root.querySelector(sel) }
  function hms(s) { s = Math.max(0, Math.round(s)); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h + ':' + (m < 10 ? '0' : '') + m + ':' + (x < 10 ? '0' : '') + x }
  function ms(s) { s = Math.max(0, Math.round(s)); var m = Math.floor(s / 60), x = s % 60; return m + ':' + (x < 10 ? '0' : '') + x }
  function user() { try { return currentUser } catch (e) { return null } }
  function sb() { try { return supabaseClient } catch (e) { return null } }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t } return a }
  function key() { var u = user(); return 'vc_course_' + D.slug + '_' + (u ? u.id : 'guest') }
  function slideSecs(mi) { var m = D.modules[mi]; return Math.max(20, Math.min(CFG.slideMin, Math.floor(m.minutes * 60 * 0.8 / Math.max(1, m.slides.length)))) }
  function modNeed(mi) { return D.modules[mi].minutes * 60 }
  function modDone(mi) { var m = S.mods[mi]; return !!(m && m.passed && m.active >= modNeed(mi)) }
  function allDone() { return D.modules.every(function (_, i) { return modDone(i) }) }
  function approvals() { return APPROVED[D.slug] || [] }
  function needSec() { return D.hours * 3600 * 0.95 }

  // ---------- loading ----------
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error(src)) }; document.head.appendChild(s) }) }
  function ensureCss() { if (document.getElementById('course-css')) return; var l = document.createElement('link'); l.id = 'course-css'; l.rel = 'stylesheet'; l.href = '/course.css?v=1'; document.head.appendChild(l) }

  function fresh() { return { slug: D.slug, mod: 0, slide: 0, phase: 'landing', qi: 0, quiz: null, total: 0, mods: D.modules.map(function () { return { started: false, passed: false, score: 0, active: 0, seen: {}, checks: {}, tries: 0 } }), slideLeft: 0, code: null, done: false } }
  function save() { try { localStorage.setItem(key(), JSON.stringify({ mod: S.mod, slide: S.slide, total: S.total, mods: S.mods, code: S.code, done: S.done, at: Date.now() })) } catch (e) {} }
  function restoreLocal() { try { var o = JSON.parse(localStorage.getItem(key()) || 'null'); if (o && o.mods && o.mods.length === D.modules.length) { S.mods = o.mods; S.mod = o.mod || 0; S.slide = o.slide || 0; S.total = o.total || 0; S.code = o.code || null; S.done = !!o.done; return o } } catch (e) {} return null }
  async function restoreServer() {
    var u = user(), c = sb(); if (!u || !c) return
    try {
      var r = await c.from('course_progress').select('active_seconds,state,updated_at').eq('user_id', u.id).eq('slug', D.slug).maybeSingle()
      if (r && r.data) {
        serverSec = r.data.active_seconds || 0
        var st = r.data.state || {}
        if (st.mods && st.mods.length === D.modules.length) { S.mods = st.mods; S.mod = st.mod || 0; S.slide = st.slide || 0 }
        S.total = Math.max(S.total, serverSec)
      }
      var k = await c.from('completions').select('certificate_number, courses!inner(slug)').eq('user_id', u.id).eq('courses.slug', D.slug).limit(1)
      if (k && k.data && k.data[0]) { S.code = k.data[0].certificate_number; S.done = true }
    } catch (e) {}
  }
  async function sync(active) {
    var u = user(), c = sb(); if (!u || !c) return
    try {
      var st = { active: !!active, mod: S.mod, slide: S.slide, mods: S.mods, allPassed: allDone() }
      var r = await c.rpc('course_tick', { p_slug: D.slug, p_state: st })
      if (r && typeof r.data === 'number') { serverSec = r.data; paintClock() }
    } catch (e) {}
  }

  // ---------- entry ----------
  async function mount(el, slug) {
    root = el; ensureCss()
    root.innerHTML = '<div class="cs-wrap"><p class="cs-muted">Loading course...</p></div>'
    try {
      if (!window.CourseData || !window.CourseData[slug]) await loadScript('/courses/' + encodeURIComponent(slug) + '.js?v=1')
    } catch (e) { root.innerHTML = '<div class="cs-wrap"><div class="cs-card"><h2>Course not found</h2><p>That course address is not available. <a href="/courses" onclick="event.preventDefault();showPage(\'courses\')">See all courses</a>.</p></div></div>'; return }
    D = window.CourseData[slug]; S = fresh(); serverSec = 0; blocked = false; finishing = false
    restoreLocal(); await restoreServer()
    S.phase = 'landing'
    schedulePresence()
    clearInterval(timer); timer = setInterval(tick, CFG.tickMs)
    render()
  }
  function unmount() { clearInterval(timer); timer = null; if (S) save(); S = null; D = null }

  // ---------- time ----------
  function isActive() { return !document.hidden && !blocked && (Date.now() - lastInput) < CFG.idleSec * 1000 && S && (S.phase === 'slides' || S.phase === 'quiz' || S.phase === 'results' || S.phase === 'wait') }
  function schedulePresence() { presenceAt = (S ? S.total : 0) + CFG.presenceMin + Math.floor(Math.random() * (CFG.presenceMax - CFG.presenceMin)) }
  function tick() {
    if (!S || !D) return
    var act = isActive()
    if (act) {
      S.total += CFG.step
      var m = S.mods[S.mod]; if (m) m.active += CFG.step
      if (S.phase === 'slides' && S.slideLeft > 0) S.slideLeft = Math.max(0, S.slideLeft - CFG.step)
      if (S.total >= presenceAt) askPresence()
    }
    ticks++
    if (ticks % CFG.syncEvery === 0) { save(); sync(act) }
    else if (ticks % 5 === 0) save()
    paintClock(); paintSlideLock(); paintWait()
  }
  ;['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(function (e) { window.addEventListener(e, function () { lastInput = Date.now() }, { passive: true }) })
  document.addEventListener('visibilitychange', function () { if (!document.hidden) lastInput = Date.now() })

  function askPresence() {
    if (blocked) return
    blocked = true; presenceStarted = Date.now()
    var d = document.createElement('div'); d.className = 'cs-modal'; d.id = 'cs-presence'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'cs-pt')
    d.innerHTML = '<div class="cs-modal-box"><h3 id="cs-pt">Still with us?</h3><p>Time is paused until you confirm. This check keeps your recorded time accurate.</p><p class="cs-muted" id="cs-pw">Please answer within <b>' + CFG.presenceWait + '</b> seconds to keep your place without losing the pause.</p><button class="cs-btn" id="cs-here" type="button">I am here, continue</button></div>'
    document.body.appendChild(d)
    var b = d.querySelector('#cs-here'); b.focus()
    b.onclick = function () { blocked = false; lastInput = Date.now(); d.remove(); schedulePresence(); try { trk('course_presence', D.slug, { late: Date.now() - presenceStarted > CFG.presenceWait * 1000 }) } catch (e) {} }
  }

  // ---------- paint helpers ----------
  function paintClock() {
    var a = $('#cs-clock'), p = $('#cs-prog'), pp = $('#cs-pct')
    var shown = user() ? Math.max(serverSec, 0) : S.total
    if (a) a.textContent = hms(user() ? shown : S.total) + ' of ' + hms(D.hours * 3600)
    var done = D.modules.filter(function (_, i) { return modDone(i) }).length
    var pct = Math.round(done / D.modules.length * 100)
    if (p) p.style.width = pct + '%'
    if (pp) pp.textContent = pct + '%'
  }
  function paintSlideLock() {
    if (!S || S.phase !== 'slides') return
    var b = $('#cs-next'), t = $('#cs-slide-timer'); if (!b) return
    var need = pendingChecks()
    var ok = S.slideLeft <= 0 && need === 0
    b.disabled = !ok
    if (t) t.textContent = S.slideLeft > 0 ? 'Next unlocks in ' + ms(S.slideLeft) : (need ? 'Answer the knowledge check to continue' : 'You can continue')
    var bar = $('#cs-slide-bar'); if (bar) { var tot = slideSecs(S.mod), pct = S.slideLeft > 0 ? Math.round((tot - S.slideLeft) / tot * 100) : 100; bar.style.width = Math.max(0, Math.min(100, pct)) + '%' }
  }
  function paintWait() {
    var w = $('#cs-wait'); if (!w || !S || S.phase !== 'results') return
    var left = modNeed(S.mod) - S.mods[S.mod].active
    if (left <= 0) { render(); return }
    w.textContent = 'Minimum module time remaining: ' + ms(left)
  }

  // ---------- views ----------
  function render() {
    if (!S) return
    var h = ''
    if (S.phase === 'landing') h = landing()
    else if (S.phase === 'cert') h = certificate()
    else h = player()
    var vk = S.phase + ':' + S.mod + ':' + S.slide + ':' + (S.quiz ? S.quiz.qi : '')
    root.innerHTML = '<div class="cs-wrap">' + h + '</div>'
    if (vk !== render._k) { render._k = vk; try { window.scrollTo(0, 0) } catch (e) {} }
    bind(); paintClock(); paintSlideLock()
    var f = $('[data-focus]'); if (f) { try { f.focus({ preventScroll: true }) } catch (e) {} }
  }

  function statesFit() {
    if (D.scope === 'wi') return ['Wisconsin']
    var out = []
    try { Object.keys(ST_CFG).forEach(function (id) { var c = ST_CFG[id]; if (D.edition && c.ed === D.edition + ' NEC') out.push(c.name) }) } catch (e) {}
    if (D.edition === 2023 && out.indexOf('Wisconsin') < 0) out.unshift('Wisconsin')
    return out
  }
  function landing() {
    var ap = approvals(), u = user()
    var started = S.mods.some(function (m) { return m.started || m.active > 0 }) || S.total > 0
    var nQ = D.modules.reduce(function (a, m) { return a + m.quiz.length }, 0)
    var nS = D.modules.reduce(function (a, m) { return a + m.slides.length }, 0)
    var h = '<div class="cs-card cs-hero"><div class="cs-pills"><span class="cs-pill cs-red">' + D.hours + '.0 CE hours</span><span class="cs-pill">' + esc(D.audience) + '</span><span class="cs-pill">' + esc(D.articles) + '</span></div><h1>' + esc(D.title) + '</h1>'
    if (ap.length) h += '<p class="cs-ok"><b>Approved for credit:</b> ' + ap.map(function (a) { return esc(a.state + ' (' + a.board + (a.number ? ' #' + a.number : '') + ')') }).join(', ') + '</p>'
    else h += '<p class="cs-warn"><b>Preview.</b> This course is waiting for state approval. You can take it, but no CE credit or certificate is issued yet.</p>'
    h += '<ul class="cs-facts"><li><b>' + D.modules.length + ' modules</b>, ' + nS + ' lessons, ' + nQ + ' review questions</li><li><b>Time is enforced.</b> Each lesson holds the Next button for a minimum viewing time, and each module has a minimum time. Only active time counts.</li><li><b>70% to pass</b> each module quiz. You can retake a quiz as often as you need; questions and answer order change each try.</li><li><b>Knowledge checks</b> inside lessons give instant feedback and cite the Code section.</li><li>Occasional <b>still-here checks</b> confirm you are present.</li></ul>'
    h += '<div class="cs-row"><button class="cs-btn cs-primary" id="cs-start" type="button" data-focus>' + (S.done ? 'Review course' : started ? 'Resume course' : 'Start course') + '</button>' + (S.code ? '<button class="cs-btn" id="cs-showcert" type="button">View certificate</button>' : '') + '</div>'
    if (!u) h += '<p class="cs-muted">You are not signed in. <a href="/" onclick="event.preventDefault();showPage(\'auth\')">Sign in</a> to save progress across devices and have your time recorded.</p>'
    h += '</div>'
    h += '<div class="cs-card"><h2>Modules</h2><ol class="cs-mods">' + D.modules.map(function (m, i) { return '<li class="' + (modDone(i) ? 'done' : '') + '"><b>' + esc(m.title) + '</b><span>' + m.minutes + ' min, ' + m.slides.length + ' lessons, ' + m.quiz.length + ' questions' + (modDone(i) ? ' - complete' : '') + '</span></li>' }).join('') + '</ol></div>'
    var fit = statesFit()
    h += '<div class="cs-card"><h2>Where this course fits</h2><p>' + (D.scope === 'wi' ? 'Built for Wisconsin licensees moving to the Wisconsin-amended 2023 NEC.' : D.edition ? 'Written to the <b>' + D.edition + ' NEC</b>, so it fits states and licenses that enforce that edition' + (fit.length ? ': ' + fit.map(esc).join(', ') : '') + '.' : 'Covers federal OSHA rules that apply in every state, with notes on state plans.') + '</p><p class="cs-muted">Whether the hours count toward renewal depends on each state board approving the course. Check your board before you rely on the credit.</p></div>'
    if (D.labs && D.labs.length) h += '<div class="cs-card"><h2>Practice tools</h2><p>These open in a new tab so your timer keeps running here.</p><div class="cs-row">' + D.labs.map(function (l) { return '<a class="cs-btn" target="_blank" rel="noopener" href="' + esc(l.url) + '">' + esc(l.label) + '</a>' }).join('') + '</div></div>'
    return h
  }

  function header() {
    return '<div class="cs-bar"><div class="cs-bar-t"><b>' + esc(D.short) + '</b></div><div class="cs-bar-r"><span class="cs-clock" id="cs-clock" title="Active course time" aria-label="Active course time"></span><span class="cs-prog"><span class="cs-prog-bg"><span class="cs-prog-fill" id="cs-prog"></span></span><span id="cs-pct">0%</span></span><button class="cs-link" id="cs-exit" type="button">Save and exit</button></div></div>'
  }
  function nav() {
    return '<nav class="cs-nav" aria-label="Modules">' + D.modules.map(function (m, i) {
      var open = i === 0 || modDone(i - 1), cls = (i === S.mod ? 'active ' : '') + (modDone(i) ? 'done ' : '') + (open ? '' : 'locked')
      return '<button type="button" class="cs-mbtn ' + cls + '" data-mod="' + i + '"' + (open ? '' : ' disabled') + '>' + (i + 1) + '. ' + esc(m.title.length > 34 ? m.title.slice(0, 32) + '...' : m.title) + (modDone(i) ? ' ✓' : '') + '</button>'
    }).join('') + '</nav>'
  }
  function player() { return header() + nav() + '<div class="cs-stage" id="cs-stage">' + stage() + '</div>' }

  function stage() {
    var m = D.modules[S.mod], ms_ = S.mods[S.mod]
    if (S.phase === 'intro') return '<div class="cs-card"><div class="cs-kicker">Module ' + (S.mod + 1) + ' of ' + D.modules.length + '</div><h2>' + esc(m.title) + '</h2><p class="cs-muted">' + m.minutes + ' minute minimum, ' + m.slides.length + ' lessons, ' + m.quiz.length + ' review questions</p><h3>What you will cover</h3><ul class="cs-list">' + (m.overview || []).map(function (o) { return '<li>' + esc(o) + '</li>' }).join('') + '</ul><div class="cs-row"><button class="cs-btn cs-primary" id="cs-begin" type="button" data-focus>Begin module ' + (S.mod + 1) + '</button></div></div>'
    if (S.phase === 'slides') return slideView(m)
    if (S.phase === 'quiz') return quizView(m)
    if (S.phase === 'results' || S.phase === 'wait') return resultsView(m)
    return ''
  }

  function pendingChecks() { var s = D.modules[S.mod].slides[S.slide], c = S.mods[S.mod].checks; if (!s || !s.checks) return 0; var n = 0; s.checks.forEach(function (_, i) { if (!c[S.slide + ':' + i]) n++ }); return n }

  function slideBody(s) {
    var h = ''
    h += '<div class="cs-body">' + (s.body || '') + '</div>'
    if (s.keypoint) h += '<div class="cs-key"><b>Key point.</b> ' + s.keypoint + '</div>'
    if (s.warning) h += '<div class="cs-warnbox"><b>Caution.</b> ' + s.warning + '</div>'
    if (s.info) h += '<div class="cs-infobox"><b>Note.</b> ' + s.info + '</div>'
    if (s.bullets) h += '<ul class="cs-bullets">' + s.bullets.map(function (b) { return '<li>' + b + '</li>' }).join('') + '</ul>'
    if (s.def_grid) h += '<div class="cs-defs">' + s.def_grid.map(function (d) { return '<div class="cs-def"><div class="cs-def-t">' + d.term + '</div><div>' + d.body + '</div></div>' }).join('') + '</div>'
    if (s.table) h += '<div class="cs-tablewrap"><table class="cs-table"><thead><tr>' + s.table.h.map(function (c) { return '<th scope="col">' + c + '</th>' }).join('') + '</tr></thead><tbody>' + s.table.r.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>' }).join('') + '</tr>' }).join('') + '</tbody></table></div>'
    if (s.hierarchy) h += '<ol class="cs-hier">' + s.hierarchy.map(function (r) { return '<li style="background:' + esc(r.bg) + ';border-color:' + esc(r.bc) + ';color:' + esc(r.tc) + '"><b>' + esc(r.n) + '. ' + esc(r.title) + '</b><span>' + esc(r.sub) + '</span></li>' }).join('') + '</ol>'
    if (s.ppe_cats) h += '<div class="cs-defs">' + s.ppe_cats.map(function (p) { return '<div class="cs-def" style="background:' + esc(p.bg) + ';border-color:' + esc(p.bc) + ';color:' + esc(p.tc) + '"><div class="cs-def-t">Category ' + esc(p.num) + ' (' + esc(p.cal) + ')</div><div>' + p.items + '</div></div>' }).join('') + '</div>'
    if (s.step_list) h += '<ol class="cs-steps">' + s.step_list.map(function (t) { return '<li>' + t + '</li>' }).join('') + '</ol>'
    if (s.refs && s.refs.length) h += '<div class="cs-refs"><span class="cs-muted">Code references:</span> ' + s.refs.map(function (r) { return '<span class="cs-ref">' + esc(r) + '</span>' }).join('') + '</div>'
    return h
  }
  function checkView(s) {
    if (!s.checks) return ''
    var c = S.mods[S.mod].checks
    return '<div class="cs-checks"><h3>Knowledge check</h3>' + s.checks.map(function (q, i) {
      var k = S.slide + ':' + i, a = c[k]
      var order = q._o || (q._o = shuffle(q.opts.map(function (_, j) { return j })))
      return '<div class="cs-chk" data-ck="' + i + '"><p class="cs-q" id="ckq' + i + '">' + esc(q.q) + '</p><div class="cs-opts" role="group" aria-labelledby="ckq' + i + '">' + order.map(function (j) {
        var cls = a ? (j === q.correct ? 'right' : (a.pick === j ? 'wrong' : '')) : ''
        return '<button type="button" class="cs-opt ' + cls + '" data-pick="' + i + ':' + j + '"' + (a ? ' disabled' : '') + '>' + esc(q.opts[j]) + '</button>'
      }).join('') + '</div>' + (a ? '<div class="cs-expl" role="status"><b>' + (a.pick === q.correct ? 'Correct.' : 'Not quite.') + '</b> ' + esc(q.explain || '') + (q.ref ? ' <span class="cs-ref">' + esc(q.ref) + '</span>' : '') + '</div>' : '') + '</div>'
    }).join('') + '</div>'
  }
  function slideView(m) {
    var s = m.slides[S.slide], last = S.slide === m.slides.length - 1
    return '<div class="cs-card"><div class="cs-kicker">' + esc(s.tag || ('Module ' + (S.mod + 1))) + ' - lesson ' + (S.slide + 1) + ' of ' + m.slides.length + '</div><h2 tabindex="-1" data-focus>' + esc(s.title) + '</h2>' + slideBody(s) + checkView(s) + '</div>' +
      '<div class="cs-foot"><div class="cs-slide-prog"><span class="cs-prog-bg"><span class="cs-prog-fill" id="cs-slide-bar"></span></span><span id="cs-slide-timer" class="cs-muted" aria-live="polite"></span></div><div class="cs-row"><button class="cs-btn" id="cs-prev" type="button"' + (S.slide === 0 ? ' disabled' : '') + '>Previous</button><button class="cs-btn cs-primary" id="cs-next" type="button" disabled>' + (last ? 'Go to the module quiz' : 'Next lesson') + '</button></div></div>'
  }

  function startQuiz() {
    var m = D.modules[S.mod]
    S.quiz = { order: shuffle(m.quiz.map(function (_, i) { return i })), opts: {}, qi: 0, score: 0, picked: null }
    S.quiz.order.forEach(function (i) { S.quiz.opts[i] = shuffle(m.quiz[i].opts.map(function (_, j) { return j })) })
    S.phase = 'quiz'; S.mods[S.mod].tries++
  }
  function quizView(m) {
    var qz = S.quiz, i = qz.order[qz.qi], q = m.quiz[i], p = qz.picked
    return '<div class="cs-card"><div class="cs-kicker">Module ' + (S.mod + 1) + ' quiz - question ' + (qz.qi + 1) + ' of ' + m.quiz.length + '</div><p class="cs-q cs-q-big" id="qq" tabindex="-1" data-focus>' + esc(q.q) + '</p><div class="cs-opts" role="group" aria-labelledby="qq">' + qz.opts[i].map(function (j) {
      var cls = p == null ? '' : (j === q.correct ? 'right' : (p === j ? 'wrong' : ''))
      return '<button type="button" class="cs-opt ' + cls + '" data-qpick="' + j + '"' + (p != null ? ' disabled' : '') + '>' + esc(q.opts[j]) + '</button>'
    }).join('') + '</div>' + (p != null ? '<div class="cs-expl" role="status"><b>' + (p === q.correct ? 'Correct.' : 'Not quite.') + '</b> ' + esc(q.explain || '') + '</div><div class="cs-row"><button class="cs-btn cs-primary" id="cs-qnext" type="button">' + (qz.qi + 1 >= m.quiz.length ? 'See results' : 'Next question') + '</button></div>' : '') + '</div>'
  }
  function resultsView(m) {
    var ms_ = S.mods[S.mod], pct = ms_.score, pass = pct >= CFG.pass, timeOK = ms_.active >= modNeed(S.mod), correct = Math.round(pct / 100 * m.quiz.length)
    var h = '<div class="cs-card cs-results"><div class="cs-score ' + (pass ? 'pass' : 'fail') + '">' + pct + '%</div><p>' + correct + ' of ' + m.quiz.length + ' correct. ' + (pass ? 'You passed this module quiz.' : 'You need ' + CFG.pass + '% to pass.') + '</p>'
    if (!pass) h += '<div class="cs-row"><button class="cs-btn" id="cs-review" type="button">Review the lessons</button><button class="cs-btn cs-primary" id="cs-retake" type="button" data-focus>Retake the quiz</button></div>'
    else if (!timeOK) { S.phase = 'results'; h += '<div class="cs-warn" id="cs-wait" aria-live="polite"></div><p class="cs-muted">Each module has a minimum time. Keep reviewing the lessons while the timer runs. Your progress is saved.</p><div class="cs-row"><button class="cs-btn" id="cs-review" type="button" data-focus>Review the lessons</button></div>' }
    else if (S.mod < D.modules.length - 1) h += '<div class="cs-row"><button class="cs-btn cs-primary" id="cs-nextmod" type="button" data-focus>Start module ' + (S.mod + 2) + '</button></div>'
    else h += finishBlock()
    return h + '</div>'
  }
  function finishBlock() {
    var u = user(), ap = approvals().length
    var ready = allDone(), enough = u ? serverSec >= needSec() : false
    if (!ready) return '<p class="cs-warn">Finish the remaining modules to complete the course.</p>'
    if (!ap) return '<h3>Course complete</h3><p>You finished every module. This course is still waiting for state approval, so no certificate is issued yet.</p>'
    if (!u) return '<h3>Course complete</h3><p>Sign in so your time can be verified and your certificate issued.</p><div class="cs-row"><button class="cs-btn cs-primary" type="button" onclick="showPage(\'auth\')">Sign in</button></div>'
    if (!enough) return '<h3>Almost there</h3><p>Your recorded course time (' + hms(serverSec) + ') is below the ' + hms(needSec()) + ' needed. Keep the course open and active a little longer.</p>'
    return '<h3>Course complete</h3><div class="cs-row"><button class="cs-btn cs-primary" id="cs-finish" type="button" data-focus>Get my certificate</button></div>'
  }

  function certificate() {
    var p = null; try { p = currentProfile } catch (e) {}
    var name = p ? (p.first_name + ' ' + p.last_name) : 'Course participant', lic = p && p.license_type ? p.license_type + (p.license_number ? ' #' + p.license_number : '') : ''
    var ap = approvals()
    var avg = Math.round(S.mods.reduce(function (a, m) { return a + m.score }, 0) / S.mods.length)
    return '<div class="cs-cert" id="cs-cert"><div class="cs-cert-in"><div class="cs-cert-brand">VoltCE</div><h1>Certificate of Completion</h1><p>This certifies that</p><div class="cs-cert-name">' + esc(name) + '</div>' + (lic ? '<p>' + esc(lic) + '</p>' : '') + '<p>completed</p><div class="cs-cert-course">' + esc(D.title) + '</div><p>' + D.hours + '.0 continuing education hours' + (D.edition ? ' | ' + D.edition + ' NEC' : '') + '<br>Average module quiz score: ' + avg + '%<br>Completed ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</p>' + (ap.length ? '<p>Approved for credit: ' + ap.map(function (a) { return esc(a.state + ' ' + a.board + (a.number ? ' #' + a.number : '')) }).join('; ') + '</p>' : '') + '<p class="cs-cert-code">Certificate number <b>' + esc(S.code) + '</b><br>Verify at voltceu.com/course?verify=' + esc(S.code) + '</p></div></div><div class="cs-row cs-noprint"><button class="cs-btn cs-primary" id="cs-print" type="button" data-focus>Print or save as PDF</button><button class="cs-btn" id="cs-back" type="button">Back to course</button></div>'
  }

  // ---------- actions ----------
  function bind() {
    function on(id, fn) { var e = $(id); if (e) e.onclick = fn }
    on('#cs-start', function () { S.phase = S.mods[S.mod].started ? 'slides' : 'intro'; if (S.phase === 'slides') enterSlide(); render() })
    on('#cs-showcert', function () { S.phase = 'cert'; render() })
    on('#cs-print', function () { document.body.classList.add('cs-printing'); window.print(); setTimeout(function () { document.body.classList.remove('cs-printing') }, 500) })
    on('#cs-back', function () { S.phase = 'landing'; render() })
    on('#cs-exit', function () { save(); sync(false); S.phase = 'landing'; render() })
    on('#cs-begin', function () { S.mods[S.mod].started = true; S.phase = 'slides'; S.slide = 0; enterSlide(); save(); render() })
    on('#cs-prev', function () { if (S.slide > 0) { S.slide--; enterSlide(); render() } })
    on('#cs-next', function () {
      var m = D.modules[S.mod]
      if (S.slide < m.slides.length - 1) { S.slide++; enterSlide(); render() } else { startQuiz(); render() }
      save()
    })
    on('#cs-qnext', function () { var qz = S.quiz, m = D.modules[S.mod]; qz.qi++; qz.picked = null; if (qz.qi >= m.quiz.length) finishQuiz(); else render() })
    on('#cs-retake', function () { startQuiz(); render() })
    on('#cs-review', function () { S.phase = 'slides'; S.slide = 0; enterSlide(); render() })
    on('#cs-nextmod', function () { S.mod++; S.slide = 0; S.phase = S.mods[S.mod].started ? 'slides' : 'intro'; if (S.phase === 'slides') enterSlide(); save(); sync(true); render() })
    on('#cs-finish', finish)
    root.querySelectorAll('[data-mod]').forEach(function (b) { b.onclick = function () { var i = +b.dataset.mod; S.mod = i; S.slide = 0; S.phase = S.mods[i].started ? 'slides' : 'intro'; if (S.phase === 'slides') enterSlide(); render() } })
    root.querySelectorAll('[data-pick]').forEach(function (b) { b.onclick = function () { var p = b.dataset.pick.split(':'), i = +p[0], j = +p[1], q = D.modules[S.mod].slides[S.slide].checks[i]; S.mods[S.mod].checks[S.slide + ':' + i] = { pick: j }; try { trk('course_check', D.slug, { ok: j === q.correct }) } catch (e) {} var st = $('#cs-stage'); if (st) st.innerHTML = stage(); bind(); paintSlideLock(); var ex = $('.cs-chk[data-ck="' + i + '"] .cs-expl'); if (ex && ex.scrollIntoView) ex.scrollIntoView({ block: 'nearest' }) } })
    root.querySelectorAll('[data-qpick]').forEach(function (b) { b.onclick = function () { var j = +b.dataset.qpick, qz = S.quiz, q = D.modules[S.mod].quiz[qz.order[qz.qi]]; qz.picked = j; if (j === q.correct) qz.score++; var st = $('#cs-stage'); if (st) st.innerHTML = stage(); bind(); var nx = $('#cs-qnext'); if (nx) nx.focus() } })
  }
  function enterSlide() {
    var m = S.mods[S.mod], k = String(S.slide)
    if (m.seen[k]) S.slideLeft = 0
    else { m.seen[k] = true; S.slideLeft = slideSecs(S.mod) }
  }
  function finishQuiz() {
    var m = D.modules[S.mod], qz = S.quiz, pct = Math.round(qz.score / m.quiz.length * 100), ms_ = S.mods[S.mod]
    ms_.score = pct; ms_.passed = pct >= CFG.pass
    try { trk('course_quiz', D.slug, { m: S.mod, pct: pct, tries: ms_.tries }) } catch (e) {}
    S.phase = 'results'; save(); sync(true); render()
  }
  async function finish() {
    if (finishing) return; finishing = true
    var b = $('#cs-finish'); if (b) { b.disabled = true; b.textContent = 'Issuing certificate...' }
    try {
      var avg = Math.round(S.mods.reduce(function (a, m) { return a + m.score }, 0) / S.mods.length)
      await sync(true)
      var r = await sb().rpc('course_finish', { p_slug: D.slug, p_score: avg })
      if (r.error) throw r.error
      S.code = r.data; S.done = true; S.phase = 'cert'; save()
      try { trk('course_complete', D.slug) } catch (e) {}
      render()
    } catch (e) {
      finishing = false
      var w = $('.cs-results'); if (w) w.insertAdjacentHTML('beforeend', '<p class="cs-warn">We could not issue the certificate yet: ' + esc(e && e.message ? e.message : 'try again in a moment') + '</p>')
      if (b) { b.disabled = false; b.textContent = 'Get my certificate' }
    }
  }

  // ---------- certificate verification ----------
  async function verify(el, code) {
    root = el; ensureCss()
    el.innerHTML = '<div class="cs-wrap"><div class="cs-card"><h1>Verify a certificate</h1><form id="cs-vf" class="cs-row"><label class="cs-muted" for="cs-vc">Certificate number</label><input id="cs-vc" class="cs-input" value="' + esc(code || '') + '" placeholder="VCE-XXXXXXXXXX" autocomplete="off"><button class="cs-btn cs-primary" type="submit">Verify</button></form><div id="cs-vr" aria-live="polite"></div></div></div>'
    async function run(c) {
      var out = el.querySelector('#cs-vr'); c = (c || '').trim(); if (!c) { out.innerHTML = ''; return }
      out.innerHTML = '<p class="cs-muted">Checking...</p>'
      try {
        var r = await sb().rpc('verify_certificate', { p_code: c })
        var row = r && r.data && r.data[0]
        out.innerHTML = row ? '<div class="cs-ok"><b>Valid certificate.</b><br>' + esc(row.holder) + (row.license_type ? ', ' + esc(row.license_type) + (row.license_tail ? ' (license ending ' + esc(row.license_tail) + ')' : '') : '') + '<br>' + esc(row.title) + ', ' + esc(row.hours) + ' hours' + (row.standard ? ', ' + esc(row.standard) : '') + '<br>Completed ' + new Date(row.completed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</div>' : '<p class="cs-warn">No certificate found with that number.</p>'
      } catch (e) { out.innerHTML = '<p class="cs-warn">Verification is not available right now. Try again later.</p>' }
    }
    el.querySelector('#cs-vf').onsubmit = function (e) { e.preventDefault(); run(el.querySelector('#cs-vc').value) }
    if (code) run(code)
  }

  window.Course = { mount: mount, unmount: unmount, verify: verify, _state: function () { return S }, _cfg: CFG }
})()
