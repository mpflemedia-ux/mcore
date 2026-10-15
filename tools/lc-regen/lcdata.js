// builds mock learning_* rows: sql=true -> after lc_01+lc_02; sql=false -> old live state (sort_order only, no images)
const fs=require('fs'),crypto=require('crypto');
const uid=s=>{const h=crypto.createHash('md5').update('lc2:'+s).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);};
module.exports=function(sql){
 const s=fs.readFileSync('/workspace/mcore-audit/supabase/migrations/20260823120000_learning_center_content_seed.sql','utf8');
 const q="'((?:[^']|'')*)'",Q=x=>x.replace(/''/g,"'");
 const ch=[...s.matchAll(new RegExp("\\('([0-9a-f-]{36})', '([a-z_]+)', (\\d+),\\s*"+q+", "+q+",\\s*"+q+",\\s*"+q+"\\)",'g'))].map(m=>({id:m[1],module_key:m[2],sort_order:+m[3],title_en:Q(m[4]),title_bm:Q(m[5]),intro_en:Q(m[6]),intro_bm:Q(m[7])}));
 const ls=[...s.matchAll(new RegExp("\\('([0-9a-f-]{36})', '([0-9a-f-]{36})', (\\d+),\\s*"+q+", "+q+",\\s*"+q+",\\s*"+q+"\\)",'g'))].map(m=>({id:m[1],chapter_id:m[2],sort_order:+m[3],title_en:Q(m[4]),title_bm:Q(m[5]),intro_en:Q(m[6]),intro_bm:Q(m[7])}));
 const st=[...s.matchAll(new RegExp("\\(gen_random_uuid\\(\\), '([0-9a-f-]{36})', (\\d+),\\s*"+q+",\\s*"+q+",\\s*(?:"+q+"|NULL),\\s*(?:"+q+"|NULL),\\s*(?:'([a-z_]+)'|NULL)\\)",'g'))].map((m,i)=>({id:'st'+i,lesson_id:m[1],step_no:+m[2],text_en:Q(m[3]),text_bm:Q(m[4]),field_note_en:m[5]&&Q(m[5]),field_note_bm:m[6]&&Q(m[6]),try_it_page:m[7]||null}));
 if(!sql) return {ch,ls,st};
 const sqlTxt=fs.readFileSync(__dirname+'/../lc_02_content.sql','utf8');
 const C=require('./content.js');const OLDCH={register:'25c4bfab-573f-451f-b8a6-47a0b39bb23e',dashboard:'d583b61b-c172-4b6f-a454-fc93380a7c64',sales:'ac4547af-2fb3-4fb6-a739-c200b0c0e1c3'},OLDN={register:1,dashboard:1,sales:5};
 [ch,ls].forEach(a=>a.forEach(r=>r.order_index=r.sort_order));st.forEach(r=>r.order_index=r.step_no);
 C.forEach(c=>{const cid=OLDCH[c.key]||uid('ch:'+c.key);if(!OLDCH[c.key])ch.push({id:cid,module_key:c.key,sort_order:c.order,order_index:c.order,title_en:c.en,title_bm:c.bm,intro_en:c.ien,intro_bm:c.ibm});
  c.lessons.forEach((l,li)=>{const lid=uid('ls:'+c.key+':'+l.slug),o=(OLDN[c.key]||0)+li+1;ls.push({id:lid,chapter_id:cid,sort_order:o,order_index:o,title_en:l.en,title_bm:l.bm,intro_en:l.ien,intro_bm:l.ibm});
   l.steps.forEach((x,si)=>{const n=si+1,img=x.shot?`lc-img/${c.key}/${l.slug}-${n}.webp`:null;st.push({id:uid('st:'+c.key+':'+l.slug+':'+n),lesson_id:lid,step_no:n,order_index:n,text_en:x.en,text_bm:x.bm,field_note_en:x.n&&x.n[0],field_note_bm:x.n&&x.n[1],try_it_page:x.t||null,image_path:img,image_alt_en:img&&'Example screen (sample data)',image_alt_bm:img&&'Contoh skrin (data contoh)'});});});});
 for(const m of sqlTxt.matchAll(/set image_path='([^']+)'.*?where lesson_id='([0-9a-f-]{36})' and step_no=1 and image_path is null/g)){const r=st.find(x=>x.lesson_id===m[2]&&x.step_no===1);if(r)r.image_path=m[1];}
 return {ch,ls,st};
};
