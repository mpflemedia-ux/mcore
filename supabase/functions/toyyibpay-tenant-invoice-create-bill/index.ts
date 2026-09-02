// M-Core — ToyyibPay Fasa B: create an online payment bill for a TENANT'S
// customer invoice (BYO gateway — each tenant's own ToyyibPay account,
// money goes straight to the tenant, Phion never touches it).
// Trigger: customer clicks "Pay Online" on the PUBLIC invoice page
// (?public_inv=<token>) — there is no Supabase session at all here, this
// is a fully public/anonymous endpoint. Deploy with verify_jwt OFF.
//
// Identifies the invoice ONLY by its public_token (the same opaque token
// get_public_invoice uses) — never by raw invoice_id — so the public
// client never needs to know or pass the invoice's real UUID.
// tenant_id is ALWAYS derived from the invoice row itself, never trusted
// from the request body, so this can never be pointed at another
// tenant's invoice or payment config.
// Secrets: none of its own — reads the TENANT's own secret_key/
// category_code from tenant_payment_config (service role only, RLS locks
// it from clients) — never platform_payment_config (that's Fasa A/Phion's
// own subscription billing, unrelated to this).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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
  return `${base}/functions/v1/toyyibpay-tenant-invoice-webhook`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ success: false, error: 'POST only' }, 405)

  try {
    const body = await req.json().catch(() => ({})) as { token?: string }
    const token = String(body.token || '').trim()
    if (!token || token.length < 8) return json({ success: false, error: 'Invalid token' }, 400)

    const sb = sbAdmin()

    const { data: inv } = await sb.from('invoices')
      .select('id, tenant_id, ref_no, total, paid_amt, status, customer_id, customer_name')
      .eq('public_token', token).is('deleted_at', null).maybeSingle()
    if (!inv) return json({ success: false, error: 'Invoice not found' }, 404)
    if (String(inv.status) === 'cancelled') return json({ success: false, error: 'Invoice cancelled' }, 400)

    const tenantId = inv.tenant_id

    // Amount computed SERVER-SIDE from the invoice row — never trust a
    // client-supplied amount for a payment bill. Also doubles as the
    // idempotent guard: an already-settled invoice can't create a new bill.
    const amount = Math.round((Number(inv.total || 0) - Number(inv.paid_amt || 0)) * 100) / 100
    if (!amount || amount <= 0) return json({ success: false, error: 'Invoice already paid' }, 400)

    const { data: cfg } = await sb.from('tenant_payment_config')
      .select('secret_key, category_code')
      .eq('tenant_id', tenantId).eq('provider', 'toyyibpay').eq('is_active', true).maybeSingle()
    if (!cfg?.secret_key || !cfg?.category_code) return json({ success: false, error: 'Online payment not available for this tenant' }, 503)

    const { data: customer } = inv.customer_id
      ? await sb.from('customers').select('name, email, phone').eq('id', inv.customer_id).maybeSingle()
      : { data: null }
    const billTo = String(inv.customer_name || customer?.name || 'Customer').slice(0, 100)
    const billEmail = String(customer?.email || 'noreply@example.com').slice(0, 100)
    const billPhone = String(customer?.phone || '').replace(/[^\d]/g, '').slice(0, 15) || '0110000000'

    const refNo = `INV-${inv.id}-${Date.now()}`.slice(0, 50)
    const billName = `Payment ${inv.ref_no || ''}`.slice(0, 30)
    const billDescription = `Invoice payment — ${inv.ref_no || inv.id}`.slice(0, 100)

    const form = new URLSearchParams({
      userSecretKey: String(cfg.secret_key),
      categoryCode: String(cfg.category_code),
      billName,
      billDescription,
      billPriceSetting: '1',
      billPayorInfo: '1',
      billAmount: String(Math.round(amount * 100)),
      billReturnUrl: `${APP_BASE_URL}?public_inv=${encodeURIComponent(token)}&toyyibpay=return`,
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
      console.error('toyyibpay-tenant-invoice-create-bill: fetch to ToyyibPay failed', fetchErr)
      throw new Error('Fetch to ToyyibPay failed: ' + ((fetchErr as Error).message || String(fetchErr)))
    }
    const rawText = await res.text()
    let data: unknown
    try { data = JSON.parse(rawText) } catch { data = null }
    console.log('toyyibpay-tenant-invoice-create-bill: createBill response', res.status, rawText.slice(0, 300))
    const first = Array.isArray(data) ? (data[0] as Record<string, unknown>) : (data as Record<string, unknown> | null)
    const billCode = first && typeof first.BillCode === 'string' ? first.BillCode : null
    if (!res.ok || !billCode) {
      const msg = (first && (first.msg as string)) || rawText.slice(0, 200) || 'createBill failed'
      throw new Error(String(msg))
    }

    const { error: insErr } = await sb.from('payment_transactions').insert({
      tenant_id: tenantId,
      purpose: 'invoice',
      invoice_id: inv.id,
      provider: 'toyyibpay',
      external_reference_no: refNo,
      bill_code: billCode,
      amount,
      status: 'pending',
    })
    if (insErr) {
      console.error('toyyibpay-tenant-invoice-create-bill: insert payment_transactions failed', insErr)
      throw insErr
    }

    return json({ success: true, data: { bill_code: billCode, payment_url: `${TOYYIBPAY_BASE}/${billCode}` } })
  } catch (e) {
    console.error('toyyibpay-tenant-invoice-create-bill: error', e)
    return json({ success: false, error: (e as Error).message || 'error' }, 500)
  }
})
