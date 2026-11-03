#!/usr/bin/env python3
"""Build wi-bank.js: Wisconsin exam prep (2023 NEC) from the site's existing banks.
Selection rules:
  - cycle-bank: non-'chg' items whose edition mask includes 2023 (bit 4); 2026-only ('new') items are excluded
  - calc-bank, theory-bank: included (written to the 2023 NEC, no older-edition citations)
  - master-bank: included only if the citation does not name 2017/2020/2026
  - de-duplicated by question text; journeyman = difficulty 1-2, master = difficulty 3 (same split as Code cycles)
Output fields: c category, g group (code|calc|theory|wis), l level (J|M), w 1 = worked-solution style, d, q, o, a, e, r
"""
import json, re, random
def load(f):
    s = open(f).read(); return json.loads(s[s.index('=')+1:].rstrip().rstrip(';'))
cy, ca, mb, th = load('cycle-bank.js'), load('calc-bank.js'), load('master-bank.js'), load('theory-bank.js')
old = re.compile(r'20(17|20|26)')
wis = re.compile(r'Wisconsin|SPS ?3|Wis\. ?Stat')
seen, out = set(), []
def add(x, g, w=0):
    if x['q'] in seen: return
    seen.add(x['q'])
    cat = x.get('c') or x.get('ar')
    if wis.search(cat + x['r']) and 'Wisconsin' in cat: g = 'wis'
    out.append({'c': cat, 'g': g, 'l': 'J' if x['d'] <= 2 else 'M', 'w': w, 'd': x['d'], 'q': x['q'], 'o': x['o'], 'a': x['a'], 'e': x['e'], 'r': x['r']})
for x in cy:
    if x['k'] != 'chg' and x['b'] & 4:
        add(x, 'code' if x['k'] == 'code' else 'calc', 0 if x['k'] == 'code' else 1)
for x in ca: add(x, 'calc', 1)
for x in th: add(x, 'theory', 1)
for x in mb:
    if not old.search(x['r']): add(x, 'code' if x['g'] == 'code' else 'calc', 0 if x['g'] == 'code' else 1)
# Wisconsin rules questions written from SPS 316 / SPS 305 sources (reviewed set in wi/ folder passed as argv)
import sys, glob
dropped_old = [q for q in out if q['g'] == 'wis']
out = [q for q in out if q['g'] != 'wis']          # replaced by the newer, source-checked set
seen = {q['q'] for q in out}
drops = set(json.load(open(sys.argv[2])) ) if len(sys.argv) > 2 else set()
for f in sorted(glob.glob(sys.argv[1] + '/wi_*.json')) if len(sys.argv) > 1 else []:
    for x in json.load(open(f)):
        key = x['q']
        if key in seen or key in drops: continue
        seen.add(key)
        r = x['r'] + (' (DSPS proposed order; confirm final text)' if x.get('prop') else '')
        out.append({'c': x['c'], 'g': 'wis', 'l': x['lv'], 'w': 0, 'd': x['d'], 'q': x['q'], 'o': x['o'], 'a': x['a'], 'e': x['e'], 'r': r})
print('old WI items replaced:', len(dropped_old))
random.Random(11).shuffle(out)
open('wi-bank.js', 'w').write('window.WI_BANK=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';')
from collections import Counter
print(len(out), Counter((q['l'], q['g']) for q in out))
print('wis by category', Counter(q['c'] for q in out if q['g']=='wis'))
print('answer index', Counter(q['a'] for q in out))
