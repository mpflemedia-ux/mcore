// Learning Center image regenerator. Usage (box harness):
//   SDJS=/tmp/live6/ SDINDEX=/tmp/li5.html LCDIR=/workspace/lc/app/ node regen.js [filterSubstring]
// Map: shots.json (from gen-sql.js) -> {file, page, params, sel, text, role, n}. Mock data only ("Contoh data").
// Output: ../app/lc-img/<chapter>/<lesson>-<step>.webp  (390px wide, light theme, EN UI, highlight + step number).
const L=require('/workspace/servicedesk/harness/lib.js'),fs=require('fs'),path=require('path');const W=m=>new Promise(r=>setTimeout(r,m));
const SH=JSON.parse(fs.readFileSync(__dirname+'/shots.json','utf8')).filter(s=>!process.argv[2]||s.file.includes(process.argv[2]));
const OUT=path.resolve(__dirname,'../app')+'/';const lcd=require('./lcdata.js')(true);
async function page(role){const p=await L.open({role:role==='pa'?'platform_admin':'owner',width:390,height:720,theme:'light',lang:'en',noTags:true,dpr:1.5,
 data:D=>{D.learning_chapters=lcd.ch;D.learning_lessons=lcd.ls;D.learning_steps=lcd.st;D.user_learning_progress=[];}});
 await p.evaluate(()=>{[...document.querySelectorAll('button')].filter(b=>/^Skip$/.test(b.textContent.trim())).forEach(b=>b.click())});await W(700);return p;}
(async()=>{const pages={},log=[];
 for(const s of SH){const p=pages[s.role]||(pages[s.role]=await page(s.role));
  const pr=Object.assign({},s.params);const step=pr._step;delete pr._step;
  await p.evaluate(()=>{document.querySelectorAll('.lc-shot').forEach(e=>e.remove());if(document.body.classList.contains('sidebar-open')&&window.toggleSidebar)toggleSidebar();window.scrollTo(0,0);});
  await p.evaluate((a,b)=>openPage(a,b),s.page,pr);await W(1800);
  if(step){for(let i=1;i<step;i++){await p.evaluate(i=>{const m=document.getElementById('main');if(i===1){const cb=[...m.querySelectorAll('input[type=checkbox]')].slice(0,2);cb.forEach(c=>{if(!c.checked)c.click();});}const n=document.getElementById('mg-next');if(n)n.click();},i);await W(900);}}
  const r=await p.evaluate((sel,text,n)=>{
   const vis=e=>{const b=e.getBoundingClientRect();return b.width>4&&b.height>4&&getComputedStyle(e).visibility!=='hidden';};
   let el=null;if(sel){const all=[...document.querySelectorAll(sel)].filter(e=>!text||(e.textContent||'').includes(text));
    el=all.filter(vis).sort((a,b)=>(a.textContent||'').length-(b.textContent||'').length)[0]||all.sort((a,b)=>(a.textContent||'').length-(b.textContent||'').length)[0];}
   let miss=!el;if(!el)el=document.querySelector('#main .page-header')||document.querySelector('#main .cob-card')||document.getElementById('main');
   const sb=document.getElementById('sidebar')||document.querySelector('.sidebar');
   if(sb&&sb.contains(el)&&!vis(sb)&&window.toggleSidebar)toggleSidebar();
   document.querySelectorAll('#main *').forEach(()=>{});
   // mask real client identity (mock fixtures may reuse it)
   const tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let t;while((t=tw.nextNode()))t.nodeValue=t.nodeValue.replace(/ATAS\s+ANGIN(\s+MY)?(\s+SDN\.?\s*BHD\.?)?/gi,'Syarikat Contoh Sdn Bhd').replace(/mikepapa[\w.]*@gmail\.com/gi,'contoh@email.com');
   document.querySelectorAll('input,textarea').forEach(i=>{if(/atas\s+angin|mikepapa/i.test(i.value||''))i.value=/@/.test(i.value)?'contoh@email.com':'Syarikat Contoh Sdn Bhd';});el.scrollIntoView({block:'center'});return {miss};},s.sel,s.text,s.n);
  await W(500);
  await p.evaluate(n=>{const els=[...document.querySelectorAll('[data-lc-t]')];},s.n);
  const box=await p.evaluate((sel,text,n,miss)=>{
   const vis=e=>{const b=e.getBoundingClientRect();return b.width>4&&b.height>4;};
   let el=null;if(sel&&!miss){const all=[...document.querySelectorAll(sel)].filter(e=>!text||(e.textContent||'').includes(text)).filter(vis);el=all.sort((a,b)=>(a.textContent||'').length-(b.textContent||'').length)[0];}
   if(!el)el=document.querySelector('#main .page-header')||document.getElementById('main');
   const b=el.getBoundingClientRect(),pad=6,x=Math.max(2,b.left-pad),y=Math.max(2,b.top-pad),w=Math.min(innerWidth-4-x,b.width+pad*2),h=Math.min(innerHeight-4-y,b.height+pad*2);
   const d=document.createElement('div');d.className='lc-shot';d.style.cssText=`position:fixed;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:3px solid #f59e0b;border-radius:10px;box-shadow:0 0 0 9999px rgba(15,23,42,.38);z-index:2147483646;pointer-events:none`;
   const g=document.createElement('div');g.className='lc-shot';g.textContent=n;g.style.cssText=`position:fixed;left:${Math.max(4,x-12)}px;top:${Math.max(4,y-12)}px;width:26px;height:26px;border-radius:50%;background:#f59e0b;color:#111;font:700 14px/26px system-ui;text-align:center;z-index:2147483647;box-shadow:0 1px 4px rgba(0,0,0,.4)`;
   const tg=document.createElement('div');tg.className='lc-shot';tg.textContent='Contoh data · Sample data';tg.style.cssText='position:fixed;right:6px;bottom:6px;padding:3px 8px;border-radius:6px;background:rgba(17,24,39,.85);color:#fff;font:600 11px system-ui;z-index:2147483647';
   const tc=document.getElementById('toast-container');if(tc)tc.style.display='none';document.body.append(d,g,tg);return {y};},s.sel,s.text,s.n,r.miss);
  const file=OUT+s.file;fs.mkdirSync(path.dirname(file),{recursive:true});
  await p.screenshot({path:file,type:'webp',quality:58,clip:{x:0,y:Math.max(0,Math.min(box.y-200,720-560)),width:390,height:560}});
  const leak=await p.evaluate(()=>/atas\s+angin|mikepapa/i.test(document.body.innerText+[...document.querySelectorAll('input,textarea')].map(i=>i.value).join(' ')));
  log.push(s.file+' '+fs.statSync(file).size+(r.miss&&s.sel?' MISS':'')+(leak?' LEAK':''));
 }
 console.log(log.join('\n'));process.exit(0);})();
