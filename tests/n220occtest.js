const N=require('../nec220-occ-core.js');let bad=0;const eq=(a,b,m)=>{const ok=Math.abs(a-b)<0.01;console.log((ok?'ok  ':'FAIL')+' '+m+' ('+a+' vs '+b+')');if(!ok)bad++}
let s=N.calcOcc({occ:'office',sys:'208Y',sqft:20000,recepts:100,cool:60000,largestMotor:10000});eq(s.totalVA,164000,'office total VA');eq(s.amps,455.22,'office amps 208Y');eq(s.service,500,'office service 500 A');
eq(N.lightingDemand('hospital',100000),30000,'hospital demand');eq(N.lightingDemand('hotel',120000),48000,'hotel demand');eq(N.lightingDemand('warehouse',25000),18750,'warehouse demand');
eq(N.calcOcc({occ:'warehouse',sqft:100000}).totalVA,23437.5,'warehouse incl 125%');
eq(N.calcOcc({occ:'hospital',sqft:50000}).totalVA,37500,'hospital incl 125%');
eq(N.calcOcc({occ:'store',sqft:1000,continuous:false}).totalVA,3000,'non-continuous toggle');
eq(N.calcOcc({occ:'store',sqft:0,kitchen:[10000,10000,10000,10000,10000]}).totalVA,35000,'kitchen 5 units 70%');
eq(N.calcOcc({occ:'store',sqft:0,kitchen:[5000,4000,3000]}).totalVA,10800,'kitchen 3 units 90%');
eq(N.calcOcc({occ:'store',sqft:0,kitchen:[10000,1000]}).totalVA,11000,'kitchen min two largest');
eq(N.calcOcc({occ:'store',sqft:0,recepts:100}).totalVA,14000,'receptacle demand 220.44');
eq(N.calcOcc({occ:'store',sqft:0,signs:1,windowFt:10,trackFt:10}).totalVA,(1200+2000+750)*1.25,'sign + window + track at 125%');
eq(N.calcOcc({occ:'store',sqft:0,heat:20000,cool:30000}).totalVA,30000,'larger of heat/cool');
let m=N.calcMF({units:20,unitSqft:1000,laundry:true,appliances:[{va:12000},{va:4500},{va:1200}],cool:3600,houseVA:15000});eq(m.totalVA,233880,'multi-family total');eq(m.service,700,'multi-family service 700 A');
eq(N.mfFactor(3),.45,'MF 3 units');eq(N.mfFactor(21),.37,'MF 21');eq(N.mfFactor(62),.23,'MF 62+');eq(N.calcMF({units:2}).error?1:0,1,'MF <3 units error');
eq(N.calcOcc({occ:'office',sys:'240-1',sqft:1000}).amps,3500*1.25/240,'single-phase amps');
console.log(bad?'FAILED '+bad:'ALL PASS');process.exit(bad?1:0)
