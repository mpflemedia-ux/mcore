/* PAYSLIP_ACCUM_OUTSTANDING_V1
 * Accumulated Outstanding (Baki Belum Bayar Terkumpul) on payslip print/PDF.
 * Definition: sum of per-period balance (balance_outstanding ?? net_pay-amount_paid)
 * for same tenant+employee where (year,month) <= current slip period AND the period
 * is outstanding-tracked (same gate as Payment/Balance: payment_note OR partial pay).
 * Virgin Run-Payroll unpaid slips (amount_paid 0, no note) do NOT inflate the total.
 * Computed on render via cache warm — no denormalized DB column / no payment ledger.
 * Line only appears when Payment/Balance section is already shown.
 */
(function(){
if(window.PAYSLIP_ACCUM_OUTSTANDING_V1)return;
window.PAYSLIP_ACCUM_OUTSTANDING_V1=true;

function r2(n){return Math.round(Number(n||0)*100)/100}
function isBm(){try{return APP.language==='bm'}catch(e){return false}}
function fmt(n){return typeof formatRM==='function'?formatRM(n):('RM '+r2(n).toFixed(2))}
function periodKey(y,m){return Number(y)*12+Number(m)}
function periodBal(row){
  if(row.balance_outstanding!=null&&row.balance_outstanding!=='')return r2(row.balance_outstanding);
  return r2(Number(row.net_pay||0)-Number(row.amount_paid||0));
}
/** Same gate as payslip-statutory-partial hasPartialPay — intentional outstanding tracking. */
function isTrackedOutstanding(rec){
  if(!rec)return false;
  var note=(rec.payment_note||'').trim();
  if(rec.amount_paid==null&&rec.balance_outstanding==null&&!note)return false;
  var paid=r2(rec.amount_paid),net=r2(rec.net_pay);
  var bal=periodBal(rec);
  if(note)return true;
  if(!(paid>0))return false;
  if(bal<=0&&paid>=net)return false;
  return true;
}

window._pspAccumRows=window._pspAccumRows||[]; // [{employee_id,month,year,net_pay,amount_paid,balance_outstanding,payment_note}]
window._pspAccumWarm={}; // empId -> true while/after warm

function mergeRows(rows){
  if(!rows||!rows.length)return;
  var map={};
  (window._pspAccumRows||[]).forEach(function(r){
    map[r.employee_id+'|'+r.year+'|'+r.month]=r;
  });
  rows.forEach(function(r){
    map[r.employee_id+'|'+r.year+'|'+r.month]=r;
  });
  window._pspAccumRows=Object.keys(map).map(function(k){return map[k]});
}

function computeAccum(rec){
  if(!rec||!rec.employee_id||rec.month==null||rec.year==null)return null;
  var rows=window._pspAccumRows||[];
  var mine=rows.filter(function(r){return r.employee_id===rec.employee_id});
  if(!mine.length)return null; // cache miss
  var key=periodKey(rec.year,rec.month),sum=0,any=false;
  mine.forEach(function(r){
    if(periodKey(r.year,r.month)>key)return;
    if(!isTrackedOutstanding(r))return;
    sum+=periodBal(r);any=true;
  });
  if(!any){
    // Current slip shows Payment/Balance but no tracked rows in cache — fall back to this period only
    return periodBal(rec);
  }
  return r2(sum);
}

async function warmForEmployees(empIds){
  if(!window.sb||!APP||!APP.tenant||!APP.tenant.id)return;
  var ids=(empIds||[]).filter(Boolean);
  var uniq=[];
  ids.forEach(function(id){if(uniq.indexOf(id)<0)uniq.push(id)});
  if(!uniq.length)return;
  try{
    var q=sb.from('payroll_records')
      .select('employee_id,month,year,net_pay,amount_paid,balance_outstanding,payment_note')
      .eq('tenant_id',APP.tenant.id)
      .in('employee_id',uniq);
    var res=await q;
    if(res&&res.error){
      if(/column|schema cache|does not exist/i.test(res.error.message||''))
        console.warn('PAYSLIP_ACCUM_OUTSTANDING_V1: partial-pay columns missing — run migration 20260930030000');
      return;
    }
    mergeRows(res.data||[]);
    uniq.forEach(function(id){window._pspAccumWarm[id]=true});
  }catch(e){console.warn('PAYSLIP_ACCUM_OUTSTANDING_V1 warm',e)}
}

function injectAccumRow(html,accum){
  var bm=isBm();
  var label=bm?'Baki Belum Bayar Terkumpul':'Accumulated Outstanding';
  var row='<tr class="pdoc-accum-outstanding"><td>'+label+'</td><td style="text-align:right">'+fmt(accum)+'</td></tr>';
  // Prefer: after Balance Outstanding total-row inside pay-balance table
  var re=/((?:class="pdoc-total-row"[^>]*>[\s\S]*?(?:Baki Belum Bayar|Balance Outstanding)[\s\S]*?<\/tr>))/;
  if(re.test(html))return html.replace(re,'$1'+row);
  // Fallback: before closing tbody of pay-balance table
  if(html.indexOf('pdoc-pay-balance-table')>=0)
    return html.replace(/(<table class="pdoc-table pdoc-pay-balance-table"><tbody>)([\s\S]*?)(<\/tbody><\/table>)/,
      function(_m,a,body,c){return a+body+row+c});
  return html;
}

function wrapPayslipHtml(){
  var o=window._pdocPayslipHtml;
  if(typeof o!=='function')return;
  if(o._accumOutstandingV1||window._pspAccumHtmlHooked)return;
  window._pspAccumHtmlHooked=true;
  window._pdocPayslipHtml=function(rec){
    var html=o.apply(this,arguments);
    if(!rec)return html;
    // Only when Payment/Balance section already present (hasPartialPay path)
    if(!/pdoc-pay-balance|Payment \/ Balance|Bayaran \/ Baki/.test(html))return html;
    if(/pdoc-accum-outstanding|Accumulated Outstanding|Baki Belum Bayar Terkumpul/.test(html))return html;
    var accum=computeAccum(rec);
    if(accum==null){
      // Cache miss: kick warm for next paint (detail wrap usually warms first)
      try{
        if(rec.employee_id&&!window._pspAccumWarm[rec.employee_id])
          warmForEmployees([rec.employee_id]);
      }catch(e){}
      return html;
    }
    return injectAccumRow(html,accum);
  };
  window._pdocPayslipHtml._accumOutstandingV1=true;
}

function wrapDetail(){
  var o=window.renderPayslipDetail;
  if(typeof o!=='function'||o._accumOutstandingV1)return;
  window.renderPayslipDetail=async function(id){
    try{
      if(window.sb&&APP&&APP.tenant&&APP.tenant.id&&id){
        var res=await sb.from('payroll_records').select('employee_id')
          .eq('id',id).eq('tenant_id',APP.tenant.id).maybeSingle();
        if(res&&res.data&&res.data.employee_id)
          await warmForEmployees([res.data.employee_id]);
      }
    }catch(e){console.warn('PAYSLIP_ACCUM_OUTSTANDING_V1 detail warm',e)}
    return o.apply(this,arguments);
  };
  window.renderPayslipDetail._accumOutstandingV1=true;
}

function wrapPrint(){
  var o=window.renderPayslipsPrint;
  if(typeof o!=='function'||o._accumOutstandingV1)return;
  window.renderPayslipsPrint=async function(month,year){
    try{
      if(window.sb&&APP&&APP.tenant&&APP.tenant.id&&month&&year){
        var res=await sb.from('payroll_records').select('employee_id')
          .eq('tenant_id',APP.tenant.id).eq('month',Number(month)).eq('year',Number(year));
        var ids=(res.data||[]).map(function(r){return r.employee_id}).filter(Boolean);
        if(ids.length)await warmForEmployees(ids);
      }
    }catch(e){console.warn('PAYSLIP_ACCUM_OUTSTANDING_V1 print warm',e)}
    return o.apply(this,arguments);
  };
  window.renderPayslipsPrint._accumOutstandingV1=true;
}

function boot(){
  wrapPayslipHtml();
  wrapDetail();
  wrapPrint();
}
boot();
setTimeout(boot,400);
setTimeout(boot,1200);
})();
