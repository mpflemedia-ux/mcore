(function () {
  var EXTRA = [
    { code: '1100', name_en: 'Maybank', account_type: 'asset' },
    { code: '1110', name_en: 'GX Bank', account_type: 'asset' },
    { code: '1200', name_en: 'Accounts Receivable', account_type: 'asset' },
    { code: '1210', name_en: 'Customer Deposits', account_type: 'liability' },
    { code: '1300', name_en: 'Inventory', account_type: 'asset' },
    { code: '1500', name_en: 'Fixed Assets', account_type: 'asset' },
    { code: '1510', name_en: 'Accumulated Depreciation', account_type: 'asset' },
    { code: '2110', name_en: 'Accrued Expenses', account_type: 'liability' },
    { code: '2400', name_en: 'SST Output Tax', account_type: 'liability' },
    { code: '2410', name_en: 'SST Input Tax', account_type: 'asset' },
    { code: '3100', name_en: 'Retained Earnings', account_type: 'equity' },
    { code: '4010', name_en: 'Sales Discount', account_type: 'revenue' },
    { code: '4100', name_en: 'Other Income', account_type: 'revenue' },
    { code: '5010', name_en: 'Purchases', account_type: 'expense' },
    { code: '5020', name_en: 'Freight In', account_type: 'expense' },
    { code: '5050', name_en: 'Cost of Goods Sold', account_type: 'expense' },
    { code: '6100', name_en: 'Salary Expense (Operating)', account_type: 'expense' },
    { code: '6110', name_en: 'EPF Expense (Employer)', account_type: 'expense' },
    { code: '6120', name_en: 'SOCSO Expense (Employer)', account_type: 'expense' },
    { code: '6130', name_en: 'EIS Expense (Employer)', account_type: 'expense' },
    { code: '6140', name_en: 'PCB Expense (Employer)', account_type: 'expense' },
    { code: '6200', name_en: 'Commission Expense (Operating)', account_type: 'expense' },
    { code: '6300', name_en: 'Rent Expense', account_type: 'expense' },
    { code: '6400', name_en: 'Utilities', account_type: 'expense' },
    { code: '6500', name_en: 'Bank Charges', account_type: 'expense' },
    { code: '6600', name_en: 'Professional Fees', account_type: 'expense' },
    { code: '6700', name_en: 'Marketing & Advertising', account_type: 'expense' },
    { code: '6800', name_en: 'Travelling & Petty', account_type: 'expense' },
    { code: '6900', name_en: 'Depreciation Expense', account_type: 'expense' },
    { code: '7000', name_en: 'Interest Expense', account_type: 'expense' },
    { code: '7100', name_en: 'Gain/Loss on Disposal', account_type: 'expense' },
    { code: '9000', name_en: 'Income Tax Expense', account_type: 'expense' }
  ];

  function cls(type) {
    return (type === 'asset' || type === 'liability' || type === 'equity') ? 'balance_sheet' : 'income_statement';
  }

  async function fixMaybankCode() {
    if (!APP.tenant || !APP.tenant.id) return;
    var { data: rows } = await sb.from('chart_of_accounts').select('id,code,name_en')
      .eq('tenant_id', APP.tenant.id).is('deleted_at', null)
      .in('code', ['2000', '1100']);
    var c2000 = (rows || []).find(function (a) { return a.code === '2000'; });
    var c1100 = (rows || []).find(function (a) { return a.code === '1100'; });
    if (!c2000 || c1100) return;
    var name = String(c2000.name_en || '');
    if (!/maybank|bank/i.test(name) && c2000.account_type === 'liability') return;
    await sb.from('chart_of_accounts').update({ code: '1100', name_en: 'Maybank' })
      .eq('id', c2000.id).eq('tenant_id', APP.tenant.id);
  }

  async function seedExtra() {
    if (!window.sb || !APP.tenant || !APP.tenant.id) return { added: 0 };
    await fixMaybankCode();
    var codes = EXTRA.map(function (a) { return a.code; });
    var { data: existing, error } = await sb.from('chart_of_accounts').select('id,code')
      .eq('tenant_id', APP.tenant.id).is('deleted_at', null).in('code', codes);
    if (error) throw error;
    var have = {};
    (existing || []).forEach(function (a) { have[a.code] = true; });
    var missing = EXTRA.filter(function (a) { return !have[a.code]; });
    if (!missing.length) return { added: 0 };
    var payload = missing.map(function (a) {
      return {
        tenant_id: APP.tenant.id,
        code: a.code,
        name_en: a.name_en,
        account_type: a.account_type,
        account_class: cls(a.account_type),
        is_active: true
      };
    });
    var ins = await sb.from('chart_of_accounts').insert(payload).select('id,code');
    if (ins.error) throw ins.error;
    return { added: missing.length };
  }

  function wrap() {
    var orig = window._coaSeedDefaults;
    if (typeof orig !== 'function' || orig._adv2) return;
    window._coaSeedDefaults = async function () {
      var isBm = APP.language === 'bm';
      await orig.apply(this, arguments);
      try {
        var r = await seedExtra();
        if (r.added > 0) {
          showToast(isBm ? (r.added + ' akaun advance ditambah') : (r.added + ' advanced account(s) added'), 'success');
          if (typeof window._coaLoad === 'function') await window._coaLoad();
        }
      } catch (e) {
        showToast((e && e.message) || String(e), 'error');
      }
    };
    window._coaSeedDefaults._adv2 = true;
  }
  wrap();
  setTimeout(wrap, 400);
})();
