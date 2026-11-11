const K=require('../svc-core.js');let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('FAIL',m)}}
const near=(a,b,t)=>Math.abs(a-b)<=t
K.examples.forEach(e=>{const m=e.build();const R=K.calc(m);ok(Object.keys(R).length>=3,'calc '+e.id);const d=K.describe(m,null,R);ok(d.length>=3,'describe '+e.id);K.walk(m.root,n=>{ok(K.describe(m,n.id,R).length>=1,'describe node '+n.name);const r=R[n.id];ok(isFinite(r.Imax)&&isFinite(r.S),'finite '+n.name)})})
// home: loads
let m=K.examples[0].build(),R=K.calc(m),p=m.root.kids[0].kids[0].kids[0];
console.log('home panel',R[p.id].Imax.toFixed(1),R[p.id].Imaxs.toFixed(1),R[p.id].S, R[p.id].warnings.map(w=>w.msg))
ok(R[p.id].S>30000&&R[p.id].S<50000,'home VA '+R[p.id].S);ok(R[p.id].Imax<200,'home <200A');ok(R[p.id].warnings.filter(w=>w.lvl==='bad').length===0,'home clean')
// 3-phase math: 75 kVA 480->208
const t=K.node('utility','U',{sys:'3P-277/480',isc:35}),x=K.node('xfmr','T',{pri:'3P-277/480',sec:'3P-120/208',kva:75,z:5});t.kids.push(x);x.ocpd=100;x.feeder={size:'1/0',mat:'Cu',len:10,sets:1}
const pn=K.node('panel','P',{bus:225,spaces:42});x.kids.push(pn);pn.ocpd=225;pn.feeder={size:'4/0',mat:'Cu',len:10,sets:1};pn.circuits=[K.circuit('L','general','3P',30000)]
let mm=K.normalize({name:'t',root:t});R=K.calc(mm)
ok(near(R[x.id].flaS,208.2,0.5),'xfmr FLA sec '+R[x.id].flaS);ok(near(R[x.id].flaP,90.2,0.5),'xfmr FLA pri '+R[x.id].flaP)
ok(near(R[pn.id].Imax,30000/(Math.sqrt(3)*208),0.1),'3P load amps '+R[pn.id].Imax);ok(near(R[x.id].xloadPct,40,0.2),'xfmr loading '+R[x.id].xloadPct)
// fault: 75kVA 5%Z infinite bus -> ~4.2kA at secondary (208.2/0.05=4164), with source slightly less
ok(R[x.id].isc>3000&&R[x.id].isc<4200,'xfmr Isc '+R[x.id].isc);ok(R[pn.id].isc<R[x.id].isc,'Isc drops down the feeder')
// overload detection
pn.circuits[0].va=90000;R=K.calc(mm);ok(R[x.id].warnings.some(w=>/loaded to/.test(w.msg)),'xfmr overload warns');ok(R[pn.id].warnings.some(w=>/bus rating|tr/.test(w.msg))||R[pn.id].warnings.length>0,'panel warns')
// undersized wire
pn.circuits[0].va=30000;pn.feeder.size='6';R=K.calc(mm);ok(R[pn.id].warnings.some(w=>/overheat|larger than/.test(w.msg)),'undersized wire flagged')
// voltage drop long run
pn.feeder={size:'12',mat:'Cu',len:400,sets:1};pn.circuits[0].va=3000;pn.ocpd=20;R=K.calc(mm);ok(R[pn.id].dropPct>3,'long run drop '+R[pn.id].dropPct)
// AIC
t.props.isc=100;pn.feeder={size:'4/0',mat:'Cu',len:10,sets:1};pn.ocpd=225;pn.aic=10;R=K.calc(mm);console.log('aic',R[pn.id].iscIn);
// continuous 125%
const u1=K.node('utility','U',{sys:'1P-120/240',isc:10}),p1=K.node('panel','P',{bus:100,spaces:20});u1.kids.push(p1);p1.ocpd=60;p1.feeder={size:'6',mat:'Cu',len:10,sets:1};p1.circuits=[K.circuit('EV','ev','240',9600)]
R=K.calc(K.normalize({root:u1}));ok(near(R[p1.id].Imax,40,0.01)&&near(R[p1.id].Imaxs,50,0.01),'EV 40A -> 50A sized '+R[p1.id].Imaxs)
// trouble example has bad warnings; autosize clears them
m=K.examples[5].build();R=K.calc(m);let bad=Object.values(R).reduce((a,r)=>a+r.warnings.filter(w=>w.lvl==='bad').length,0);ok(bad>=3,'trouble has problems '+bad)
R=K.autoSize(m);bad=Object.values(R).reduce((a,r)=>a.concat(r.warnings.filter(w=>w.lvl==='bad')),[]);console.log('after autosize',bad.map(w=>w.msg));ok(bad.length===0,'autosize clears red')
// other examples start clean (no red)
K.examples.slice(0,5).forEach(e=>{const R2=K.calc(e.build());const b=Object.values(R2).reduce((a,r)=>a.concat(r.warnings.filter(w=>w.lvl==='bad')),[]);if(b.length)console.log(e.id,b.map(w=>w.msg));ok(b.length===0,'example clean '+e.id)})
// neutral
const u2=K.node('utility','U',{sys:'1P-120/240',isc:10}),p2=K.node('panel','P',{bus:100,spaces:20});u2.kids.push(p2);p2.ocpd=100;p2.feeder={size:'3',mat:'Cu',len:5,sets:1};p2.circuits=[K.circuit('A','general','120',2400),K.circuit('B','general','120',1200)]
R=K.calc(K.normalize({root:u2}));ok(near(R[p2.id].neutral,10,0.01),'neutral = difference '+R[p2.id].neutral)
console.log('svc tests: pass',pass,'fail',fail);process.exit(fail?1:0)
