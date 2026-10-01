/* PDOC_CUSTOMER_LOCK_V8 — bill-to dedupe (no double address+phone on print/PDF) */
(function(){
function digits(s){ return String(s||'').replace(/\D/g,''); }
function norm(s){ return String(s||'').replace(/\s+/g,' ').trim().toLowerCase(); }
function partAlreadyIn(hay, part){
  var p = norm(part);
  if(!p) return true;
  var h = norm(hay);
  if(h.indexOf(p)>=0) return true;
  var pd = digits(part);
  if(pd.length>=8 && digits(hay).indexOf(pd)>=0) return true;
  return false;
}
function tidyCommaLine(s){
  var bits = String(s||'').split(',').map(function(x){ return x.trim(); }).filter(Boolean);
  var out = [];
  for(var i=0;i<bits.length;i++){
    if(partAlreadyIn(out.join(', '), bits[i])) continue;
    out.push(bits[i]);
  }
  return out.join(', ');
}
/** Build unique address + phone·email lines (skips city/state/postcode/phone already inside address_line1). */
function billToLines(c){
  if(!c) return { addr:'', pe:'', lines:[] };
  var line1 = String(c.address_line1||c.address||'').trim();
  var parts = [];
  if(line1) parts.push(tidyCommaLine(line1));
  var pcCity = [c.postcode, c.city].filter(Boolean).join(' ');
  if(pcCity && !partAlreadyIn(parts.join(', '), pcCity)) parts.push(pcCity);
  if(c.state && !partAlreadyIn(parts.join(', '), String(c.state).trim())) parts.push(String(c.state).trim());
  var addr = parts.filter(Boolean).join(', ');
  var peBits = [];
  if(c.phone && !partAlreadyIn(addr, c.phone)) peBits.push(String(c.phone).trim());
  if(c.email && !partAlreadyIn(addr+' '+peBits.join(' '), c.email)) peBits.push(String(c.email).trim());
  var pe = peBits.join(' \u00b7 ');
  var lines = [];
  if(addr) lines.push(addr);
  if(pe) lines.push(pe);
  return { addr:addr, pe:pe, lines:lines };
}
window._pdocCustBillTo = billToLines;
function alreadyHasContact(band){
  var subs = band.querySelectorAll('.pdoc-band-sub');
  for(var i=0;i<subs.length;i++){
    var t = (subs[i].textContent||'');
    if(t.indexOf('@')>=0) return true;
    // MY phones often use hyphens/spaces — strip non-digits before length check
    if(digits(t).length>=8) return true;
  }
  return false;
}
/** Collapse duplicate / redundant .pdoc-band-sub siblings (template + lock, or DB-doubled line). */
function dedupeBandSubs(band){
  var subs = [].slice.call(band.querySelectorAll('.pdoc-band-sub'));
  if(!subs.length) return;
  var keptText = [];
  var keptNodes = [];
  for(var i=0;i<subs.length;i++){
    var raw = tidyCommaLine(subs[i].textContent||'');
    if(!raw){ subs[i].parentNode && subs[i].parentNode.removeChild(subs[i]); continue; }
    if(raw !== (subs[i].textContent||'').trim()) subs[i].textContent = raw;
    var dup = false;
    for(var k=0;k<keptText.length;k++){
      if(partAlreadyIn(keptText[k], raw) || partAlreadyIn(raw, keptText[k])){
        // Prefer the longer / more complete line
        if(norm(raw).length > norm(keptText[k]).length){
          keptNodes[k].textContent = raw;
          keptText[k] = raw;
        }
        dup = true;
        break;
      }
    }
    if(dup){ subs[i].parentNode && subs[i].parentNode.removeChild(subs[i]); continue; }
    keptText.push(raw);
    keptNodes.push(subs[i]);
  }
}
function linesOf(c){ return billToLines(c).lines; }
function paint(band,c){
  if(!band||!c||band.getAttribute('data-cust-locked')==='1') return;
  dedupeBandSubs(band);
  var existing = [].map.call(band.querySelectorAll('.pdoc-band-sub'), function(el){ return el.textContent||''; }).join(' | ');
  var lines = linesOf(c).filter(function(line){ return !partAlreadyIn(existing, line); });
  if(!lines.length){ band.setAttribute('data-cust-locked','1'); return; }
  lines.forEach(function(t){
    var d = document.createElement('div');
    d.className = 'pdoc-band-sub';
    d.style.cssText = 'font-size:12px;color:#334155;margin-top:3px;font-weight:600';
    d.textContent = t;
    band.appendChild(d);
  });
  dedupeBandSubs(band);
  band.setAttribute('data-cust-locked','1');
}
async function lookup(name){
  if(!window.sb||!window.APP||!APP.tenant||!name) return null;
  var raw = String(name).replace(/\s+/g,' ').trim();
  var token = raw.split(/[\s\-\u2013\u2014]+/)[0];
  if(token.length<3) token = raw.slice(0,12);
  try{
    var q = await sb.from('customers').select('name,email,phone,address_line1,city,state,postcode').eq('tenant_id',APP.tenant.id).ilike('name','%'+token+'%').limit(20);
    if(q.error) q = await sb.from('customers').select('name,email,phone').eq('tenant_id',APP.tenant.id).ilike('name','%'+token+'%').limit(20);
    var rows = q.data||[];
    var n = raw.toLowerCase();
    return rows.find(function(x){ return String(x.name||'').replace(/\s+/g,' ').trim().toLowerCase()===n; })
      || rows.find(function(x){ return String(x.name||'').toLowerCase().indexOf(token.toLowerCase())>=0; })
      || rows[0]||null;
  }catch(e){ return null; }
}
async function scan(){
  var bands = document.querySelectorAll('.pdoc-band');
  for(var i=0;i<bands.length;i++){
    var band = bands[i];
    dedupeBandSubs(band);
    if(band.getAttribute('data-cust-locked')==='1') continue;
    // Template already rendered address and/or contact → lock only; never re-append full block
    if(band.querySelector('.pdoc-band-sub')){
      // Still allow fill of missing phone/email only (not a second address block)
      var nameEl = band.querySelector('.pdoc-band-name');
      var name = nameEl && nameEl.textContent;
      if(name && name!=='-' && !alreadyHasContact(band)){
        var cMiss = await lookup(name);
        if(cMiss) paint(band, cMiss);
        else band.setAttribute('data-cust-locked','1');
      } else {
        band.setAttribute('data-cust-locked','1');
      }
      continue;
    }
    var nameEl2 = band.querySelector('.pdoc-band-name');
    var name2 = nameEl2 && nameEl2.textContent;
    if(!name2||name2==='-') continue;
    var c = await lookup(name2);
    if(c) paint(band,c);
  }
}
scan();
setInterval(scan,1200);
})();
