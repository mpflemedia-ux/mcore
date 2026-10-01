/* PAYSLIP_PAY_DATE_V1
 * Editable Pay Date for payslips. Display: pay_date || generated_at::date.
 * New rows: DB DEFAULT (Asia/Kuala_Lumpur today). generated_at stays audit-only.
 */
(function(){
if(window.PAYSLIP_PAY_DATE_V1)return;
window.PAYSLIP_PAY_DATE_V1=true;

function isBm(){try{return APP.language==='bm'}catch(e){return false}}
function todayYMD(){
  try{if(typeof _dbTodayYMD==='function')return _dbTodayYMD()}catch(e){}
  var d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function ymd(v){
  if(v==null||v==='')return '';
  var s=String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
  return '';
}
function resolvePayDate(rec){
  if(!rec)return todayYMD();
  var pd=ymd(rec.pay_date); if(pd)return pd;
  var ga=ymd(rec.generated_at); if(ga)return ga;
  try{
    var d=new Date(Number(rec.year), Number(rec.month), 1);
    if(!isNaN(d.getTime()))return d.toISOString().slice(0,10);
  }catch(e){}
  return todayYMD();
}
function softStrip(err,payload,keys){
  if(!err||!/column|schema cache|does not exist/i.test(err.message||''))return{payload:payload,stripped:false};
  var next=Object.assign({},payload),hit=false;
  keys.forEach(function(k){if(Object.prototype.hasOwnProperty.call(next,k)){delete next[k];hit=true}});
  return{payload:next,stripped:hit};
}

function wrapPdocPayDate(){
  window._pdocPayDate=function(rec){return resolvePayDate(rec)};
  window._pdocPayDate._payDateV1=true;
}

function wrapPayrollRun(){
  var o=window._payrollRunExecute;
  if(typeof o!=='function'||o._payDateV1)return;
  window._payrollRunExecute=async function(){
    var month=Number((document.getElementById('payroll-month')||{}).value);
    var year=Number((document.getElementById('payroll-year')||{}).value);
    var r=await o.apply(this,arguments);
    try{
      if(window.sb&&APP&&APP.tenant&&APP.tenant.id&&month&&year){
        var today=todayYMD();
        var sel=await sb.from('payroll_records').select('id,pay_date')
          .eq('tenant_id',APP.tenant.id).eq('month',month).eq('year',year).is('pay_date',null);
        if(sel.error&&/column|schema cache|does not exist/i.test(sel.error.message||''))return r;
        var rows=sel.data||[];
        for(var i=0;i<rows.length;i++){
          await sb.from('payroll_records').update({pay_date:today}).eq('id',rows[i].id).eq('tenant_id',APP.tenant.id);
        }
      }
    }catch(e){console.warn('PAYSLIP_PAY_DATE_V1 post-fill',e)}
    return r;
  };
  window._payrollRunExecute._payDateV1=true;
}

function wrapPostJournal(){
  var o=window._postPayrollJournal;
  if(typeof o!=='function'||o._payDateV1)return;
  window._postPayrollJournal=async function(calc,month,year,sourceId,dryRun,entryDate){
    try{
      if(calc&&ymd(calc.pay_date))entryDate=ymd(calc.pay_date);
    }catch(e){}
    return o.call(this,calc,month,year,sourceId,dryRun,entryDate);
  };
  window._postPayrollJournal._payDateV1=true;
}

function injectEditor(recId){
  if(typeof canManageHR==='function'&&!canManageHR())return;
  if(document.getElementById('payslip-pay-date-editor'))return;
  var main=document.getElementById('main'); if(!main)return;
  var bm=isBm();
  var card=document.createElement('div');
  card.id='payslip-pay-date-editor';
  card.className='card no-print';
  card.style.cssText='max-width:640px;margin:0 auto 16px;padding:16px';
  card.innerHTML=
    '<div class="card-title" style="margin-bottom:10px"><i class="ti ti-calendar-event"></i> '+(bm?'Tarikh Bayaran':'Pay Date')+'</div>'+
    '<p style="font-size:12px;color:var(--text-3);margin:0 0 10px">'+(bm
      ?'Tarikh pada slip (berasingan dari tempoh bulan/tahun). generated_at kekal audit.'
      :'Date printed on the payslip (separate from period month/year). generated_at stays audit-only.')+'</p>'+
    '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:end">'+
    '<div class="form-group" style="margin:0;min-width:180px"><label class="form-label">'+(bm?'Tarikh Bayaran':'Pay Date')+'</label>'+
    '<input id="ps-pay-date" type="date" class="form-input"></div>'+
    '<button class="btn btn-primary btn-sm" id="ps-pay-date-save"><i class="ti ti-device-floppy"></i> '+(bm?'Simpan tarikh':'Save date')+'</button>'+
    '<span id="ps-pay-date-msg" style="font-size:12px"></span></div>';

  var partial=document.getElementById('payslip-partial-editor');
  var net=main.querySelector('.pdoc-net-bar');
  if(partial&&partial.parentElement)partial.parentElement.insertBefore(card,partial);
  else if(net&&net.parentElement&&net.parentElement.parentElement)
    net.parentElement.parentElement.insertBefore(card,net.parentElement.nextSibling);
  else main.appendChild(card);

  sb.from('payroll_records').select('id,pay_date,generated_at,month,year')
    .eq('id',recId).eq('tenant_id',APP.tenant.id).maybeSingle()
    .then(function(res){
      var rec=res&&res.data;
      if(res&&res.error&&/column|schema cache|does not exist/i.test(res.error.message||'')){
        var msg=document.getElementById('ps-pay-date-msg');
        if(msg)msg.innerHTML='<span style="color:var(--warning)">'+(bm?'Jalankan migrasi pay_date di SQL Editor':'Run pay_date migration in SQL Editor')+'</span>';
        return;
      }
      if(!rec)return;
      var el=document.getElementById('ps-pay-date');
      if(el)el.value=resolvePayDate(rec);
      var btn=document.getElementById('ps-pay-date-save');
      if(btn)btn.onclick=async function(){
        var val=(document.getElementById('ps-pay-date')||{}).value;
        if(!val||!/^\d{4}-\d{2}-\d{2}$/.test(val)){
          showToast(bm?'Tarikh tidak sah':'Invalid date','error'); return;
        }
        var payload={pay_date:val};
        var up=await sb.from('payroll_records').update(payload).eq('id',recId).eq('tenant_id',APP.tenant.id);
        var error=up.error;
        if(error){
          var soft=softStrip(error,payload,['pay_date']);
          if(soft.stripped){
            var msg=document.getElementById('ps-pay-date-msg');
            if(msg)msg.innerHTML='<span style="color:var(--danger)">'+(bm?'Kolum pay_date belum wujud — jalankan SQL migrasi':'pay_date column missing — run migration SQL')+'</span>';
            showToast(bm?'Gagal simpan':'Save failed','error'); return;
          }
        }
        if(error){
          var msg2=document.getElementById('ps-pay-date-msg');
          if(msg2)msg2.innerHTML='<span style="color:var(--danger)">'+(error.message||'error')+'</span>';
          showToast(bm?'Gagal simpan':'Save failed','error'); return;
        }
        try{auditLog('update','payroll_records',recId)}catch(e){}
        var msg3=document.getElementById('ps-pay-date-msg');
        if(msg3)msg3.innerHTML='<span style="color:var(--success)">'+(bm?'Disimpan':'Saved')+'</span>';
        showToast(bm?'Tarikh bayaran disimpan':'Pay date saved','success');
        if(typeof renderPayslipDetail==='function')renderPayslipDetail(recId);
      };
    }).catch(function(e){console.warn('PAYSLIP_PAY_DATE_V1 load',e)});
}

function wrapDetail(){
  var o=window.renderPayslipDetail;
  if(typeof o!=='function'||o._payDateV1)return;
  window.renderPayslipDetail=function(id){
    var r=o.apply(this,arguments);
    var go=function(){setTimeout(function(){injectEditor(id)},120)};
    if(r&&typeof r.then==='function')r.then(go);else go();
    return r;
  };
  window.renderPayslipDetail._payDateV1=true;
}

function boot(){
  wrapPdocPayDate();
  wrapPayrollRun();
  wrapPostJournal();
  wrapDetail();
}
boot();
setTimeout(boot,400);
setTimeout(boot,1200);
})();
