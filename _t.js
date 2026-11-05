const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
for(const w of [1280,390]){const p=await b.newPage({viewport:{width:w,height:900}});p.on('pageerror',e=>errs.push(String(e)));
await p.route(/unpkg\.com|googleapis|gstatic/,r=>r.request().url().includes('unpkg')?r.fulfill({contentType:'application/javascript',body:"window.supabase={createClient:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,insert:async()=>({}),then:(f)=>f({data:[],error:null})};return {auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({})},from:()=>q,rpc:async()=>({data:null})}}}"}):r.fulfill({body:''}));
await p.goto('http://localhost:8766/index.html');await p.waitForTimeout(1200);
for(const l of ['C','A']){await p.evaluate(l=>navST('fle',l),l);await p.waitForTimeout(1500);
console.log(w,l,JSON.stringify(await p.evaluate(()=>({pg:document.querySelector('.page.active').id,q:document.getElementById('fle-body').innerText.slice(0,100).replace(/\n/g,' '),links:document.getElementById('fle-links').innerText.length,chips:document.getElementById('fle-cats').innerText.slice(0,120).replace(/\n/g,' ')}))));}
await p.evaluate(()=>stFcOpen('fle'));await p.waitForTimeout(2500);console.log(await p.evaluate(()=>document.getElementById('stfc-title').innerText+' '+[...document.querySelectorAll('#stfc-ctl select')[0].options].length));
await p.close();}
console.log('errors',errs);await b.close();})();
