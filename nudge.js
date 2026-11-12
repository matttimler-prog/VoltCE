/* VoltCE reminders: (1) free-account nudge, (2) one random donate nudge per session.
   Both are small dismissible corner cards. They never overlap, never show on the sign-in page,
   and are rate-limited with localStorage so returning visitors are not nagged. */
(function () {
  var CFG = {
    signupAfterSec: 240,      // active time on site before the account nudge (4 min)
    signupCooldownDays: 7,    // after dismissing, wait this long
    donateChance: 0.5,        // chance a given session gets a donate nudge at all
    donateMinSec: 420,        // random delay window for the donate nudge (7 to 14 min of active time)
    donateMaxSec: 840,
    donateCooldownDays: 21,   // at most once per 3 weeks per browser
    gapSec: 90                // minimum gap between the two nudges
  };
  var KEY = 'voltce_nudge';
  var st = {};
  try { st = JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)) } catch (e) {} }
  function days(ts) { return (Date.now() - (ts || 0)) / 86400000 }
  var q = {}; try { q = new URLSearchParams(location.search) } catch (e) {}
  if (q.get && q.get('nonudge') === '1') return;

  var active = 0, shownAt = 0, el = null, kind = null;
  var donateAt = (Math.random() < CFG.donateChance) ? Math.round(CFG.donateMinSec + Math.random() * (CFG.donateMaxSec - CFG.donateMinSec)) : -1;
  var signupDone = false, donateDone = false;
  if (window.__nudgeTest) { CFG = Object.assign(CFG, window.__nudgeTest); donateAt = CFG.forceDonateAt != null ? CFG.forceDonateAt : donateAt; }

  var css = document.createElement('style');
  css.textContent =
    '.vcn{position:fixed;right:16px;bottom:16px;z-index:900;max-width:340px;width:calc(100vw - 32px);background:#fff;color:var(--ink,#111);border:2px solid var(--ink,#111);border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:14px 16px 14px;font-family:inherit;transform:translateY(12px);opacity:0;transition:transform .25s ease,opacity .25s ease}' +
    '.vcn.on{transform:none;opacity:1}' +
    '.vcn h4{margin:0 24px 4px 0;font-size:15px;line-height:1.3}' +
    '.vcn p{margin:0 0 10px;font-size:13px;line-height:1.45;color:var(--muted,#555)}' +
    '.vcn .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
    '.vcn button{font:inherit;font-size:13px;cursor:pointer;border-radius:6px;padding:7px 12px}' +
    '.vcn .go{background:var(--ink,#111);color:#fff;border:1px solid var(--ink,#111);font-weight:500}' +
    '.vcn .go:hover{background:var(--blue,#1B5FC0)}' +
    '.vcn .no{background:none;border:none;color:var(--muted,#555);text-decoration:underline;padding:7px 4px}' +
    '.vcn .x{position:absolute;top:6px;right:8px;background:none;border:none;font-size:20px;line-height:1;color:var(--muted,#555);padding:2px 6px}' +
    '.vcn button:focus-visible{outline:2px solid var(--blue,#1B5FC0);outline-offset:2px}' +
    '@media (prefers-reduced-motion:reduce){.vcn{transition:none}}' +
    '@media (max-width:520px){.vcn{right:8px;left:8px;bottom:8px;width:auto;max-width:none}}';
  document.head.appendChild(css);

  function onAuthPage() { var p = document.getElementById('page-auth'); return !!(p && p.classList.contains('active')) }
  function signedIn() { try { return !!currentUser } catch (e) { return false } }

  function hide(persist) {
    if (!el) return;
    var e = el; el = null; e.classList.remove('on');
    setTimeout(function () { e.remove() }, 300);
    var k = kind; kind = null; shownAt = active;
    if (persist && k === 'signup') { st.signupDismissed = Date.now(); save() }
  }
  function build(k, title, body, goLabel, noLabel, onGo) {
    if (el) return;
    kind = k; shownAt = active;
    el = document.createElement('div');
    el.className = 'vcn'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', title);
    el.innerHTML = '<button class="x" aria-label="Close">×</button><h4></h4><p></p><div class="row"><button class="go"></button><button class="no"></button></div>';
    el.querySelector('h4').textContent = title;
    el.querySelector('p').textContent = body;
    el.querySelector('.go').textContent = goLabel;
    el.querySelector('.no').textContent = noLabel;
    el.querySelector('.x').onclick = el.querySelector('.no').onclick = function () { hide(true) };
    el.querySelector('.go').onclick = function () { if (k === 'signup') { st.signupDismissed = Date.now(); save() } hide(false); onGo() };
    document.body.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el && el.classList.add('on') }) });
    try { trk('nudge_shown', k) } catch (e) {}
  }

  function showSignup() {
    signupDone = true;
    build('signup', 'Save your progress with a free account',
      'Free accounts keep your completed lessons and CEU records in one place. Study goals and reminders are coming to accounts next, and members get them first.',
      'Create free account', 'Not now', function () {
        try { trk('nudge_click', 'signup') } catch (e) {}
        showPage('auth'); if (typeof authMode !== 'undefined' && authMode === 'login') toggleAuthMode();
      });
  }
  function showDonate() {
    donateDone = true; st.donateShown = Date.now(); save();
    build('donate', 'VoltCE stays free because of people like you',
      'If these classes have helped you, a small donation keeps them free for the next electrician. No pressure at all.',
      'Donate', 'Maybe later', function () { try { trk('nudge_click', 'donate') } catch (e) {} donate() });
  }

  setInterval(function () {
    if (document.hidden) return;
    active++;
    if (el) { if (signedIn() && kind === 'signup') hide(false); return; }
    if (onAuthPage()) return;
    if (shownAt && active - shownAt < CFG.gapSec) return;
    if (!signupDone && !signedIn() && active >= CFG.signupAfterSec && days(st.signupDismissed) >= CFG.signupCooldownDays) return showSignup();
    if (!donateDone && donateAt >= 0 && active >= donateAt && days(st.donateShown) >= CFG.donateCooldownDays) return showDonate();
  }, 1000);

  window.VCNudge = { cfg: CFG, state: function () { return { active: active, donateAt: donateAt, kind: kind, st: st } } };
})();
