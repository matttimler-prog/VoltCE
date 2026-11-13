/* VoltCE service worker: network first, so a new deploy always wins; cached copies are used only when offline or very slow.
   Only same-origin GET requests are handled. Sign-in, database, payments and analytics are never touched. */
const CACHE = 'voltce-v1'
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png']
const OFFLINE = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VoltCE offline</title><body style="font-family:system-ui,sans-serif;background:#0A1A3D;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px"><div><h1>You are offline</h1><p>VoltCE needs a connection the first time you open a page. Pages you have already opened still work. Reconnect and reload to continue.</p></div>'

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())) })
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())) })

function fromNet(req, ms) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('slow')), ms)
    fetch(req).then(r => { clearTimeout(t); res(r) }, e => { clearTimeout(t); rej(e) })
  })
}
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname === '/sw.js' || url.pathname.startsWith('/_vercel/')) return
  const nav = req.mode === 'navigate'
  e.respondWith((async () => {
    const cache = await caches.open(CACHE)
    try {
      const r = await fromNet(req, nav ? 8000 : 6000)
      if (r && r.status === 200 && r.type === 'basic') cache.put(req, r.clone())
      return r
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: !nav ? false : true })
      if (hit) return hit
      if (nav) { const shell = await cache.match('/'); if (shell) return shell; return new Response(OFFLINE, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }) }
      return new Response('', { status: 504 })
    }
  })())
})
