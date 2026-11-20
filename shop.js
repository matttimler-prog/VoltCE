/* VoltCE apparel page. Set SHOP_URL to the live store address when the store exists. */
(function () {
  'use strict'
  var SHOP_URL = ''
  var LABEL = { all: 'All designs', funny: 'Funny electrical', voltce: 'VoltCE', theory: 'Theory and formulas' }
  var cat = 'all'
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function mount(root) {
    var D = window.SHOP_DESIGNS || []
    function draw() {
      var list = D.filter(function (d) { return cat === 'all' || d.c === cat })
      var note = SHOP_URL
        ? '<div class="sh-note"><b>The VoltCE store is open.</b> <a class="sh-btn" href="' + esc(SHOP_URL) + '" target="_blank" rel="noopener">Shop apparel</a></div>'
        : '<div class="sh-note"><b>The store is opening soon.</b> These are the designs coming to shirts, hoodies and mugs. Orders are not open yet, so nothing here can be bought today.</div>'
      root.innerHTML = '<div class="sh-wrap">' + note + '<div class="sh-tabs" role="tablist">' +
        Object.keys(LABEL).map(function (k) { return '<button type="button" class="sh-tab' + (k === cat ? ' on' : '') + '" data-c="' + k + '">' + LABEL[k] + (k === 'all' ? ' (' + D.length + ')' : '') + '</button>' }).join('') +
        '</div><div class="sh-grid">' + list.map(function (d) {
          return '<div class="sh-card"><img loading="lazy" width="480" height="576" src="/shop/' + d.id + '.png" alt="' + esc(d.t.replace(/ \/ /g, ', ')) + ' apparel design"><div class="sh-cap">' + esc(d.t.replace(/ \/ /g, ' ')) + '</div></div>'
        }).join('') + '</div></div>'
      root.querySelectorAll('.sh-tab').forEach(function (b) { b.onclick = function () { cat = b.dataset.c; draw() } })
    }
    draw()
  }
  window.Shop = { mount: mount }
})()
