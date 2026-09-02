// M-Core — ToyyibPay Fasa A: payment callback.
// Trigger: ToyyibPay POSTs here after a bill is paid/failed (billCallbackUrl
// set in toyyibpay-create-bill). Deploy with verify_jwt OFF — ToyyibPay
// carries no Supabase JWT, same reason tiktok-sync's GET OAuth callback is
// verify_jwt OFF.
//
// ToyyibPay does NOT sign this callback, so its payload is NEVER trusted
// directly — the billcode from the payload is only used to look up which
// bill we're talking about, then getBillTransactions() is called back to
// ToyyibPay (with OUR OWN secret_key) to read the REAL status server-side.
// Idempotent: a bill already 'paid' is never re-processed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const TOYYIBPAY_BASE = 'https://dev.toyyibpay.com'

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
    // ToyyibPay posts application/x-www-form-urlencoded, not JSON.
    const raw = await req.text()
    const params = new URLSearchParams(raw)
    const billCode = params.get('billcode') || params.get('billCode') || ''
    if (!billCode) return json({ success: false, error: 'billcode missing' }, 400)

    const sb = sbAdmin()

    const { data: txn } = await sb.from('payment_transactions').select('*').eq('bill_code', billCode).maybeSingle()
    if (!txn) return json({ success: false, error: 'Unknown bill_code' }, 404)

    // Idempotency: already recorded paid — never re-process (avoids
    // double-crediting the tenant's plan if ToyyibPay fires the callback
    // more than once for the same bill).
    if (txn.status === 'paid') return json({ success: true, already_processed: true })

    const { data: cfg } = await sb.from('platform_payment_config')
      .select('secret_key')
      .eq('provider', 'toyyibpay').eq('is_active', true).maybeSingle()
    if (!cfg?.secret_key) return json({ success: false, error: 'ToyyibPay not configured' }, 503)

    // Server-side verification — never trust the callback payload's own
    // status field.
    const verifyForm = new URLSearchParams({ billCode, userSecretKey: String(cfg.secret_key) })
    const vres = await fetch(`${TOYYIBPAY_BASE}/index.php/api/getBillTransactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyForm,
    })
    const vdata = await vres.json().catch(() => null) as unknown
    const list = Array.isArray(vdata) ? (vdata as Record<string, unknown>[]) : []
    const latest = list.length ? list[list.length - 1] : null
    const verifiedStatus = latest ? String(latest.billpaymentStatus ?? '') : ''
    const rawCallback = Object.fromEntries(params.entries())

    if (verifiedStatus === '1') {
      const { error: updErr } = await sb.from('payment_transactions').update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        raw_callback: rawCallback,
      }).eq('id', txn.id)
      if (updErr) throw updErr

      if (txn.plan_id && txn.period_months) {
        // record_tenant_payment() now also accepts service_role calls (see
        // 20260902110000_record_tenant_payment_service_role.sql) — this is
        // the same RPC the Admin UI uses for a manual bank-transfer
        // payment, so plan/expiry upgrade logic has exactly one source of
        // truth regardless of payment method.
        const { error: rpcErr } = await sb.rpc('record_tenant_payment', {
          p_tenant_id: txn.tenant_id,
          p_plan_id: txn.plan_id,
          p_amount: txn.amount,
          p_payment_date: new Date().toISOString().slice(0, 10),
          p_payment_method: 'online_banking',
          p_period_months: txn.period_months,
          p_period_end_override: null,
        })
        if (rpcErr) throw rpcErr
      }
    } else {
      const failedStatuses = new Set(['3', '4']) // 3=fail, 4=cancelled
      const { error: updErr } = await sb.from('payment_transactions').update({
        status: failedStatuses.has(verifiedStatus) ? 'failed' : 'pending',
        raw_callback: rawCallback,
      }).eq('id', txn.id)
      if (updErr) throw updErr
    }

    return json({ success: true })
  } catch (e) {
    return json({ success: false, error: (e as Error).message || 'error' }, 500)
  }
})
