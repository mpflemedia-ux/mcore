/* Lock CRM customer details under Bill-to on invoice print + public overlay */
(function () {
  var cache = {};
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function linesOf(c) {
    if (!c) return [];
    var addr = [c.address, [c.postcode, c.city].filter(Boolean).join(' '), c.state].filter(Boolean).join(', ');
    var out = [];
    if (addr) out.push(addr);
    var pe = [c.phone, c.email].filter(Boolean).join(' · ');
    if (pe) out.push(pe);
    return out;
  }
  function paintBand(band, c) {
    if (!band || band.getAttribute('data-cust-locked') === '1') return;
    var lines = linesOf(c);
    if (!lines.length) return;
    lines.forEach(function (t) {
      var d = document.createElement('div');
      d.className = 'pdoc-band-sub pdoc-cust-lock';
      d.style.cssText = 'font-size:12px;color:#334155;margin-top:2px;font-weight:500';
      d.textContent = t;
      band.appendChild(d);
    });
    band.setAttribute('data-cust-locked', '1');
  }
  function paintPublic(c) {
    var root = document.getElementById('public-inv-root');
    if (!root || root.querySelector('.pdoc-cust-lock')) return;
    var lines = linesOf(c);
    if (!lines.length) return;
    var strong = root.querySelector('strong');
    if (!strong) return;
    var wrap = strong.parentElement;
    lines.forEach(function (t) {
      var d = document.createElement('div');
      d.className = 'pdoc-cust-lock';
      d.style.cssText = 'font-size:12px;color:#334155;margin-top:2px';
      d.textContent = t;
      wrap.appendChild(d);
    });
  }
  async function loadByName(name) {
    var key = norm(name);
    if (!key) return null;
    if (cache[key]) return cache[key];
    if (!window.sb || !window.APP || !APP.tenant || !APP.tenant.id) return null;
    try {
      var r = await sb.from('customers').select('name,email,phone,address,city,state,postcode').eq('tenant_id', APP.tenant.id).is('deleted_at', null).limit(200);
      (r.data || []).forEach(function (row) { cache[norm(row.name)] = row; });
      return cache[key] || null;
    } catch (e) { return null; }
  }
  function wrapRpc() {
    if (!window.sb || typeof sb.rpc !== 'function' || sb.rpc._custWrapped) return;
    var orig = sb.rpc.bind(sb);
    sb.rpc = function (name, args) {
      var out = orig(name, args);
      Promise.resolve(out).then(function (res) {
        var d = res && res.data;
        if (name === 'get_public_invoice' && d) {
          cache[norm(d.customer_name)] = {
            name: d.customer_name,
            email: d.customer_email,
            phone: d.customer_phone,
            address: d.customer_address,
            city: d.customer_city,
            state: d.customer_state,
            postcode: d.customer_postcode
          };
          paintPublic(cache[norm(d.customer_name)]);
        }
      }).catch(function () {});
      return out;
    };
    sb.rpc._custWrapped = true;
  }
  async function run() {
    wrapRpc();
    document.querySelectorAll('.pdoc-band').forEach(async function (band) {
      if (band.getAttribute('data-cust-locked') === '1') return;
      var nameEl = band.querySelector('.pdoc-band-name');
      var name = (nameEl && nameEl.textContent) || '';
      var c = await loadByName(name);
      if (c) paintBand(band, c);
    });
    var pubName = document.querySelector('#public-inv-root strong');
    if (pubName) {
      var c2 = cache[norm(pubName.textContent)] || await loadByName(pubName.textContent);
      if (c2) paintPublic(c2);
    }
  }
  run();
  setInterval(run, 1000);
})();
