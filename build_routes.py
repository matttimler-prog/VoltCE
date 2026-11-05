"""Regenerates vercel.json, sitemap.xml and robots.txt from the pages defined in index.html.
Run after adding a state: python3 build_routes.py"""
import re, json, os
h = open('index.html').read()
slugify = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
slugs = ['courses', 'states', 'pricing', 'wisconsin', 'florida-contractor']
for m in re.finditer(r"^  (\w+): \{ name: ['\"]([^'\"]+)['\"]", h, re.M):
    s = slugify(m.group(2))
    if s not in slugs: slugs.append(s)
for s in slugs:
    assert not os.path.exists(s) and not os.path.exists(s + '.html'), s
alt = '|'.join(slugs)
cfg = {"trailingSlash": False, "rewrites": [{"source": "/(" + alt + ")", "destination": "/index.html"}]}
json.dump(cfg, open('vercel.json', 'w'), indent=2); open('vercel.json', 'a').write('\n')
urls = ['https://voltceu.com/'] + ['https://voltceu.com/' + s for s in slugs]
open('sitemap.xml', 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join('  <url><loc>%s</loc></url>\n' % u for u in urls) + '</urlset>\n')
open('robots.txt', 'w').write('User-agent: *\nAllow: /\nSitemap: https://voltceu.com/sitemap.xml\n')
print(len(slugs), 'routes')
