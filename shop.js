/* VoltCE apparel page. Products are sold in the VoltCE Fourthwall shop; PRODUCTS maps a design id to its product page. */
(function () {
  'use strict'
  var SHOP_URL = 'https://voltce-shop.fourthwall.com'
  var PRODUCTS = {"VC-001":"wire-nuts-are-just-tiny-hats-tee","VC-002":"i-make-it-work-until-the-inspector-shows-up-tee","VC-003":"powered-by-coffee-grounded-by-reality-tee","VC-004":"ohm-my-gosh-tee","VC-005":"resistance-is-futile-unless-it-is-10-ohms-tee","VC-006":"hot-take-neutral-is-not-a-ground-tee","VC-007":"trust-me-i-checked-i-did-not-check-tee","VC-008":"is-it-live-test-do-not-guess-tee","VC-009":"shockingly-good-dad-jokes-delivered-daily-tee","VC-010":"breaker-breaker-who-moved-my-panel-schedule-tee","VC-011":"it-was-like-that-when-i-got-here-tee","VC-012":"light-switch-whisperer-tee","VC-013":"another-day-another-ampere-tee","VC-014":"conduit-fill-is-my-love-language-tee","VC-015":"always-leave-a-pull-string-tee","VC-016":"measure-twice-bend-once-swear-thrice-tee","VC-017":"may-your-loads-be-balanced-tee","VC-018":"balanced-loads-balanced-life-tee","VC-019":"mind-your-neutrals-tee","VC-020":"tripped-breaker-tripped-electrician-tee","VC-021":"wiring-is-my-cardio-tee","VC-022":"fish-tape-fisherman-tee","VC-023":"dead-front-live-humor-tee","VC-024":"amp-up-your-day-tee","VC-025":"let-us-get-grounded-tee","VC-026":"panel-schedules-lie-tee","VC-027":"not-all-heroes-wear-capes-some-wear-pouches-tee","VC-028":"live-dead-live-test-before-you-touch-tee","VC-029":"do-not-make-me-pull-your-permit-tee","VC-030":"sorry-i-am-late-i-was-looking-for-the-neutral-tee","VC-031":"where-is-the-disconnect-tee","VC-032":"cut-it-twice-it-is-still-short-tee","VC-033":"romex-whisperer-tee","VC-034":"lights-out-call-me-tee","VC-035":"i-light-up-your-life-tee","VC-036":"high-voltage-low-patience-tee","VC-037":"tight-connections-loose-humor-tee","VC-038":"torque-spec-matters-tee","VC-039":"fully-rated-fully-caffeinated-tee","VC-040":"i-speak-fluent-voltage-tee","VC-041":"voltce-bolt-logo-tee","VC-042":"study-hard-stay-grounded-tee","VC-043":"pass-the-exam-power-the-world-tee","VC-044":"journeyman-mode-on-tee","VC-045":"master-mode-loading-tee","VC-046":"continuing-education-never-stops-tee","VC-047":"ceu-hours-earned-tee","VC-061":"ohms-law-v-i-x-r-tee","VC-062":"watts-law-p-i-x-v-tee","VC-063":"electricians-say-e-i-x-r-tee"}
  var LABEL = { all: 'All designs', funny: 'Funny electrical', voltce: 'VoltCE', theory: 'Theory and formulas' }
  var cat = 'all'
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function mount(root) {
    var D = window.SHOP_DESIGNS || []
    function draw() {
      var list = D.filter(function (d) { return cat === 'all' || d.c === cat })
      var note = SHOP_URL
        ? '<div class="sh-note"><b>The VoltCE store is open.</b> Tees are made to order, and checkout and shipping are handled by our store partner, Fourthwall. Designs marked Coming soon are not in the store yet. <a class="sh-btn" href="' + esc(SHOP_URL + '/collections/all') + '" target="_blank" rel="noopener">Shop all apparel</a></div>'
        : '<div class="sh-note"><b>The store is opening soon.</b> These are the designs coming to shirts, hoodies and mugs. Orders are not open yet, so nothing here can be bought today.</div>'
      root.innerHTML = '<div class="sh-wrap">' + note + '<div class="sh-tabs" role="tablist">' +
        Object.keys(LABEL).map(function (k) { return '<button type="button" class="sh-tab' + (k === cat ? ' on' : '') + '" data-c="' + k + '">' + LABEL[k] + (k === 'all' ? ' (' + D.length + ')' : '') + '</button>' }).join('') +
        '</div><div class="sh-grid">' + list.map(function (d) {
          return '<div class="sh-card"><img loading="lazy" width="480" height="576" src="/shop/' + d.id + '.png" alt="' + esc(d.t.replace(/ \/ /g, ', ')) + ' apparel design"><div class="sh-cap">' + esc(d.t.replace(/ \/ /g, ' ')) + (SHOP_URL && PRODUCTS[d.id] ? '<a class="sh-btn sh-buy" href="' + esc(SHOP_URL + '/products/' + PRODUCTS[d.id]) + '" target="_blank" rel="noopener">Buy tee $27.99</a>' : '<span class="sh-soon">Coming soon</span>') + '</div></div>'
        }).join('') + '</div></div>'
      root.querySelectorAll('.sh-tab').forEach(function (b) { b.onclick = function () { cat = b.dataset.c; draw() } })
    }
    draw()
  }
  window.Shop = { mount: mount }
})()
