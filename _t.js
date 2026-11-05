const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];const p=await b.newPage({viewport:{width:390,height:900}});p.on('pageerror',e=>errs.push(String(e)));
await p.route(/unpkg\.com|googleapis|gstatic/,r=>r.request().url().includes('unpkg')?r.fulfill({contentType:'application/javascript',body:"window.supabase={createClient:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,insert:async()=>({}),then:(f)=>f({data:[],error:null})};return {auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({})},from:()=>q,rpc:async()=>({data:null})}}}"}):r.fulfill({body:''}));
await p.goto('http://localhost:8766/index.html');await p.waitForTimeout(1200);
await p.evaluate(()=>navST('fle','C'));await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(()=>({note:document.getElementById('fle-note').innerText.slice(0,120),refs:document.getElementById('fle-links').innerText.slice(0,150).replace(/\n/g,' '),chips:document.getElementById('fle-cats').innerText.includes('Sample questions')}))));
console.log('errors',errs);await b.close();})();
