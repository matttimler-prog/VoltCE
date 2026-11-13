/* Shareable circuits: the whole model travels in the link (compressed, after the # so no server is involved). */
var Share = (function () {
  var initial = location.hash || '', used = false
  var KINDS = { lab: { page: 'page-lab', path: 'circuit-lab', get: function () { return Lab.model() }, set: function (m) { Lab.load(m) } },
    svc: { page: 'page-svc', path: 'service-panel-builder', get: function () { return Svc.model() }, set: function (m) { Svc.load(m) } },
    ladder: { page: 'page-ladder', path: 'ladder-logic', get: function () { return Ladder.model() }, set: function (m) { Ladder.load(m) } } }
  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
  function unb64(t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var s = atob(t), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u }
  async function pipe(u8, S) { var cs = new S('deflate-raw'), w = cs.writable.getWriter(); w.write(u8); w.close(); return new Uint8Array(await new Response(cs.readable).arrayBuffer()) }
  async function encode(obj) {
    var raw = new TextEncoder().encode(JSON.stringify(obj))
    if (typeof CompressionStream !== 'undefined') { try { return 'z' + b64(await pipe(raw, CompressionStream)) } catch (e) {} }
    return 'r' + b64(raw)
  }
  async function decode(t) {
    var u8 = unb64(t.slice(1))
    if (t[0] === 'z') u8 = await pipe(u8, DecompressionStream)
    return JSON.parse(new TextDecoder().decode(u8))
  }
  async function link(kind) { var k = KINDS[kind]; return 'https://voltceu.com/' + k.path + '#s=' + await encode(k.get()) }
  function toast(msg) {
    var d = document.createElement('div'); d.setAttribute('role', 'status'); d.textContent = msg
    d.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:950;background:#111;color:#fff;border-radius:8px;padding:10px 16px;font-size:14px;max-width:90vw'
    document.body.appendChild(d); setTimeout(function () { d.remove() }, 3500)
  }
  async function copy(kind) {
    try {
      var u = await link(kind)
      try { await navigator.clipboard.writeText(u); toast('Link copied. Anyone with it opens your design.') }
      catch (e) { window.prompt('Copy this link', u) }
      try { trk('share_copy', kind) } catch (e) {}
    } catch (e) { toast('Could not make a link for this design.') }
  }
  // called after a lab mounts: open a shared design if the page was opened from a share link
  async function open(kind) {
    if (used || !/^#s=/.test(initial)) return false
    var k = KINDS[kind]; if (!k) return false
    if (location.pathname.replace(/^\//, '') !== k.path && document.getElementById(k.page) && !document.getElementById(k.page).classList.contains('active')) return false
    used = true
    try { var m = await decode(initial.slice(3)); k.set(m); toast('Opened a shared design. Your own saved work is untouched until you change something.'); try { trk('share_open', kind) } catch (e) {} return true }
    catch (e) { toast('That share link could not be read.'); return false }
  }
  function mountButtons() {
    Object.keys(KINDS).forEach(function (kind) {
      var pg = document.getElementById(KINDS[kind].page); if (!pg) return
      var row = pg.querySelector('.lab-disc'); if (!row || row.querySelector('.sh-btn')) return
      var b = document.createElement('button'); b.className = 'sh-btn'; b.textContent = 'Copy share link'; b.onclick = function () { copy(kind) }
      row.appendChild(b)
    })
  }
  var css = document.createElement('style'); css.textContent = '.lab-disc{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.sh-btn{font:inherit;font-size:12px;cursor:pointer;border:1px solid var(--blue);background:#fff;color:var(--blue-dark);border-radius:6px;padding:4px 10px}.sh-btn:hover{background:var(--blue-light)}'
  document.head.appendChild(css)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountButtons); else mountButtons()
  return { encode: encode, decode: decode, link: link, copy: copy, open: open }
})()
