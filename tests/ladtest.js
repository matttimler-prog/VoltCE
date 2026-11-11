const L=require('../ladder-core.js');let pass=0,fail=0
function ok(c,m){if(c)pass++;else{fail++;console.log('FAIL',m)}}
function run(p,sets,secs,dt){const R=L.Runtime(p);dt=dt||0.02;for(const k in sets)R.set(k,sets[k]);for(let t=0;t<secs;t+=dt)R.step(dt);return R}
const E=L.elem,P=L.par,Rg=L.rung
// seal-in
function seal(){const p=L.newProgram('Seal');p.rungs.push(Rg([E('XIC','START'),E('XIO','STOP')].slice(0,0).concat([P([L.newSeries([E('XIC','START')]),L.newSeries([E('XIC','MOTOR')])]),E('XIO','STOP'),E('OTE','MOTOR')])));return p}
let p=seal(),R=L.Runtime(p)
R.set('START',true);R.step();ok(R.read('MOTOR'),'start');R.set('START',false);R.step();ok(R.read('MOTOR'),'seal');R.set('STOP',true);R.step();ok(!R.read('MOTOR'),'stop');R.set('STOP',false);R.step();ok(!R.read('MOTOR'),'stays off')
// latch
p=L.newProgram();p.rungs.push(Rg([E('XIC','A'),E('OTL','L')]),Rg([E('XIC','B'),E('OTU','L')]));R=L.Runtime(p)
R.set('A',true);R.step();R.set('A',false);R.step();ok(R.read('L'),'latch');R.set('B',true);R.step();ok(!R.read('L'),'unlatch')
// TON
p=L.newProgram();p.rungs.push(Rg([E('XIC','IN'),E('TON','T1',{preset:2}),E('OTE','Q')]),Rg([E('XIC','T1.DN'),E('OTE','DONE')]));R=L.Runtime(p);R.set('IN',true)
for(let i=0;i<90;i++)R.step(0.02);ok(!R.read('DONE'),'ton not yet');for(let i=0;i<30;i++)R.step(0.02);ok(R.read('DONE'),'ton done');ok(Math.abs(R.read('T1.ACC')-2)<1e-9,'acc capped')
R.set('IN',false);R.step();ok(!R.read('DONE')&&R.read('T1.ACC')===0,'ton reset')
// TOF
p=L.newProgram();p.rungs.push(Rg([E('XIC','IN'),E('TOF','T2',{preset:1}),E('OTE','Y')]),Rg([E('XIC','T2.DN'),E('OTE','HOLD')]));R=L.Runtime(p);R.set('IN',true);R.step();ok(R.read('HOLD'),'tof on')
R.set('IN',false);for(let i=0;i<40;i++)R.step(0.02);ok(R.read('HOLD'),'tof holds');for(let i=0;i<20;i++)R.step(0.02);ok(!R.read('HOLD'),'tof drops')
// CTU
p=L.newProgram();p.rungs.push(Rg([E('XIC','PB'),E('CTU','C1',{preset:3})]),Rg([E('XIC','C1.DN'),E('OTE','FULL')]),Rg([E('XIC','RST'),E('RES','C1')]));R=L.Runtime(p)
for(let i=0;i<3;i++){R.set('PB',true);R.step();R.set('PB',false);R.step()}ok(R.read('FULL')&&R.read('C1.ACC')===3,'ctu');R.set('RST',true);R.step();R.step();ok(!R.read('FULL')&&R.read('C1.ACC')===0,'ctu reset')
// ONS
p=L.newProgram();p.rungs.push(Rg([E('XIC','PB'),E('ONS','O1'),E('CTU','C2',{preset:99})]));R=L.Runtime(p);R.set('PB',true);for(let i=0;i<10;i++)R.step();ok(R.read('C2.ACC')===1,'ons once')
// CMP
p=L.newProgram();p.rungs.push(Rg([E('XIC','PB'),E('CTU','C3',{preset:9})]),Rg([E('CMP','C3.ACC',{op:'GEQ',value:2}),E('OTE','TWO')]));R=L.Runtime(p)
for(let i=0;i<2;i++){R.set('PB',true);R.step();R.set('PB',false);R.step()}ok(R.read('TWO'),'cmp')
// parallel with timer branches
p=L.newProgram();p.rungs.push(Rg([P([L.newSeries([E('XIC','A')]),L.newSeries([E('XIC','B'),E('XIC','C')])]),E('OTE','Y')]));R=L.Runtime(p)
R.set('B',true);R.step();ok(!R.read('Y'),'par B only');R.set('C',true);R.step();ok(R.read('Y'),'par BC');R.set('B',false);R.set('C',false);R.set('A',true);R.step();ok(R.read('Y'),'par A')
// exports
p=seal();p.tags=[L.tag('START','input'),L.tag('STOP','input'),L.tag('MOTOR','output')]
const st=L.toST(p);ok(/MOTOR := \(START OR MOTOR\) AND NOT STOP;/.test(st),'ST seal: '+st);ok(/PROGRAM Seal/.test(st)&&/VAR_INPUT/.test(st),'ST decl')
console.log(st)
console.log(L.mnemonic(p));console.log(L.tagsCSV(p))
p=L.newProgram('T');p.rungs.push(Rg([E('XIC','IN'),E('TON','T1',{preset:2}),E('OTE','Q')]),Rg([E('XIC','PB'),E('CTU','C1',{preset:3})]),Rg([E('XIC','R'),E('RES','C1')]),Rg([E('XIC','PB'),E('ONS','x'),E('OTL','Z')]));console.log(L.toST(p,{openplc:true}))
console.log('pass',pass,'fail',fail);process.exit(fail?1:0)
