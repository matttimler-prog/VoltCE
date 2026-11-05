const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
for(const w of [1280,390]){const p=await b.newPage({viewport:{width:w,height:900}});p.on('pageerror',e=>errs.push(String(e)));
await p.route(/unpkg\.com|googleapis|gstatic/,r=>r.request().url().includes('unpkg')?r.fulfill({contentType:'application/javascript',body:"window.supabase={createClient:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,insert:async()=>({}),then:(f)=>f({data:[],error:null})};return {auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({})},from:()=>q,rpc:async()=>({data:null})}}}"}):r.fulfill({body:''}));
await p.goto('http://localhost:8766/index.html');await p.waitForTimeout(1200);
await p.evaluate(()=>navST('mn','J'));await p.waitForTimeout(1200);
await p.click('#page-mn button:has-text("Flashcards")');await p.waitForTimeout(2500);
console.log(w,await p.evaluate(()=>[...document.querySelectorAll('#stfc-ctl select')[0].options].length));
await p.selectOption('#stfc-ctl select >> nth=0','rules');await p.waitForTimeout(300);
await p.click('#stfc-body .flash');
console.log(await p.evaluate(()=>document.querySelector('#stfc-body .flash').innerText.replace(/\n/g,' | ').slice(0,200)));
await p.selectOption('#stfc-ctl select >> nth=0','cmajor');await p.waitForTimeout(300);
console.log(await p.evaluate(()=>document.querySelectorAll('#stfc-ctl select')[1].options.length));
await p.click('text=Back to the state page');await p.waitForTimeout(500);console.log(await p.evaluate(()=>document.querySelector('.page.active').id));
await p.close();}
console.log('errors',errs);await b.close();})();
