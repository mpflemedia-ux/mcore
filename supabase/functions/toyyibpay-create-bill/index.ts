// M-Core — ToyyibPay Fasa A: create a subscription payment bill.
// Trigger: tenant clicks "Bayar Online" in Settings/My Plan.
// Deploy with verify_jwt OFF — this function has its own custom auth
// logic (Authorization header + auth.getUser() below); ON causes Supabase
// platform to reject requests before they reach this code.
// Secrets: none of its own — reads provider secret_key/category_code from
// platform_payment_config (service role only, RLS locks it from clients).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// PRODUCTION base — switched from https://dev.toyyibpay.com after Fasa A
// verified end-to-end in sandbox on 2 Sep 2026. Real money moves now.
const TOYYIBPAY_BASE = 'https://toyyibpay.com'
const APP_BASE_URL = 'https://mpflemedia.my/app/'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function sbAdmin() {
  const url = Deno.env.get('SUPABASE_URL') || ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!url || !key) throw new Error('supabase env missing')
  return createClient(url, key)
}

function webhookUrl() {
  const base = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '')
  return `${base}/functions/v1/toyyibpay-webhook`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ success: false, error: 'POST only' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ success: false, error: 'Missing Authorization header' }, 401)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return json({ success: false, error: 'Unauthorized' }, 401)

    const sb = sbAdmin()

    const { data: profile } = await sb.from('user_profiles').select('tenant_id').eq('id', user.id).maybeSingle()
    const tenantId = profile?.tenant_id
    if (!tenantId) return json({ success: false, error: 'No tenant for this user' }, 400)

    const body = await req.json().catch(() => ({})) as { plan_id?: string; period_months?: number }
    const planId = body.plan_id
    if (!planId) return json({ success: false, error: 'plan_id required' }, 400)
    const periodMonths = Number(body.period_months) === 12 ? 12 : 1

    const { data: plan } = await sb.from('plans')
      .select('id, code, name_en, name_bm, monthly_price, annual_price')
      .eq('id', planId).maybeSingle()
    if (!plan) return json({ success: false, error: 'Plan not found' }, 404)

    const monthly = Number(plan.monthly_price || 0)
    const annual = Number(plan.annual_price || 0)
    const amount = periodMonths === 12 ? (annual || monthly * 10) : monthly
    if (!amount || amount <= 0) return json({ success: false, error: 'Invalid plan amount' }, 400)

    const { data: cfg } = await sb.from('platform_payment_config')
      .select('secret_key, category_code')
      .eq('provider', 'toyyibpay').eq('is_active', true).maybeSingle()
    if (!cfg?.secret_key || !cfg?.category_code) return json({ success: false, error: 'ToyyibPay not configured' }, 503)

    const { data: tenantRow } = await sb.from('tenants').select('name, email, phone').eq('id', tenantId).maybeSingle()
    const billTo = String(tenantRow?.name || 'M-Core Tenant').slice(0, 100)
    // tenants.email (Settings > Company Profile) is a free-text field with
    // no format constraint in the DB, unlike user.email which Supabase
    // Auth already validated at signup — so only the company-profile value
    // needs the same billEmail format check as Fasa A's tenant-invoice
    // create-bill (customers.email has the identical risk there).
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const rawTenantEmail = String(tenantRow?.email || '').trim()
    const billEmail = String((EMAIL_RE.test(rawTenantEmail) ? rawTenantEmail : null) || user.email || 'billing@mpflemedia.my').slice(0, 100)
    const billPhone = String(tenantRow?.phone || '').replace(/[^\d]/g, '').slice(0, 15) || '0110000000'

    const refNo = `SUB-${tenantId}-${Date.now()}`.slice(0, 50)
    const planName = plan.name_en || plan.code || 'M-Core Plan'
    const billName = `M-Core ${planName}`.slice(0, 30)
    const billDescription = `M-Core subscription — ${planName}, ${periodMonths} month(s)`.slice(0, 100)

    const form = new URLSearchParams({
      userSecretKey: String(cfg.secret_key),
      categoryCode: String(cfg.category_code),
      billName,
      billDescription,
      billPriceSetting: '1',
      billPayorInfo: '1',
      billAmount: String(Math.round(amount * 100)),
      billReturnUrl: `${APP_BASE_URL}#settings?toyyibpay=return`,
      billCallbackUrl: webhookUrl(),
      billExternalReferenceNo: refNo,
      billTo,
      billEmail,
      billPhone,
      billPaymentChannel: '2',
      billChargeToCustomer: '1',
    })

    let res: Response
    try {
      res = await fetch(`${TOYYIBPAY_BASE}/index.php/api/createBill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      })
    } catch (fetchErr) {
      console.error('toyyibpay-create-bill: fetch to ToyyibPay failed', fetchErr)
      throw new Error('Fetch to ToyyibPay failed: ' + ((fetchErr as Error).message || String(fetchErr)))
    }
    const rawText = await res.text()
    let data: unknown
    try { data = JSON.parse(rawText) } catch { data = null }
    console.log('toyyibpay-create-bill: createBill response', res.status, rawText.slice(0, 300))
    const first = Array.isArray(data) ? (data[0] as Record<string, unknown>) : (data as Record<string, unknown> | null)
    const billCode = first && typeof first.BillCode === 'string' ? first.BillCode : null
    if (!res.ok || !billCode) {
      const msg = (first && (first.msg as string)) || rawText.slice(0, 200) || 'createBill failed'
      throw new Error(String(msg))
    }

    const { error: insErr } = await sb.from('payment_transactions').insert({
      tenant_id: tenantId,
      purpose: 'subscription',
      plan_id: plan.id,
      period_months: periodMonths,
      provider: 'toyyibpay',
      external_reference_no: refNo,
      bill_code: billCode,
      amount,
      status: 'pending',
    })
    if (insErr) {
      console.error('toyyibpay-create-bill: insert payment_transactions failed', insErr)
      throw insErr
    }

    return json({ success: true, data: { bill_code: billCode, payment_url: `${TOYYIBPAY_BASE}/${billCode}` } })
  } catch (e) {
    console.error('toyyibpay-create-bill: error', e)
    return json({ success: false, error: (e as Error).message || 'error' }, 500)
  }
})