/* "Try it in the Lab" links on practice answers, deep links into the labs, and the lab disclaimer style. */
var LabLink = (function () {
  var RULES = [
    [/motor/i, { lab: 'lab', ex: 'starter', t: 'Run a motor starter in Circuit Lab' }],
    [/transformer/i, { lab: 'lab', ex: 'xfmr', t: 'Try a transformer in Circuit Lab' }, { lab: 'svc', ex: 'plant', t: 'See transformers in a service' }],
    [/three-phase|3-phase|phase/i, { lab: 'lab', ex: 'dy', t: 'Try three-phase in Circuit Lab' }],
    [/short-circuit|fault|overcurrent|coordination/i, { lab: 'lab', ex: 'short', t: 'See a short circuit trip a breaker' }, { lab: 'svc', ex: 'trouble', t: 'Find fault-current problems in Service Builder' }],
    [/voltage drop/i, { lab: 'svc', ex: 'garage', t: 'Check voltage drop in Service Builder' }],
    [/dwelling|branch circuit|service/i, { lab: 'svc', ex: 'home', t: 'Build a home service' }, { lab: 'n220', t: 'Open the NEC 220 load calculator' }],
    [/commercial|multi-family|feeder/i, { lab: 'svc', ex: 'office', t: 'Open a commercial service' }, { lab: 'n220', t: 'Open the NEC 220 load calculator' }],
    [/conductor|ampacity|parallel/i, { lab: 'svc', ex: 'office', t: 'Size conductors in Service Builder' }],
    [/series|parallel circuits|ohm|kirchhoff|power|circuit components|energy/i, { lab: 'lab', ex: 'lamp', t: 'Build it in Circuit Lab' }]
  ]
  function pick(q) { var c = (q && (q.c || q.ar || '')) + ''; for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(c)) return RULES[i].slice(1, 3); return [] }
  function html(q) {
    var l = pick(q); if (!l.length) return ''
    return '<div class="ll-row"><span>Try it:</span>' + l.map(function (x) { return '<button onclick="openLab(\'' + x.lab + '\',' + (x.ex ? '\'' + x.ex + '\'' : 'null') + ')">' + x.t + '</button>' }).join('') + '</div>'
  }
  function apply(kind) {
    var p = window._labPending; if (!p || p.kind !== kind) return; window._labPending = null
    try {
      if (kind === 'lab' && p.id) Lab.loadExample(p.id)
      else if (kind === 'svc' && p.id) { var e = SvcCore.examples.filter(function (x) { return x.id === p.id })[0]; if (e) Svc.load(e.build()) }
      else if (kind === 'ladder' && p.id) Ladder.loadExample(p.id)
    } catch (e) {}
  }
  var css = document.createElement('style')
  css.textContent = '.ll-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px;font-size:13px}.ll-row span{color:var(--muted)}.ll-row button{font:inherit;font-size:13px;cursor:pointer;border:1px solid var(--blue);background:#fff;color:var(--blue-dark);border-radius:6px;padding:5px 10px}.ll-row button:hover{background:var(--blue-light)}.lab-disc{max-width:1200px;margin:0 auto;padding:0 16px 10px;font-size:12px;color:var(--muted)}'
  document.head.appendChild(css)
  return { html: html, apply: apply, pick: pick }
})()
function openLab(kind, id) { window._labPending = { kind: kind, id: id }; showPage(kind) }
