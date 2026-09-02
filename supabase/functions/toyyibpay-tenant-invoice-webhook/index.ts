// M-Core — ToyyibPay Fasa B: payment callback for TENANT invoice payments
// (BYO gateway). Trigger: ToyyibPay POSTs here after a bill is paid/failed
// (billCallbackUrl set in toyyibpay-tenant-invoice-create-bill). Deploy
// with verify_jwt OFF — ToyyibPay carries no Supabase JWT, same reason
// toyyibpay-webhook (Fasa A) is verify_jwt OFF.
//
// Same multipart/form-data parsing as Fasa A's toyyibpay-webhook
// (req.formData(), not URLSearchParams(await req.text())) — that bug was
// found and fixed there; not repeating it here.
//
// ToyyibPay does NOT sign this callback, so its payload is NEVER trusted
// directly — the billcode is only used to look up which payment_transactions
// row we're talking about, then getBillTransactions() is called back to
// ToyyibPay (with the TENANT's OWN secret_key, from tenant_payment_config —
// never platform_payment_config) to read the REAL status server-side.
// Idempotent: a bill already 'paid' is never re-processed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const TOYYIBPAY_BASE = 'https://toyyibpay.com'

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ success: false, error: 'POST only' }, 405)

  try {
    const form = await req.formData()
    const rawCallback: Record<string, string> = {}
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string') rawCallback[key] = value
    }
    console.log('toyyibpay-tenant-invoice-webhook: parsed fields', JSON.stringify(rawCallback))

    const billCode = rawCallback['billcode'] || rawCallback['billCode'] || ''
    if (!billCode) return json({ success: false, error: 'billcode missing' }, 400)

    const sb = sbAdmin()

    const { data: txn } = await sb.from('payment_transactions').select('*').eq('bill_code', billCode).maybeSingle()
    if (!txn) return json({ success: false, error: 'Unknown bill_code' }, 404)

    if (txn.status === 'paid') return json({ success: true, already_processed: true })

    const { data: cfg } = await sb.from('tenant_payment_config')
      .select('secret_key')
      .eq('tenant_id', txn.tenant_id).eq('provider', 'toyyibpay').eq('is_active', true).maybeSingle()
    if (!cfg?.secret_key) return json({ success: false, error: 'ToyyibPay not configured for this tenant' }, 503)

    const verifyForm = new URLSearchParams({ billCode, userSecretKey: String(cfg.secret_key) })
    const vres = await fetch(`${TOYYIBPAY_BASE}/index.php/api/getBillTransactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyForm,
    })
    const vrawText = await vres.text()
    console.log('toyyibpay-tenant-invoice-webhook: getBillTransactions response', vres.status, vrawText.slice(0, 500))
    let vdata: unknown
    try { vdata = JSON.parse(vrawText) } catch { vdata = null }
    const list = Array.isArray(vdata) ? (vdata as Record<string, unknown>[]) : []
    const latest = list.length ? list[list.length - 1] : null
    const verifiedStatus = latest ? String(latest.billpaymentStatus ?? '') : ''

    if (verifiedStatus === '1') {
      const { error: updErr } = await sb.from('payment_transactions').update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        raw_callback: rawCallback,
      }).eq('id', txn.id)
      if (updErr) throw updErr

      if (txn.invoice_id) {
        // record_invoice_payment_from_gateway() already exists (verified by
        // Mike via pg_get_functiondef) — mirrors _paySave()'s own logic
        // (payments + payment_allocations + invoices.paid_amt/status), so
        // gateway and manual payments share one source of truth. Not
        // redefined here.
        const { error: rpcErr } = await sb.rpc('record_invoice_payment_from_gateway', {
          p_invoice_id: txn.invoice_id,
          p_tenant_id: txn.tenant_id,
          p_amount: txn.amount,
          p_gateway_ref: billCode,
        })
        if (rpcErr) throw rpcErr
      }
    } else {
      const failedStatuses = new Set(['3', '4'])
      const { error: updErr } = await sb.from('payment_transactions').update({
        status: failedStatuses.has(verifiedStatus) ? 'failed' : 'pending',
        raw_callback: rawCallback,
      }).eq('id', txn.id)
      if (updErr) throw updErr
    }

    return json({ success: true })
  } catch (e) {
    console.error('toyyibpay-tenant-invoice-webhook: error', e)
    return json({ success: false, error: (e as Error).message || 'error' }, 500)
  }
})
