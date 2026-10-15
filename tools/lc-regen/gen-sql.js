const crypto=require('crypto'),fs=require('fs');const C=require('./content.js');
const uid=s=>{const h=crypto.createHash('md5').update('lc2:'+s).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);};
const q=v=>v==null?'NULL':"'"+String(v).replace(/'/g,"''")+"'";
const OLDCH={register:'25c4bfab-573f-451f-b8a6-47a0b39bb23e',dashboard:'d583b61b-c172-4b6f-a454-fc93380a7c64',sales:'ac4547af-2fb3-4fb6-a739-c200b0c0e1c3'};
const OLDN={register:1,dashboard:1,sales:5};
// old lessons: image on step 1 => [lessonId, chapterKey, page, params, sel, text]
const OLD=[['4bd85981-867a-4fe8-a296-5131d887f038','register','settings','*','My Plan'],['fe61436e-7902-45c7-b50e-6fecb9d42043','dashboard','dashboard','*','Revenue'],['adb1d67f-0da9-422e-95bf-8be61acd03d6','crm','crm','',''],['4a61893a-3454-4d82-96f7-50b41a09617b','sales','sales','*','Quotations'],['cc8d3411-f3b9-43af-b84f-544e13d52790','sales','sales','*','Quotations'],['acfb18e1-a700-4f5e-9c7e-914695657b5e','sales','sales','button','New Invoice'],['2c5cbb0a-e25d-47fa-acba-be79cd4272d9','sales','sales','*','Invoices'],['6bb9b7ac-584b-4352-b697-bd014547e871','sales','sales','*','Credit Notes'],['7f887d1b-6d63-4b5f-80bf-9b2ade7bce93','pos','pos','',''],['f722fd53-cc85-476b-b30c-d3d1089b0ca1','inventory','inventory','',''],['6d5cd36a-3724-4d96-befe-159f045f523d','purchasing','purchasing','',''],['6da56a89-9e04-45e2-9b39-69327bc9e81b','production','production','',''],['2d7e263e-cf00-480a-9f6e-d050165367e5','logistics','logistics','',''],['dc922c5b-5915-4006-90a4-03117e50101d','hr','hr','',''],['95dc6ad7-6626-4084-b3bd-1af76063d039','hr','hr','',''],['3a3402f4-9515-49dc-8dde-a80a53518fcf','hr','hr','',''],['f1eb4e45-20d3-4482-99fc-38dc6629a28a','hr','hr','',''],['0dbe7d33-e07d-4f3b-850e-92f7b9675efa','applicants','applicants','',''],['2c2f22e1-57cb-4d64-921c-fd5d242f59cd','accounting','accounting','*','Chart of Accounts'],['fb8c85c0-a7af-4e63-ab0d-8ef27bda6b82','accounting','accounting','*','Journal Entries'],['affa6c55-95ca-49db-865d-8f9d3c5ca7b6','accounting','accounting','*','Fiscal Years'],['0c660df7-7548-48e6-af06-a432a2a2d43f','accounting','expense_claims','button','New Claim'],['3a3edc5f-c25b-4ac2-bcd3-9755e7a0f6c3','accounting','accounting','*','Petty Cash'],['a52f4c27-2e42-4e5c-924c-5d32b201aebd','accounting','accounting','*','Bank Reconciliation'],['0ce7df18-11da-429c-99e6-846bd4321704','vouchers','vouchers','',''],['9639df7e-aaa6-4fd5-90a4-5784e684329f','reports','reports','','']];
const shots=[];let s1=[],s2=[];
s1.push(`-- Learning Center v2 · 01 schema (idempotent, safe to re-run). Run BEFORE lc_02_content.sql.
-- Fixes order_index vs sort_order mismatch by keeping BOTH columns in sync; adds per-step image columns.
alter table public.learning_chapters add column if not exists sort_order int, add column if not exists order_index int, add column if not exists deleted_at timestamptz;
alter table public.learning_lessons  add column if not exists sort_order int, add column if not exists order_index int, add column if not exists deleted_at timestamptz;
alter table public.learning_steps    add column if not exists step_no int, add column if not exists order_index int, add column if not exists deleted_at timestamptz,
  add column if not exists image_path text, add column if not exists image_alt_en text, add column if not exists image_alt_bm text;
update public.learning_chapters set order_index = sort_order where order_index is null and sort_order is not null;
update public.learning_chapters set sort_order = order_index where sort_order is null and order_index is not null;
update public.learning_lessons  set order_index = sort_order where order_index is null and sort_order is not null;
update public.learning_lessons  set sort_order = order_index where sort_order is null and order_index is not null;
update public.learning_steps    set order_index = step_no where order_index is null and step_no is not null;
update public.learning_steps    set step_no = order_index where step_no is null and order_index is not null;
-- read access for signed-in users (global content, not tenant data)
alter table public.learning_chapters enable row level security;
alter table public.learning_lessons  enable row level security;
alter table public.learning_steps    enable row level security;
drop policy if exists lc2_read_chapters on public.learning_chapters;
create policy lc2_read_chapters on public.learning_chapters for select to authenticated using (deleted_at is null);
drop policy if exists lc2_read_lessons on public.learning_lessons;
create policy lc2_read_lessons on public.learning_lessons for select to authenticated using (deleted_at is null);
drop policy if exists lc2_read_steps on public.learning_steps;
create policy lc2_read_steps on public.learning_steps for select to authenticated using (deleted_at is null);
-- platform admins may edit content (direct subquery on user_profiles)
drop policy if exists lc2_pa_write_steps on public.learning_steps;
create policy lc2_pa_write_steps on public.learning_steps for all to authenticated
  using (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'platform_admin'))
  with check (exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'platform_admin'));
`);
s2.push(`-- Learning Center v2 · 02 content (idempotent upsert by stable ids). Run AFTER lc_01_schema.sql.\nbegin;`);
let nCh=0,nL=0,nS=0;
C.forEach(c=>{
 const chId=OLDCH[c.key]||uid('ch:'+c.key);
 if(!OLDCH[c.key]){nCh++;s2.push(`insert into public.learning_chapters (id, module_key, sort_order, order_index, title_en, title_bm, intro_en, intro_bm) values (${q(chId)}, ${q(c.key)}, ${c.order}, ${c.order}, ${q(c.en)}, ${q(c.bm)}, ${q(c.ien)}, ${q(c.ibm)})
 on conflict (id) do update set module_key=excluded.module_key, sort_order=excluded.sort_order, order_index=excluded.order_index, title_en=excluded.title_en, title_bm=excluded.title_bm, intro_en=excluded.intro_en, intro_bm=excluded.intro_bm, deleted_at=null;`);}
 c.lessons.forEach((l,li)=>{
  nL++;const lid=uid('ls:'+c.key+':'+l.slug);const ord=(OLDN[c.key]||0)+li+1;
  s2.push(`insert into public.learning_lessons (id, chapter_id, sort_order, order_index, title_en, title_bm, intro_en, intro_bm) values (${q(lid)}, ${q(chId)}, ${ord}, ${ord}, ${q(l.en)}, ${q(l.bm)}, ${q(l.ien)}, ${q(l.ibm)})
 on conflict (id) do update set chapter_id=excluded.chapter_id, sort_order=excluded.sort_order, order_index=excluded.order_index, title_en=excluded.title_en, title_bm=excluded.title_bm, intro_en=excluded.intro_en, intro_bm=excluded.intro_bm, deleted_at=null;`);
  l.steps.forEach((s,si)=>{nS++;const n=si+1;const img=s.shot?`lc-img/${c.key}/${l.slug}-${n}.webp`:null;
   if(img)shots.push({file:img,page:s.shot[0],params:s.shot[1],sel:s.shot[2],text:s.shot[3],role:s.shot[4]||'owner',n});
   const ae=img?'Example screen (sample data): '+s.en.slice(0,140):null, ab=img?'Contoh skrin (data contoh): '+s.bm.slice(0,140):null;
   const sid=uid('st:'+c.key+':'+l.slug+':'+n);
   const vals=`text_en=${q(s.en)}, text_bm=${q(s.bm)}, field_note_en=${q(s.n&&s.n[0])}, field_note_bm=${q(s.n&&s.n[1])}, try_it_page=${q(s.t)}, image_path=${q(img)}, image_alt_en=${q(ae)}, image_alt_bm=${q(ab)}, order_index=${n}, deleted_at=null`;
   s2.push(`update public.learning_steps set ${vals} where lesson_id=${q(lid)} and step_no=${n};
insert into public.learning_steps (id, lesson_id, step_no, order_index, text_en, text_bm, field_note_en, field_note_bm, try_it_page, image_path, image_alt_en, image_alt_bm)
 select ${q(sid)}, ${q(lid)}, ${n}, ${n}, ${q(s.en)}, ${q(s.bm)}, ${q(s.n&&s.n[0])}, ${q(s.n&&s.n[1])}, ${q(s.t)}, ${q(img)}, ${q(ae)}, ${q(ab)}
 where not exists (select 1 from public.learning_steps where lesson_id=${q(lid)} and step_no=${n});`);});
 });
});
s2.push('-- images for existing lessons (step 1)');
OLD.forEach(o=>{const img=`lc-img/${o[1]}/old-${o[0].slice(0,8)}.webp`;shots.push({file:img,page:o[2],params:{},sel:o[3],text:o[4],role:'owner',n:1});
 s2.push(`update public.learning_steps set image_path=${q(img)}, image_alt_en='Example screen (sample data)', image_alt_bm='Contoh skrin (data contoh)' where lesson_id=${q(o[0])} and step_no=1 and image_path is null;`);});
s2.push('commit;');
fs.writeFileSync('../lc_01_schema.sql',s1.join('\n'));fs.writeFileSync('../lc_02_content.sql',s2.join('\n')+'\n');
fs.writeFileSync('shots.json',JSON.stringify(shots,null,1));
// client-side: lesson ids for starter path + chapter->page map
const starter=['register:getting-started','core_nav:sidebar','dashboard:period','sd_client:my-services','sd_client:multi-request','core_nav:notifications'].map(k=>uid('ls:'+k));
const pages={};C.forEach(c=>{if(c.page)pages[c.key]=c.page});
fs.writeFileSync('client.json',JSON.stringify({starter,pages}));
console.log({nCh,nL,nS,shots:shots.length});
