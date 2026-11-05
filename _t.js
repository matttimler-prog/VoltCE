const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
for(const w of [1280,390]){
const p=await b.newPage({viewport:{width:w,height:900}});p.on('pageerror',e=>errs.push(w+' '+String(e)));
await p.route(/unpkg\.com|googleapis|gstatic/,r=>r.request().url().includes('unpkg')?r.fulfill({contentType:'application/javascript',body:"window.supabase={createClient:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,insert:async()=>({}),then:(f)=>f({data:[],error:null})};return {auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({})},from:()=>q,rpc:async()=>({data:null})}}}"}):r.fulfill({body:''}));
await p.goto('http://localhost:8766/index.html');await p.waitForTimeout(1500);
for(const [id,l] of [['la','C'],['la','A'],['mn','J'],['mn','M'],['mn','C']]){
await p.evaluate(([id,l])=>navST(id,l),[id,l]);await p.waitForTimeout(1500);
const r=await p.evaluate(id=>({page:document.querySelector('.page.active').id,hero:document.getElementById(id+'-hero').innerText.replace(/\n/g,' | ').slice(0,300),q:document.getElementById(id+'-body').innerText.slice(0,120)}),id);
console.log(w,id,l,JSON.stringify(r));}
await p.evaluate(()=>{document.querySelector('.dd-btn').click()});
await p.close();}
console.log('errors',errs);await b.close();})();
