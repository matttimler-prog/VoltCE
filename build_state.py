#!/usr/bin/env python3
"""Build <st>-bank.js for a state exam-prep page.
usage: build_state.py <st> <edition: 2017|2020|2023|2026> <rules.json> [rules-only]
Selection: cycle-bank non-'chg' items whose edition mask includes the edition, calc/theory banks, master-bank items whose
citation names no other edition. State rules items (levels J|M|C|B) are added as group 'wis' (state rules).
Levels: J = difficulty<=2, M = 3 (code/calc/theory); state items carry their own level. Output fields as build_wi.py.
"""
import json, re, random, sys
st, ed, rules = sys.argv[1], int(sys.argv[2]), sys.argv[3]
bit = {2017: 1, 2020: 2, 2023: 4, 2026: 8}[ed]
other = '|'.join(str(y)[2:] for y in (2017, 2020, 2023, 2026) if y != ed)
old = re.compile(r'20(%s)' % other)
def load(f):
    s = open(f).read(); return json.loads(s[s.index('=')+1:].rstrip().rstrip(';'))
cy, ca, mb, th = load('cycle-bank.js'), load('calc-bank.js'), load('master-bank.js'), load('theory-bank.js')
seen, out = set(), []
def add(x, g, w=0):
    if x['q'] in seen: return
    seen.add(x['q'])
    cat = x.get('c') or x.get('ar')
    if 'Wisconsin' in cat: return            # never carry another state's rules items
    out.append({'c': cat, 'g': g, 'l': 'J' if x['d'] <= 2 else 'M', 'w': w, 'd': x['d'], 'q': x['q'], 'o': x['o'], 'a': x['a'], 'e': x['e'], 'r': x['r']})
RULES_ONLY = len(sys.argv) > 4 and sys.argv[4] == 'rules-only'
for x in ([] if RULES_ONLY else cy):
    if x['k'] != 'chg' and x['b'] & bit:
        add(x, 'code' if x['k'] == 'code' else 'calc', 0 if x['k'] == 'code' else 1)
for x in ([] if RULES_ONLY else ca): add(x, 'calc', 1)
for x in ([] if RULES_ONLY else th): add(x, 'theory', 1)
for x in ([] if RULES_ONLY else mb):
    if not old.search(x['r']): add(x, 'code' if x['g'] == 'code' else 'calc', 0 if x['g'] == 'code' else 1)
n0 = len(out)
for x in json.load(open(rules)):
    if x['q'] in seen: continue
    seen.add(x['q'])
    out.append({'c': x['c'], 'g': 'wis', 'l': x['lv'], 'w': 0, 'd': x['d'], 'q': x['q'], 'o': x['o'], 'a': x['a'], 'e': x['e'], 'r': x['r']})
random.Random(11).shuffle(out)
open(st + '-bank.js', 'w').write('window.%s_BANK=' % st.upper() + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';')
from collections import Counter
print(st, len(out), 'rules', len(out) - n0, Counter((q['l'], q['g']) for q in out))
