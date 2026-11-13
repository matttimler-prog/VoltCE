/* VoltCE app install: registers the service worker and shows an "Install app" button when the browser allows it.
   iPhone and iPad Safari cannot prompt, so the button shows the Share > Add to Home Screen steps instead. */
(function () {
  var q = new URLSearchParams(location.search)
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !q.get('nosw')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}) })
  }
  if (standalone) { try { document.documentElement.classList.add('is-app') } catch (e) {} return }
  var deferred = null, ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  var safari = /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios|chrome/i.test(navigator.userAgent)
  function btn() { return document.getElementById('nav-install-btn') }
  function show() { var b = btn(); if (b) b.style.display = '' }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; show() })
  window.addEventListener('appinstalled', function () { var b = btn(); if (b) b.style.display = 'none'; deferred = null; try { trk('app_installed', 'pwa') } catch (e) {} })
  document.addEventListener('DOMContentLoaded', function () { if (ios && safari) show() })
  if (document.readyState !== 'loading' && ios && safari) show()
  window.installApp = function () {
    try { trk('install_click', 'pwa') } catch (e) {}
    if (deferred) { deferred.prompt(); deferred.userChoice.finally(function () { deferred = null; var b = btn(); if (b) b.style.display = 'none' }); return }
    var d = document.createElement('div'); d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Install VoltCE')
    d.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;padding:16px'
    d.innerHTML = '<div style="background:#fff;color:#111;border-radius:12px;max-width:380px;width:100%;padding:18px 20px;font-size:14px;line-height:1.5"><b style="font-size:16px">Install VoltCE on your iPhone or iPad</b><ol style="margin:10px 0 14px;padding-left:20px"><li>Tap the Share button in Safari (the square with an arrow).</li><li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>. VoltCE opens full screen from its own icon.</li></ol><button style="font:inherit;padding:8px 14px;border:1px solid #111;background:#111;color:#fff;border-radius:6px;cursor:pointer">Got it</button></div>'
    d.addEventListener('click', function (e) { if (e.target === d || e.target.tagName === 'BUTTON') d.remove() })
    document.body.appendChild(d)
  }
})()
