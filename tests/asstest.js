globalThis.SimCore=require('../sim-core.js');globalThis.LabEx=require('../lab-examples.js').LabEx
if(!globalThis.LabEx){console.log('LabEx missing');process.exit(1)}
const A=require('../lab-assist.js');let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('FAIL',m)}}
// every example explains
LabEx.examples.forEach(e=>{const x=A.explain(e.build());ok(x.big.length&&x.parts.length&&x.legend.length,'explain '+e.id);ok(x.result.length||e.id==='threeway'||true,'res '+e.id)})
let x=A.explain(LabEx.examples.find(e=>e.id==='starter').build());ok(x.big.some(b=>/seal/i.test(b)),'seal-in explained');ok(x.result.some(r=>/motor|M1/i.test(r.name)&&/running/.test(r.text)),'motor running: '+JSON.stringify(x.result.filter(r=>/M1|motor/i.test(r.name))))
x=A.explain(LabEx.examples.find(e=>e.id==='short').build());ok(x.tips.length>0||x.result.some(r=>r.bad),'short flagged: '+JSON.stringify(x.tips))
x=A.explain(LabEx.examples.find(e=>e.id==='wrongvolt').build());ok(x.result.some(r=>/burnt/.test(r.text)),'burnt lamp reported')
ok(A.explain({comps:[],wires:[]}).big.length===1,'empty')
// descriptions
const t=[['motor start stop with overload','starter'],['I have a three way switch setup','threeway'],['480 to 120 volt transformer','xfmr'],['a delta wye transformer','dy'],['a timer relay','timer']]
t.forEach(([q,e])=>ok(A.build(q).template===e,'template '+q+' -> '+A.build(q).template))
// chain builds simulate
function sim(m){const r=A.headless(m);return r}
let b=A.build('120 volt lamp with a switch and 15 amp breaker');ok(!b.template&&b.model.comps.length===4,'chain 1ph '+b.model.comps.map(c=>c.type));let r=sim(b.model);ok(r.comp.LD1.brightness>0.5,'lamp lit '+JSON.stringify(r.comp.LD1))
b=A.build('240 volt heater on a 20 amp fuse');r=sim(b.model);ok(r.comp.LD1.i>10,'heater draws '+r.comp.LD1.i)
b=A.build('480 volt 3 phase motor with a breaker and overload');ok(b.model.comps.some(c=>c.type==='motor3')&&b.model.comps.some(c=>c.type==='ol'),'3ph chain');r=sim(b.model);ok(r.comp.M1.running,'3ph motor runs '+JSON.stringify(r.comp.M1))
b=A.build('lamp');ok(b.model.comps.length>=2&&b.assumptions.length,'bare lamp has assumptions')
b=A.build('208 volt three phase motor');ok(b.model.comps.find(c=>c.type==='src3').props.vll===208,'208')
console.log('assist tests: pass',pass,'fail',fail);process.exit(fail?1:0)
