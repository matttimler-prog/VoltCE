"""Builds cycle-bank.js for the Code cycles page.
Fields: k kind (code|chg|new|mast), c category, d difficulty (1-3), q,o,a,e,r, b edition bitmask (1=2017,2=2020,4=2023,8=2026), t for chg items = bit of the edition the change arrived in.
Run: python3 build_cycle.py <verified_2026_items.json> <master_live.json>"""
import json,sys,re
def load(f):
    s=open(f).read(); return json.loads(s[s.index('=')+1:].rstrip().rstrip(';'))
BIT={2017:1,2020:2,2023:4,2026:8}
out=[]
for x in load('code-bank.js'):
    b=sum(BIT[e] for e in x.get('eds',[2023]))
    out.append({'k':'code','c':x['ar'],'d':x['d'],'q':x['q'],'o':x['o'],'a':x['a'],'e':x['e'],'r':x['r'],'b':b})
for x in load('chg-bank.js'):
    to=int(x['step'].split('->')[1]); fr=int(x['step'].split('->')[0])
    out.append({'k':'chg','c':x['ar'],'d':x['d'],'q':x['q'],'o':x['o'],'a':x['a'],'e':x['e'],'r':x['r'],'b':BIT[to],'t':BIT[to],'s':x['step']})
names={a['n']:a['t'].split(':')[0].split(';')[0] for a in json.loads(open('art-names.js').read().split('window.ART_NAMES=')[1].split(';\n')[0].rstrip(';'))}
names[120]='Branch-Circuit, Feeder, and Service Load Calculations'  # 2026 NEC Article 120 (load calculations moved here from Article 220)
n26=0
for x in json.load(open(sys.argv[1])):
    m=re.findall(r'NEC (\d+)\.',x['explain']) or re.findall(r'(\d{2,3})\.\d',x['explain'])
    n=int(m[-1]) if m else 0
    fb={'A-bf':314,'A-ocpd':240,'A-gnd':250,'A-bc':210,'A-lc':120}
    if n not in names: n=fb.get(x['id'].rsplit('-q',1)[0],0)
    if n not in names: print('skip',x['id']); continue
    calc=bool(re.search(r'\d\s*[x×/÷+]\s*\d|=',x['explain'])) and any(ch.isdigit() for ch in x['q'])
    out.append({'k':'new','c':'Art. %d %s'%(n,names[n]),'d':3 if calc else 2,'q':x['q'],'o':x['opts'],'a':x['correct'],'e':x['explain'],'r':'NEC %d (2026 text)'%n,'b':8}); n26+=1
for x in json.load(open(sys.argv[2])):
    out.append({'k':'mast','c':x['c'],'d':3,'q':x['q'],'o':x['o'],'a':x['a'],'e':x['e'],'r':x['r'],'b':4})
open('cycle-bank.js','w').write('window.CYCLE_BANK='+json.dumps(out,separators=(',',':'),ensure_ascii=False)+';')
print(len(out),'2026 verified added:',n26)
