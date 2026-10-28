"""Builds master-bank.js: advanced (d=3) journeyman items plus new master-level items (m=1).
Run: python3 build_master.py [extra_master_items.json ...]"""
import json,sys
def load(f,g):
    s=open(f).read(); return json.loads(s[s.index('=')+1:].rstrip().rstrip(';'))
out=[]
for f,g,fld,pre,grp in(('calc-bank.js','CALC_BANK','c','', 'calc'),('theory-bank.js','THEORY_BANK','c','Theory: ','calc'),('code-bank.js','CODE_BANK','ar','','code'),('chg-bank.js','CHG_BANK','ar','Changes: ','code')):
    for x in load(f,g):
        if x.get('d')!=3: continue
        if g=='CODE_BANK' and 2023 not in x.get('eds',[2023]): continue
        out.append({'c':pre+x[fld],'g':grp,'d':3,'q':x['q'],'o':x['o'],'a':x['a'],'e':x['e'],'r':x['r']})
n_adv=len(out)
for f in sys.argv[1:]:
    for x in json.load(open(f)):
        x=dict(x); x['g']='mast'; x['d']=3; out.append(x)
open('master-bank.js','w').write('window.MASTER_BANK='+json.dumps(out,separators=(',',':'),ensure_ascii=False)+';')
print(n_adv,len(out))
