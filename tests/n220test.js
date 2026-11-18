const N=require('../nec220-core.js');let bad=0;const eq=(a,b,m)=>{const ok=Math.abs(a-b)<0.01;console.log((ok?'ok  ':'FAIL')+' '+m+' ('+a+' vs '+b+')');if(!ok)bad++}
const base={sqft:2000,smallApp:2,laundry:true,rangeN:1,rangeKw:12,dryerN:1,dryerKw:5,fixed:[{name:'DW',va:1200},{name:'GD',va:900},{name:'WH',va:4500},{name:'MW',va:1500}],ac:4800};
let s=N.calc(base);eq(s.totalVA,29500,'standard total VA');eq(s.amps,122.92,'standard amps');eq(s.service,125,'service size 125');
eq(N.calc(Object.assign({},base,{fixed:base.fixed.slice(0,3)})).totalVA,29500-8100*.75+6600,'3 appliances: no 75% factor');
eq(N.rangeDemand(1,12),8000,'1 range 12kW');eq(N.rangeDemand(2,12),11000,'2 ranges');eq(N.rangeDemand(1,14),8800,'14 kW range note 1');eq(N.rangeDemand(25,12),40000,'25 ranges');eq(N.rangeDemand(26,12)===null?1:0,1,'26 ranges flagged');
eq(N.dryerFactor(4),1,'dryers 4');eq(N.dryerFactor(6),.75,'dryers 6');eq(N.dryerFactor(12),.46,'dryers 12');eq(N.dryerFactor(24),.345,'dryers 24');
let o=N.calc(Object.assign({},base,{method:'optional'}));eq(o.totalVA,25040,'optional total VA');eq(o.service,110,'optional service');
eq(N.calc(Object.assign({},base,{method:'optional',heat:9000,ac:3000,heatUnits:2})).totalVA,20240+5850,'optional heat 65% beats AC');
eq(N.calc(Object.assign({},base,{heat:9000})).totalVA,29500-4800+9000,'standard: larger of heat/AC only');
eq(N.calc(Object.assign({},base,{evseN:1,evseVa:0})).totalVA,29500+7200,'EVSE min 7200');
eq(N.calc(Object.assign({},base,{motor:4800})).totalVA,29500+1200,'25% largest motor');
eq(N.calc({sqft:1000,smallApp:0}).totalVA,3000+3000+1500>3000?3000+(3000+3000+1500-3000)*.35:0,'minimum 2 small-appliance circuits');
eq(N.nextSize(200.1),225,'next size');
const b26=Object.assign({},base,{edition:'2026'});
eq(N.calc(b26).totalVA,28800,'2026 standard total (2 VA/sf, dryer, 120.x)');eq(N.calc(Object.assign({},b26,{method:'optional'})).totalVA,23040,'2026 optional (first 8 kVA)');
eq(N.dryerFactor(3,'2026'),.8,'2026 dryers 3 at 80%');eq(N.dryerFactor(5,'2026'),.8,'2026 dryers 5 at 80%');eq(N.dryerFactor(5),.85,'2023 dryers 5 unchanged');
eq(N.cite('Table 220.55','2026')==='Table 120.55'?1:0,1,'cite map table');eq(N.cite('220.60','2026')==='120.6'?1:0,1,'cite map 220.60 to 120.6');
console.log(bad?'FAILED '+bad:'ALL PASS');process.exit(bad?1:0)
