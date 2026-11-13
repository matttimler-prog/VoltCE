"""Regenerates vercel.json, sitemap.xml and robots.txt from the pages defined in index.html.
Run after adding a state: python3 build_routes.py"""
import re, json, os, sys, html as _h
h = open('index.html').read()
slugify = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
import subprocess
TRACKED = set(subprocess.run(['git', 'ls-files'], capture_output=True, text=True).stdout.split()) if os.path.isdir('.git') else set()
slugs = ['courses', 'states', 'pricing', 'circuit-lab', 'ladder-logic', 'service-panel-builder', 'nec-220-load-calculator', 'wisconsin', 'florida-contractor']
for m in re.finditer(r"^  (\w+): \{ name: ['\"]([^'\"]+)['\"], ed: '", h, re.M):
    s = slugify(m.group(2))
    if s not in slugs: slugs.append(s)
for s in slugs:
    assert s not in TRACKED and s + '.html' not in TRACKED, s
alt = '|'.join(slugs)
HEAD = [
    {"source": "/(.*)", "headers": [
        {"key": "X-Content-Type-Options", "value": "nosniff"},
        {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"},
        {"key": "X-Frame-Options", "value": "SAMEORIGIN"}]}]
cfg = {"cleanUrls": True, "trailingSlash": False, "buildCommand": "python3 build_routes.py --pages",
       "headers": HEAD, "rewrites": [{"source": "/(" + alt + ")", "destination": "/index.html"}]}
json.dump(cfg, open('vercel.json', 'w'), indent=2); open('vercel.json', 'a').write('\n')
urls = ['https://voltceu.com/'] + ['https://voltceu.com/' + s for s in slugs]
open('sitemap.xml', 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join('  <url><loc>%s</loc></url>\n' % u for u in urls) + '</urlset>\n')
open('robots.txt', 'w').write('User-agent: *\nAllow: /\nSitemap: https://voltceu.com/sitemap.xml\n')
print(len(slugs), 'routes')

# ---- static copy of index.html per address, with its own title, description, canonical, social tags and plain-text content ----
if '--pages' in sys.argv:
    E = _h.escape
    cfgs = {}
    for m in re.finditer(r"^  (\w+): \{ name: ['\"]([^'\"]+)['\"], ed: '([^']*)'(.*)$", h, re.M):
        nm = re.search(r'note: "([^"]*)"', m.group(4))
        cfgs[slugify(m.group(2))] = (m.group(2), m.group(3), nm.group(1) if nm else '')
    other = {'circuit-lab': ('Circuit Lab: build and simulate electrical circuits | VoltCE', 'Free circuit constructor for motors, transformers and control circuits. Wire it right and watch it run, wire it wrong and watch it fail. Export a wiring diagram.'),
             'ladder-logic': ('Ladder logic editor and simulator | VoltCE', 'Free ladder logic editor with a live PLC simulation. Build rungs with contacts, coils, timers and counters, then export Structured Text.'),
             'nec-220-load-calculator': ('NEC 220 load calculation lab | VoltCE', 'Free NEC 220 load calculation lab for houses, offices, stores, schools, hospitals, hotels, warehouses and multi-family buildings, with the code section beside every step.'),
             'service-panel-builder': ('Service and panel builder | VoltCE', 'Free electrical service and panel builder: size breakers and wire, check voltage drop and fault current, and learn how services and distribution work.'),
             'courses': ('Electrician continuing education courses | VoltCE', 'Online electrician continuing education courses from VoltCE.'),
             'states': ('Electrician exam prep by state | VoltCE', 'Pick your state for free electrician exam prep, license links and continuing education hours.'),
             'pricing': ('Pricing | VoltCE', 'VoltCE pricing for electrician continuing education courses.'),
             'wisconsin': ('Wisconsin electrician exam prep | VoltCE', 'Free Wisconsin electrician exam practice questions and flashcards.'),
             'florida-contractor': ('Florida electrical contractor exam prep | VoltCE', 'Free Florida electrical contractor exam practice questions.')}
    links = open('state-links.js').read(); links = json.loads(links[links.index('=') + 1:].rstrip().rstrip(';'))
    names = {slugify(v[0]): v[0] for v in cfgs.values()}
    allnav = ''.join('<a href="/%s">%s</a> ' % (k, E(v[0])) for k, v in sorted(cfgs.items()))
    img = 'https://voltceu.com/brand/icon-512.png'
    for slug in slugs:
        if slug in cfgs:
            name, ed, note = cfgs[slug]
            t = '%s electrician exam prep%s | VoltCE' % (name, ' (%s)' % ed if ed else '')
            d = 'Free %s electrician exam practice: state rules questions, %s code questions, flashcards and a keyword index. Study practice by VoltCE, not official exam questions.' % (name, ed or 'NEC')
            body = '<h1>%s electrician exam prep</h1>' % E(name) + ('<p>%s</p>' % E(note) if note else '')
            L = links.get(name) or []
            if L: body += '<h2>Licensing and exam links</h2><ul>' + ''.join('<li><a href="%s">%s</a> (%s)</li>' % (E(x['url']), E(x['title']), E(x['category'])) for x in L[:12]) + '</ul>'
        else:
            t, d = other[slug]
            body = '<h1>%s</h1><p>%s</p>' % (E(t.split(' | ')[0]), E(d))
        url = 'https://voltceu.com/' + slug
        ld = json.dumps({"@context": "https://schema.org", "@type": "WebPage", "name": t, "description": d, "url": url,
                         "isPartOf": {"@type": "WebSite", "name": "VoltCE", "url": "https://voltceu.com/"}})
        tags = ('<link rel="canonical" href="%s">\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="VoltCE">\n'
                '<meta property="og:title" content="%s">\n<meta property="og:description" content="%s">\n<meta property="og:url" content="%s">\n<meta property="og:image" content="%s">\n'
                '<meta name="twitter:card" content="summary">\n<script type="application/ld+json">%s</script>\n') % (url, E(t), E(d), url, img, ld.replace('</', '<\\/'))
        out = h
        out = re.sub(r'<title>.*?</title>', lambda m: '<title>%s</title>' % E(t), out, count=1, flags=re.S)
        out = re.sub(r'(<meta name="description" content=")[^"]*"', lambda m: m.group(1) + E(d) + '"', out, count=1)
        out = out.replace('<link rel="canonical" href="https://voltceu.com/">\n', tags, 1)
        out = re.sub(r'(<body[^>]*>)', lambda m: m.group(1) + '<noscript><div style="padding:16px">%s<p>%s</p></div></noscript>' % (body, allnav), out, count=1)
        open(slug + '.html', 'w').write(out)
    open('.gitignore', 'w').write('# generated by build_routes.py --pages at deploy\n' + ''.join(x + '.html\n' for x in slugs))
    print('wrote', len(slugs), 'pages')
