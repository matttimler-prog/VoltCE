"""Builds florida-bank.js (window.FL_BANK) for the Florida exam prep page.
Usage: python3 build_florida.py <keyed_questions.json> [drop_ids.json]
Input items: {id, cat, sec ('biz'|'tech'), d, q, o[4], a, e, r, src, unv}
Output items: {c (category), s ('biz'|'tech'), d, q, o, a, e, r}"""
import json, sys, random
items = json.load(open(sys.argv[1]))
drop = set(json.load(open(sys.argv[2]))) if len(sys.argv) > 2 else set()
out = []
for x in items:
    if x['id'] in drop: continue
    r = x.get('r') or ''
    if x.get('unv'):
        r = (r + ' ' if r else '') + '(concept check: written from widely documented provisions, not checked line by line against the code book)'
    out.append({'c': x['cat'], 's': x['sec'], 'd': x.get('d', 2), 'q': x['q'], 'o': x['o'], 'a': x['a'], 'e': x['e'], 'r': r})
random.Random(7).shuffle(out)
open('florida-bank.js', 'w').write('window.FL_BANK=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';')
print(len(out), 'questions')
