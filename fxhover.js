/* Hover / tap effects for selections: the topic's symbol draws in, plus a themed burst
   (splash for pools, embers for fuel and fire, sparks for electrical, spin for motors). */
(function () {
  const SEL = '.course-card:not(.locked), .rec[onclick], .sec-chip, .card-sm[onclick], [data-fx]';
  const WATER = /^(pool|boat|pump)$/, FIRE = /^(flame|fuel)$/, SPIN = /^(motor|hvac|wind|pump|generator|fan)$/, RING = /^(bell|speaker|antenna)$/;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const labelOf = el => {
    const d = el.getAttribute('data-fx-label'); if (d) return d;
    const h = el.querySelector('h1,h2,h3,h4,b,strong,.t'); return ((h || el).textContent || '').trim().slice(0, 90);
  };
  const kind = key => WATER.test(key) ? 'water' : FIRE.test(key) ? 'fire' : 'spark';
  const rnd = (a, b) => a + Math.random() * (b - a);

  function ensure(el) {
    let o = el.querySelector(':scope > .fxo'); if (o) return o;
    const label = labelOf(el); const key = VCSYM.keyFor(label) || 'bolt';
    o = document.createElement('div'); o.className = 'fxo' + (el.classList.contains('sec-chip') ? ' open' : ''); o.setAttribute('aria-hidden', 'true'); o.dataset.key = key;
    if (!el.classList.contains('sec-chip')) {
      const s = document.createElement('div'); const k = kind(key);
      s.className = 'fxsym ' + (k === 'water' ? 'water ' : k === 'fire' ? 'fire ' : '') + (SPIN.test(key) ? 'spin ' : RING.test(key) ? 'ring ' : '');
      s.innerHTML = VCSYM.svg(key, 92); s.querySelectorAll('path,line,circle,rect,polyline,polygon,ellipse').forEach(n => n.setAttribute('pathLength', '1'));
      o.appendChild(s);
    }
    el.appendChild(o); return o;
  }

  function burst(host, key, x, y, big) {
    if (reduce) return; const k = kind(key); const n = big ? 22 : 12;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i'); p.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;pointer-events:none;';
      let kf, dur = rnd(500, 950);
      if (k === 'water') {
        const a = rnd(-Math.PI * .85, -Math.PI * .15), v = rnd(30, big ? 110 : 70);
        p.style.cssText += 'width:' + rnd(4, 8) + 'px;height:' + rnd(6, 10) + 'px;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;background:linear-gradient(#7fc4ff,#1B75D0);';
        kf = [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + Math.cos(a) * v + 'px,' + Math.sin(a) * v + 'px) scale(1)', opacity: 1, offset: .45 }, { transform: 'translate(' + Math.cos(a) * v * 1.3 + 'px,' + (Math.sin(a) * v + 70) + 'px) scale(.4)', opacity: 0 }];
      } else if (k === 'fire') {
        p.style.cssText += 'width:' + rnd(3, 6) + 'px;height:' + rnd(3, 6) + 'px;border-radius:50%;background:' + (Math.random() > .5 ? '#FF9D00' : '#E8590C') + ';box-shadow:0 0 6px #FF9D00;';
        kf = [{ transform: 'translate(0,0)', opacity: 1 }, { transform: 'translate(' + rnd(-30, 30) + 'px,' + -rnd(40, 110) + 'px) scale(.2)', opacity: 0 }]; dur += 300;
      } else {
        const a = rnd(0, Math.PI * 2), v = rnd(20, big ? 90 : 60);
        p.style.cssText += 'width:' + rnd(2, 3.5) + 'px;height:' + rnd(10, 18) + 'px;border-radius:2px;background:linear-gradient(#FFD23A,#FF9D00);box-shadow:0 0 6px #FFD23A;transform-origin:50% 50%;';
        kf = [{ transform: 'translate(0,0) rotate(' + (a * 57.3 + 90) + 'deg)', opacity: 1 }, { transform: 'translate(' + Math.cos(a) * v + 'px,' + Math.sin(a) * v + 'px) rotate(' + (a * 57.3 + 90) + 'deg) scaleY(.3)', opacity: 0 }]; dur = rnd(300, 600);
      }
      host.appendChild(p); p.animate(kf, { duration: dur, easing: 'cubic-bezier(.2,.7,.4,1)', delay: rnd(0, 120) }).onfinish = () => p.remove();
    }
    if (k === 'water') for (let r = 0; r < 2; r++) {
      const w = document.createElement('i'); w.style.cssText = 'position:absolute;left:' + (x - 6) + 'px;top:' + (y - 3) + 'px;width:12px;height:6px;border:2px solid rgba(27,117,208,.7);border-radius:50%;pointer-events:none;';
      host.appendChild(w); w.animate([{ transform: 'scale(1)', opacity: .9 }, { transform: 'scale(' + (big ? 14 : 9) + ')', opacity: 0 }], { duration: 900, delay: r * 220, easing: 'ease-out' }).onfinish = () => w.remove();
    }
  }

  const cool = new WeakMap();
  function enter(el) {
    el.classList.add('fx-hot'); const o = ensure(el);
    const t = Date.now(); if (cool.get(el) > t - 700) return; cool.set(el, t);
    const s = o.querySelector('.fxsym'); const w = el.clientWidth, h = el.clientHeight;
    s && s.querySelectorAll('*').forEach(n => { n.style.animation = 'none'; void n.getBoundingClientRect(); n.style.animation = '' });
    burst(o, o.dataset.key, s ? w - 56 : 24, s ? h - 52 : el.clientHeight / 2, false);
  }
  function leave(el) { el.classList.remove('fx-hot') }

  document.addEventListener('pointerover', e => { const el = e.target.closest && e.target.closest(SEL); if (!el || el.contains(e.relatedTarget)) return; try { enter(el) } catch (x) {} });
  document.addEventListener('pointerout', e => { const el = e.target.closest && e.target.closest(SEL); if (!el || el.contains(e.relatedTarget)) return; leave(el) });
  document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest(SEL); if (el) try { enter(el) } catch (x) {} });
  document.addEventListener('focusout', e => { const el = e.target.closest && e.target.closest(SEL); if (el) leave(el) });

  /* page-level splash / spark where you click */
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest(SEL); if (!el || reduce) return;
    const key = (el.querySelector(':scope > .fxo') || ensure(el)).dataset.key;
    const host = document.createElement('div'); host.className = 'fxclick'; host.style.cssText = 'position:fixed;left:' + e.clientX + 'px;top:' + e.clientY + 'px;width:0;height:0;z-index:9999;pointer-events:none';
    document.body.appendChild(host); burst(host, key, 0, 0, true); setTimeout(() => host.remove(), 1600);
  }, true);
})();
