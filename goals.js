/* Goals and reminders for signed-in users (tables user_goals / user_reminders, RLS = own rows). */
var Goals = (function () {
  var G = [], R = [], css = document.createElement('style');
  css.textContent =
    '.gr-form{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.gr-form input,.gr-form select{padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font:inherit;font-size:13px;background:#fff}' +
    '.gr-form input[type=number]{width:90px}.gr-form input:not([type]),.gr-form input[type=text]{flex:1;min-width:180px}' +
    '.gr-row{display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;flex-wrap:wrap}.gr-row:last-child{border-bottom:none}' +
    '.gr-row .t{flex:1;min-width:160px}.gr-row .m{font-size:12px;color:var(--muted)}.gr-row.done .t{text-decoration:line-through;color:var(--muted)}' +
    '.gr-bar{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;margin-top:5px;max-width:320px}.gr-bar i{display:block;height:100%;background:var(--green)}' +
    '.gr-row button{font:inherit;font-size:12px;cursor:pointer;border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:4px 9px}.gr-row button:hover{border-color:var(--ink)}' +
    '.gr-opt{display:block;margin-top:12px;font-size:13px}.gr-note{font-size:12px;color:var(--muted);margin-top:10px}.gr-empty{color:var(--muted);font-size:13px;padding:6px 0}' +
    '.gr-badge{background:var(--red);color:#fff;border-radius:9px;padding:0 6px;font-size:11px;margin-left:4px}' +
    '.gr-due{background:var(--amber-light);border:1px solid var(--amber);color:var(--amber);border-radius:8px;padding:10px 14px;margin:0 0 14px;font-size:14px}.gr-due b{color:var(--ink)}.gr-due button{margin-left:8px;font:inherit;font-size:12px;cursor:pointer;border:1px solid var(--amber);background:#fff;border-radius:6px;padding:3px 9px}';
  document.head.appendChild(css);
  function $(i) { return document.getElementById(i) }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
  function fmt(d) { if (!d) return ''; var p = d.split('-'); return new Date(+p[0], p[1] - 1, +p[2]).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
  function next(d, rep) { var p = d.split('-').map(Number), x = new Date(p[0], p[1] - 1, p[2]); if (rep === 'weekly') x.setDate(x.getDate() + 7); else if (rep === 'monthly') x.setMonth(x.getMonth() + 1); else x.setFullYear(x.getFullYear() + 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') }
  function prog(g) { return g.kind === 'ceu' ? (window._ceuTotal || 0) : (g.current || 0) }
  async function load() {
    if (!currentUser) return;
    var a = await supabaseClient.from('user_goals').select('*').order('created_at'), b = await supabaseClient.from('user_reminders').select('*').order('remind_on');
    G = (a && a.data) || []; R = (b && b.data) || []; render();
    var pr = await supabaseClient.from('profiles').select('email_reminders').eq('id', currentUser.id).single(); if ($('gr-email')) $('gr-email').checked = !!(pr && pr.data && pr.data.email_reminders);
  }
  function progress() {
    var el = $('gr-progress'); if (!el || typeof Stats === 'undefined') return;
    var st = Stats.streak(), w = Stats.weakest();
    el.innerHTML = '<div style="display:flex;gap:22px;flex-wrap:wrap;font-size:14px"><div><b style="font-size:22px">' + st.cur + '</b><div class="m" style="font-size:12px;color:var(--muted)">day study streak' + (st.cur && !st.today ? ' (answer today to keep it)' : '') + '</div></div><div><b style="font-size:22px">' + st.best + '</b><div style="font-size:12px;color:var(--muted)">best streak</div></div></div>' +
      '<div style="margin-top:10px;font-size:14px">' + (w ? 'Weakest section: <b>' + esc(w.name) + '</b> (' + Math.round(w.pct * 100) + '% right over ' + w.n + ' questions). <button class="btn-sm" onclick="Stats.practiceWeak()">Practice it</button>' : 'Answer at least 5 questions in a section and your weakest one shows here.') + '</div>' +
      '<div style="margin-top:8px"><button class="btn-sm" onclick="Stats.open()">Open my full progress dashboard</button></div>' +
      '<div class="gr-note">Your streak and scores are saved on this device.</div>';
  }
  function render() {
    progress();
    var gl = $('gr-goals'), rl = $('gr-rems'); if (!gl) return;
    gl.innerHTML = G.length ? G.map(function (g) {
      var cur = prog(g), pct = g.target ? Math.min(100, Math.round(cur / g.target * 100)) : (g.done ? 100 : 0), done = g.done || (g.target && cur >= g.target);
      return '<div class="gr-row' + (done ? ' done' : '') + '"><div class="t">' + esc(g.title) + '<div class="m">' + (g.target ? cur.toFixed(g.kind === 'ceu' ? 1 : 0).replace(/\.0$/, '') + ' of ' + g.target + (g.kind === 'ceu' ? ' CEU hours (counts your completed courses)' : g.kind === 'lessons' ? ' lessons' : '') : '') + (g.due_date ? ' · due ' + fmt(g.due_date) : '') + '</div>' +
        (g.target ? '<div class="gr-bar"><i style="width:' + pct + '%"></i></div>' : '') + '</div>' +
        (g.kind !== 'ceu' && g.target ? '<button onclick="Goals.bump(\'' + g.id + '\',1)" aria-label="Add one">+1</button>' : '') +
        (g.kind !== 'ceu' && !g.target ? '<button onclick="Goals.toggle(\'' + g.id + '\')">' + (g.done ? 'Undo' : 'Mark done') + '</button>' : '') +
        '<button onclick="Goals.delGoal(\'' + g.id + '\')" aria-label="Delete goal">Delete</button></div>';
    }).join('') : '<div class="gr-empty">No goals yet. Add one below, like finishing your CEU hours before renewal.</div>';
    rl.innerHTML = R.length ? R.map(function (r) {
      var over = !r.done && r.remind_on <= today();
      return '<div class="gr-row' + (r.done ? ' done' : '') + '"><div class="t">' + esc(r.title) + '<div class="m">' + (over ? 'Due ' : '') + fmt(r.remind_on) + (r.repeat !== 'none' ? ' · repeats ' + r.repeat : '') + '</div></div>' +
        (!r.done ? '<button onclick="Goals.doneRem(\'' + r.id + '\')">' + (r.repeat !== 'none' ? 'Done, next time' : 'Done') + '</button>' : '') +
        '<button onclick="Goals.delRem(\'' + r.id + '\')" aria-label="Delete reminder">Delete</button></div>';
    }).join('') : '<div class="gr-empty">No reminders yet.</div>';
    var due = R.filter(function (r) { return !r.done && r.remind_on <= today() });
    var box = $('dash-due'), bd = $('gr-badge');
    if (box) box.innerHTML = due.map(function (r) { return '<div class="gr-due" role="status">Reminder: <b>' + esc(r.title) + '</b> <button onclick="Goals.doneRem(\'' + r.id + '\')">Done</button></div>' }).join('');
    if (bd) { bd.textContent = due.length; bd.style.display = due.length ? '' : 'none' }
  }
  async function addGoal(e) {
    e.preventDefault();
    var kind = $('gg-kind').value, title = $('gg-title').value.trim(), t = parseFloat($('gg-target').value);
    if (!title) title = { ceu: 'Earn my CEU hours', exam: 'Pass my exam', lessons: 'Finish my lessons', custom: '' }[kind];
    if (!title) { $('gg-title').focus(); return false }
    var row = { title: title, kind: kind, target: isFinite(t) && t > 0 ? t : null, due_date: $('gg-due').value || null };
    var r = await supabaseClient.from('user_goals').insert(row).select().single();
    if (r.data) { G.push(r.data); render(); $('gr-goal-form').reset(); kindChange() } return false;
  }
  function kindChange() { var k = $('gg-kind').value; $('gg-target').placeholder = k === 'ceu' ? 'Hours (e.g. 16)' : k === 'lessons' ? 'Lessons' : 'Target (optional)' }
  async function addRem(e) {
    e.preventDefault();
    var title = $('gr-title').value.trim(), d = $('gr-date').value; if (!title || !d) { (title ? $('gr-date') : $('gr-title')).focus(); return false }
    var r = await supabaseClient.from('user_reminders').insert({ title: title, remind_on: d, repeat: $('gr-rep').value }).select().single();
    if (r.data) { R.push(r.data); R.sort(function (a, b) { return a.remind_on < b.remind_on ? -1 : 1 }); render(); $('gr-rem-form').reset() } return false;
  }
  async function doneRem(id) {
    var r = R.filter(function (x) { return x.id === id })[0]; if (!r) return;
    var patch = r.repeat !== 'none' ? { remind_on: next(r.remind_on, r.repeat) } : { done: true };
    while (r.repeat !== 'none' && patch.remind_on <= today()) patch.remind_on = next(patch.remind_on, r.repeat);
    var res = await supabaseClient.from('user_reminders').update(patch).eq('id', id).select().single();
    if (res.data) { Object.assign(r, res.data); render() }
  }
  async function delRem(id) { await supabaseClient.from('user_reminders').delete().eq('id', id); R = R.filter(function (x) { return x.id !== id }); render() }
  async function delGoal(id) { await supabaseClient.from('user_goals').delete().eq('id', id); G = G.filter(function (x) { return x.id !== id }); render() }
  async function bump(id, n) { var g = G.filter(function (x) { return x.id === id })[0]; if (!g) return; var v = (g.current || 0) + n; var r = await supabaseClient.from('user_goals').update({ current: v, done: !!(g.target && v >= g.target) }).eq('id', id).select().single(); if (r.data) { Object.assign(g, r.data); render() } }
  async function toggle(id) { var g = G.filter(function (x) { return x.id === id })[0]; if (!g) return; var r = await supabaseClient.from('user_goals').update({ done: !g.done }).eq('id', id).select().single(); if (r.data) { Object.assign(g, r.data); render() } }
  function setRenewal(d) {
    var m = $('m-renewal'), i = $('acc-renewal'); if (i) i.value = d || '';
    if (!m) return; if (!d) { m.textContent = 'Set date'; return }
    var p = d.split('-'); m.textContent = new Date(+p[0], p[1] - 1, +p[2]).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }
  async function saveRenewal() {
    var v = $('acc-renewal').value || null, msg = $('acc-renewal-msg');
    var r = await supabaseClient.from('profiles').update({ renewal_date: v }).eq('id', currentUser.id).select('renewal_date').single();
    if (!r.data) { msg.textContent = 'Could not save. Try again.'; return }
    try { currentProfile.renewal_date = v } catch (e) {}
    setRenewal(v); msg.textContent = v ? 'Saved.' : 'Cleared.';
  }
  async function setEmail(on) {
    var r = await supabaseClient.from('profiles').update({ email_reminders: !!on }).eq('id', currentUser.id).select('email_reminders').single(), m = $('gr-email-msg');
    if (!r.data) { $('gr-email').checked = !on; if (m) m.textContent = 'Could not save that. Try again.'; return }
    if (m) m.textContent = on ? 'Email reminders are on. You can unsubscribe from any email.' : 'Email reminders are off.'
  }
  return { setRenewal: setRenewal, saveRenewal: saveRenewal, setEmail: setEmail, load: load, addGoal: addGoal, addRem: addRem, doneRem: doneRem, delRem: delRem, delGoal: delGoal, bump: bump, toggle: toggle, kindChange: kindChange, _state: function () { return { G: G, R: R } } };
})();
(function () {
  try {
    var u = new URLSearchParams(location.search).get('unsub'); if (!u) return;
    var d = document.createElement('div'); d.setAttribute('role', 'status');
    d.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:950;background:#fff;border:2px solid #111;border-radius:8px;padding:10px 16px;font-size:14px;box-shadow:0 6px 24px rgba(0,0,0,.18)';
    d.textContent = u === 'done' ? 'You are unsubscribed from VoltCE reminder emails.' : 'That unsubscribe link is not valid. You can turn emails off in your dashboard.';
    document.body.appendChild(d); setTimeout(function () { d.remove() }, 8000);
  } catch (e) {}
})();
