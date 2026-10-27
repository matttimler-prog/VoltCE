/* VoltCE practice quizzes: short, section-based, with scores, explanations and an optional Facebook share.
   These are practice only. They are separate from any course exam and earn no CE credit. */
(function () {
  const SITE = 'https://volt-ce.vercel.app/';
  const BANKS = {
    code: { label: 'Code articles', file: 'code-bank.js', glob: 'CODE_BANK', field: 'ar', filter: x => (x.eds || [2023]).includes(window.ED ? ED.cur : 2023) },
    calc: { label: 'Load calculations', file: 'calc-bank.js', glob: 'CALC_BANK', field: 'c' },
    theory: { label: 'Electrical theory', file: 'theory-bank.js', glob: 'THEORY_BANK', field: 'c' },
    chg: { label: 'Edition changes', file: 'chg-bank.js', glob: 'CHG_BANK', field: 'ar' }
  };
  const N = 10;
  const Q = { qStart: 0, bank: 'code', section: 'All', qs: [], i: 0, sel: -1, answered: false, score: 0, missed: [] };
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a };
  const track = (ev, meta) => { try { trk(ev, 'practice', meta) } catch (e) {} };

  function load(bank, cb) {
    const b = BANKS[bank]; if (window[b.glob]) return cb();
    const el = $('pq-body'); el.innerHTML = '<div class="empty">Loading questions…</div>';
    const sc = document.createElement('script'); sc.src = b.file; sc.onload = cb;
    sc.onerror = () => { el.innerHTML = '<div class="empty">Could not load the questions. Refresh and try again.</div>' };
    document.head.appendChild(sc);
  }
  function pool(bank) { const b = BANKS[bank]; return (window[b.glob] || []).filter(x => !b.filter || b.filter(x)) }
  function sections(bank) {
    const b = BANKS[bank], m = {};
    pool(bank).forEach(x => { const k = x[b.field]; m[k] = (m[k] || 0) + 1 });
    return Object.keys(m).filter(k => m[k] >= 5).sort((a, c) => a.localeCompare(c, undefined, { numeric: true })).map(k => [k, m[k]]);
  }

  function menu() {
    const body = $('pq-body');
    load(Q.bank, () => {
      const secs = sections(Q.bank);
      if (!secs.some(s => s[0] === Q.section)) Q.section = 'All';
      body.innerHTML = `<div class="card">
        <div class="tabs">${Object.keys(BANKS).map(k => `<button class="tab ${k === Q.bank ? 'active' : ''}" onclick="PQ.setBank('${k}')">${BANKS[k].label}</button>`).join('')}</div>
        <div class="form-label">Pick a section</div>
        <div class="sec-wrap"><div class="sec-grid" id="pq-secs">
          <button class="sec-chip ${Q.section === 'All' ? 'on' : ''}" data-fx-label="Mixed practice" onclick="PQ.pickSec('All')">${VCSYM.svg('bolt', 24)}Mixed: all sections</button>
          ${secs.map(([k, n]) => `<button class="sec-chip ${k === Q.section ? 'on' : ''}" onclick="PQ.pickSec(this.dataset.s)" data-s="${esc(k)}">${VCSYM.forLabel(k, 24)}${esc(k)} <small>${n}</small></button>`).join('')}
        </div></div>
        <div class="row-btns" style="margin-top:14px"><button class="btn-primary" style="max-width:260px" onclick="PQ.start()">Start a ${N}-question quiz</button></div>
        <p style="font-size:13px;color:var(--muted);margin-top:12px">Practice only. These quizzes are separate from any course exam and do not earn CE credit. Every answer shows an explanation and a code reference.</p>
      </div>`;
      setCorner('practice', Q.section === 'All' ? 'Practice quiz' : Q.section);
    });
  }

  function start(bank, section) {
    if (bank) { Q.bank = bank; Q.section = section || 'All' }
    if (!$('page-practice').classList.contains('active')) showPage('practice');
    load(Q.bank, () => {
      const b = BANKS[Q.bank];
      let list = pool(Q.bank).filter(x => Q.section === 'All' || x[b.field] === Q.section);
      if (list.length < 3) { Q.section = 'All'; list = pool(Q.bank) }
      Q.qs = shuf(list).slice(0, N); Q.i = 0; Q.sel = -1; Q.answered = false; Q.score = 0; Q.missed = [];
      track('quiz_start', { b: Q.bank, s: String(Q.section).slice(0, 40) });
      setCorner('practice', Q.section === 'All' ? BANKS[Q.bank].label : Q.section);
      render();
    });
  }

  function render() {
    const body = $('pq-body');
    if (Q.i >= Q.qs.length) return result();
    const q = Q.qs[Q.i]; if (!Q.answered && !Q.qStart) Q.qStart = Date.now();
    body.innerHTML = `<div class="card">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:8px"><span>Question ${Q.i + 1} of ${Q.qs.length}</span><span>${Q.score} correct so far</span></div>
      <div style="font-size:15px;font-weight:500;margin-bottom:10px;line-height:1.55">${esc(q.q)}</div>
      ${q.o.map((x, k) => `<button class="opt ${Q.answered ? (k === q.a ? 'right' : (k === Q.sel ? 'wrong' : '')) : ''}" ${Q.answered ? 'disabled' : ''} onclick="PQ.pick(${k})">${String.fromCharCode(65 + k)}. ${esc(x)}</button>`).join('')}
      ${Q.answered ? `<div class="expl"><b>${Q.sel === q.a ? 'Correct.' : 'Not quite.'}</b> ${esc(q.e)}<div style="margin-top:6px;font-size:12px;opacity:.8">Reference: ${esc(q.r)}</div></div>
        <div class="row-btns"><button class="btn-sm" onclick="PQ.next()">${Q.i + 1 >= Q.qs.length ? 'See my score' : 'Next question'} →</button></div>` : ''}
    </div>`;
  }
  function pick(k) {
    if (Q.answered) return; const q = Q.qs[Q.i];
    Q.sel = k; Q.answered = true;
    try { trk('ans', 'practice', { t: 'practice', c: String(q[BANKS[Q.bank].field] || BANKS[Q.bank].label).slice(0, 40), ok: k === q.a ? 1 : 0, s: Math.round((Date.now() - (Q.qStart || Date.now())) / 1000) }) } catch (e) {}
    if (k === q.a) Q.score++; else Q.missed.push({ q, sel: k });
    render();
  }
  function next() { Q.qStart = 0; Q.i++; Q.sel = -1; Q.answered = false; render() }

  function shareText(pct) {
    const what = Q.section === 'All' ? BANKS[Q.bank].label : Q.section;
    return `I scored ${pct}% on the ${what} practice quiz at VoltCE, free electrician exam prep and continuing education. Try it: ${SITE}`;
  }
  function result() {
    const n = Q.qs.length, pct = Math.round(Q.score / n * 100), ok = pct >= 80;
    track('quiz_done', { b: Q.bank, p: pct });
    $('pq-body').innerHTML = `<div class="card" style="text-align:center">
        <div class="page-title" style="margin-bottom:4px">${Q.score} of ${n} correct</div>
        <p class="page-sub" style="margin-bottom:14px">${pct}% · ${ok ? 'Nice work.' : 'Review the explanations below and try again.'}</p>
        <div class="row-btns" style="justify-content:center">
          <button class="btn-primary" style="max-width:220px" onclick="PQ.start()">New ${N}-question quiz</button>
          <button class="btn-sm" onclick="PQ.menu()">Pick another section</button>
          ${ok ? `<button class="btn-sm" id="pq-share" onclick="PQ.share(${pct})">Share my score</button>` : ''}
        </div>
        <div id="pq-share-note" style="font-size:12.5px;color:var(--muted);margin-top:10px"></div>
      </div>
      ${Q.missed.length ? `<div class="card"><b>Questions to review</b>${Q.missed.map(m => `<div class="card-sm" style="margin-top:10px"><div style="font-weight:500;margin-bottom:6px">${esc(m.q.q)}</div>
        <div style="font-size:13px"><span style="color:var(--red)">Your answer:</span> ${esc(m.q.o[m.sel])}</div>
        <div style="font-size:13px"><span style="color:var(--green)">Correct answer:</span> ${esc(m.q.o[m.q.a])}</div>
        <div class="expl" style="margin-top:8px">${esc(m.q.e)}<div style="margin-top:6px;font-size:12px;opacity:.8">Reference: ${esc(m.q.r)}</div></div></div>`).join('')}</div>` : ''}`;
  }

  /* Share: opens Facebook's own share dialog in a new window. No Facebook login or SDK in the app.
     Facebook ignores pre-filled text in many cases, so the post text is also copied for pasting. */
  function share(pct) {
    const text = shareText(pct);
    const note = $('pq-share-note');
    const copy = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text).then(() => true, () => false) : Promise.resolve(false);
    const url = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(SITE) + '&quote=' + encodeURIComponent(text) + '&hashtag=' + encodeURIComponent('#VoltCE');
    window.open(url, '_blank', 'noopener,noreferrer,width=640,height=560');
    track('share_click', { p: pct });
    copy.then(ok => { if (note) note.textContent = ok ? 'Facebook opened in a new window. Your post text was copied: paste it if the box is empty, then post it yourself.' : 'Facebook opened in a new window. Write your post and post it yourself.' });
  }

  function pickSec(k) { Q.section = k; document.querySelectorAll('#pq-secs .sec-chip').forEach(b => b.classList.toggle('on', (b.dataset.s || 'All') === k)); setCorner('practice', k === 'All' ? 'Practice quiz' : k) }
  window.PQ = { pickSec, Q, menu, start, pick, next, share, section: 'All', setBank(b) { Q.bank = b; Q.section = 'All'; menu() }, open() { showPage('practice'); menu() } };
  Object.defineProperty(window.PQ, 'section', { get: () => Q.section, set: v => { Q.section = v } });
})();
