/* VoltCE running tally + dashboard. Stored only in this browser (localStorage); no account needed. */
(function () {
  const KEY = 'vc_stats_v1';
  const TOOLS = { fc: 'Flashcards', idx: 'Index drill', code: 'Code articles', calc: 'Load calcs', theory: 'Theory', chg: 'Edition changes', practice: 'Practice quizzes' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
  let D = null;
  function load() {
    if (D) return D;
    try { D = JSON.parse(localStorage.getItem(KEY)) } catch (e) {}
    if (!D || typeof D !== 'object') D = {};
    D.secs = D.secs || 0; D.sec = D.sec || {}; D.days = D.days || {}; D.since = D.since || Date.now();
    return D;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)) } catch (e) {} }

  /* log one answered question: tool, section, right?, seconds (optional) */
  function log(tool, section, ok, secs) {
    load();
    const k = tool + '|' + String(section || 'General').slice(0, 60);
    const r = D.sec[k] || (D.sec[k] = { n: 0, r: 0, s: 0, ts: 0 });
    r.n++; if (ok) r.r++;
    if (secs > 0 && secs < 3600) { r.s += secs; r.ts++ }
    if (tool !== 'fc') { const rc = D.recent || (D.recent = []); rc.push(ok ? 1 : 0); while (rc.length > 300) rc.shift() }
    const d = D.days[today()] || (D.days[today()] = { n: 0, r: 0 });
    d.n++; if (ok) d.r++;
    const keys = Object.keys(D.days).sort(); while (keys.length > 60) delete D.days[keys.shift()];
    save(); home();
  }
  function hook(ev, page, m) {
    if (!m) return;
    if (ev === 'ans' || ev === 'card') log(m.t || page, m.c, !!m.ok, m.s);
    else if (ev === 'timeout') log(m.t || page, m.c || 'Timed out', false, m.s);
  }

  /* active time: counts only while the tab is visible and the person did something in the last 2 minutes */
  let last = Date.now();
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(e => addEventListener(e, () => { last = Date.now() }, { passive: true }));
  setInterval(() => { if (document.visibilityState === 'visible' && Date.now() - last < 120000) { load(); D.secs += 5; if (D.secs % 30 === 0) { save(); home() } } }, 5000);
  addEventListener('pagehide', () => { if (D) save() });

  function totals() {
    load(); const t = { n: 0, r: 0, s: 0, ts: 0, by: {}, sec: [] };
    Object.keys(D.sec).forEach(k => {
      const v = D.sec[k], i = k.indexOf('|'), tool = k.slice(0, i), name = k.slice(i + 1);
      t.n += v.n; t.r += v.r; t.s += v.s; t.ts += v.ts;
      const b = t.by[tool] || (t.by[tool] = { n: 0, r: 0, s: 0, ts: 0 }); b.n += v.n; b.r += v.r; b.s += v.s; b.ts += v.ts;
      t.sec.push({ tool, name, n: v.n, r: v.r, s: v.s, ts: v.ts, pct: v.r / v.n });
    });
    return t;
  }
  const dur = s => { s = Math.round(s); if (s < 60) return s + 's'; const m = Math.floor(s / 60); if (m < 60) return m + ' min'; return Math.floor(m / 60) + ' h ' + (m % 60) + ' min' };
  const avg = t => t.ts ? (t.s / t.ts).toFixed(1) + ' s' : '—';
  const pct = (r, n) => n ? Math.round(r / n * 100) + '%' : '—';


  /* Readiness: needs ~300 scored questions (flashcards excluded). Uses the latest 300 so improvement shows. */
  const erf = x => { const t = 1 / (1 + .3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y };
  const Phi = z => .5 * (1 + erf(z / Math.SQRT2));
  function readiness() {
    load(); const rc = D.recent || [], n = rc.length, r = rc.reduce((a, b) => a + b, 0);
    const need = 300; if (n < need) return { ok: false, n, need, pct: n ? r / n : 0 };
    const p = (r + 2) / (n + 4), se = Math.sqrt(p * (1 - p) / (n + 4)), prob = Phi((p - .7) / se);
    return { ok: true, n, need, pct: r / n, prob, lo: Math.max(0, p - 1.96 * se), hi: Math.min(1, p + 1.96 * se) };
  }
  function readyCard() {
    const R = readiness();
    if (!R.ok) return `<div class="card st-ready"><div class="st-h">Pass readiness</div><div class="st-sub" style="margin:0 0 10px">The exam pass mark is 70%. After about ${R.need} scored questions (code, calc, theory, edition changes, index drill and practice quizzes) your dashboard estimates your chance of passing.</div>
      <div class="st-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${R.need}" aria-valuenow="${R.n}"><i style="width:${Math.round(R.n / R.need * 100)}%"></i><u style="left:70%"></u></div>
      <div class="st-sub">${R.n} of ${R.need} questions${R.n ? ' · ' + Math.round(R.pct * 100) + '% right so far (the line marks 70%)' : ''}. ${R.need - R.n} to go.</div></div>`;
    const pr = Math.round(R.prob * 100), acc = Math.round(R.pct * 100);
    const [lab, cls, msg] = R.lo >= .7 ? ['Ready', 'g', 'Your last 300 answers clear 70% with room to spare. Keep a steady mix so it holds.']
      : R.pct >= .7 ? ['Close', 'a', 'You are at or above 70%, but the margin is thin. Tighten up your weakest sections below.']
      : ['Not yet', 'r', 'You are under 70% right now. Work the struggle sections below, read every explanation, then check again.'];
    return `<div class="card st-ready"><div class="st-h">Pass readiness</div><div class="st-rd"><div class="st-ring ${cls}" style="--p:${pr}"><b>${pr}%</b><span>chance of 70%+</span></div>
      <div><div class="st-big ${cls}">${lab}</div><div class="st-sub" style="font-size:14px;color:var(--text)">${msg}</div>
      <div class="st-sub">Last ${R.n} questions: ${acc}% right (likely range ${Math.round(R.lo * 100)}% to ${Math.round(R.hi * 100)}%). This is an estimate from practice questions, not a prediction of your real exam.</div></div></div></div>`;
  }

  function home() {
    const el = $('tally'); if (!el) return; const t = totals();
    el.innerHTML = `<div class="tally-in"><div class="tally-t"><b>Your running tally</b><span>${t.n ? 'Saved on this device' : 'Answer a question and it starts counting'}</span></div>
      <div class="tally-grid">
        <div><b>${dur(D.secs)}</b><span>time studying</span></div>
        <div><b>${t.n}</b><span>answered</span></div>
        <div><b class="g">${t.r}</b><span>right</span></div>
        <div><b class="r">${t.n - t.r}</b><span>wrong</span></div>
        <div><b>${pct(t.r, t.n)}</b><span>accuracy</span></div>
      </div><button class="btn-sm" onclick="Stats.open()">Open my dashboard</button></div>`;
  }

  function open() { showPage('stats'); render() }
  function render() {
    const el = $('stats-body'); if (!el) return; const t = totals();
    if (!t.n) { el.innerHTML = readyCard() + '<div class="card"><div class="empty">Nothing to show yet. Answer a few flashcards, drills or practice quiz questions and your dashboard fills in here.</div><div class="row-btns" style="justify-content:center"><button class="btn-primary" style="max-width:240px" onclick="fcOpen()">Start with flashcards</button></div></div>'; return }
    const rows = t.sec.filter(x => x.n >= 5);
    const best = rows.slice().sort((a, b) => b.pct - a.pct || b.n - a.n)[0];
    const weak = rows.slice().sort((a, b) => a.pct - b.pct || b.n - a.n)[0];
    const tile = (v, l, c) => `<div class="card-sm st-tile"><b class="${c || ''}">${v}</b><span>${l}</span></div>`;
    const lab = x => `${esc(x.name)} <span class="st-tool">${esc(TOOLS[x.tool] || x.tool)}</span>`;
    const days = []; for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); days.push({ k, d, v: D.days[k] || { n: 0, r: 0 } }) }
    const mx = Math.max(5, ...days.map(x => x.v.n));
    el.innerHTML = readyCard() + `<div class="st-grid">${tile(dur(D.secs), 'time on VoltCE')}${tile(t.n, 'questions answered')}${tile(t.r, 'right', 'g')}${tile(t.n - t.r, 'wrong', 'r')}${tile(pct(t.r, t.n), 'accuracy')}${tile(avg(t), 'average per question')}</div>
      <div class="st-two">
        <div class="card-sm"><div class="st-h">Best section</div>${best ? `<div class="st-big g">${lab(best)}</div><div class="st-sub">${pct(best.r, best.n)} right over ${best.n} questions</div>` : '<div class="st-sub">Answer at least 5 questions in a section to see this.</div>'}</div>
        <div class="card-sm"><div class="st-h">Where you struggle most</div>${weak && (!best || weak !== best) ? `<div class="st-big r">${lab(weak)}</div><div class="st-sub">${pct(weak.r, weak.n)} right over ${weak.n} questions</div><button class="btn-sm" style="margin-top:8px" onclick="Stats.drill('${esc(weak.tool)}','${esc(weak.name).replace(/'/g, "\\'")}')">Practice this section</button>` : '<div class="st-sub">Answer at least 5 questions in two sections to see this.</div>'}</div>
      </div>
      <div class="card"><div class="st-h">Last 14 days</div><div class="st-bars">${days.map(x => `<div class="st-col" title="${x.d.toLocaleDateString()}: ${x.v.n} answered, ${x.v.r} right"><div class="st-bar"><i style="height:${Math.round(x.v.n / mx * 100)}%"><u style="height:${x.v.n ? Math.round(x.v.r / x.v.n * 100) : 0}%"></u></i></div><span>${x.d.getDate()}</span></div>`).join('')}</div><div class="st-sub">Tall bar = questions answered. Green part = right.</div></div>
      <div class="card"><div class="st-h">By tool</div><div class="table-wrap"><table><thead><tr><th>Tool</th><th>Answered</th><th>Right</th><th>Accuracy</th><th>Avg time</th></tr></thead><tbody>${Object.keys(t.by).sort((a, b) => t.by[b].n - t.by[a].n).map(k => { const b = t.by[k]; return `<tr><td>${esc(TOOLS[k] || k)}</td><td>${b.n}</td><td>${b.r}</td><td>${pct(b.r, b.n)}</td><td>${avg(b)}</td></tr>` }).join('')}</tbody></table></div></div>
      <div class="card"><div class="st-h">By section, weakest first</div><div class="table-wrap"><table><thead><tr><th>Section</th><th>Answered</th><th>Right</th><th>Accuracy</th><th>Avg time</th></tr></thead><tbody>${t.sec.slice().sort((a, b) => a.pct - b.pct || b.n - a.n).slice(0, 40).map(x => `<tr><td>${lab(x)}</td><td>${x.n}</td><td>${x.r}</td><td><span class="badge ${x.pct >= .8 ? 'badge-green' : x.pct >= .6 ? 'badge-amber' : 'badge-blue'}">${pct(x.r, x.n)}</span></td><td>${avg(x)}</td></tr>`).join('')}</tbody></table></div><div class="st-sub">Flashcards count "got it" as right and have no timer, so they are left out of average time.</div></div>
      <p class="st-sub">This tally lives in this browser only. Clearing site data or using another device starts a new one. <button class="lnk" onclick="Stats.reset()">Reset my tally</button></p>`;
  }
  function drill(tool, name) {
    if (tool === 'practice') { PQ.start(PQ.Q.bank, name); return }
    const bank = { code: 'code', calc: 'calc', theory: 'theory', chg: 'chg' }[tool];
    if (bank) { PQ.setBank(bank); showPage('practice'); PQ.start(bank, name) } else showPage('study');
  }
  function reset() { if (!confirm('Reset your tally on this device? This cannot be undone.')) return; D = { secs: 0, sec: {}, days: {}, since: Date.now() }; save(); render(); home() }

  window.Stats = { log, hook, open, render, home, drill, reset };
  document.addEventListener('DOMContentLoaded', home);
})();
