// NexERP — ai-proxy Edge Function
// Single reuse-able proxy to Groq for all AI features (chat, categorize, receipt).
// The Groq API key is read from the GROQ_API_KEY secret — never hardcode it here.
//
// Request:  POST { action: '...', language: 'en'|'bm', ...action-specific fields }
// Response: { success: true, data: {...} } | { success: false, error: string }
//
// Actions: chat, categorize, receipt (vision), narrate_report, business_insight,
// draft_reminder, follow_up_suggestion. 'receipt' uses a vision-capable model read
// from the GROQ_VISION_MODEL secret (falls back to qwen/qwen3.6-27b) — kept out of
// code so it can be swapped without a redeploy if Groq deprecates it, which has
// happened to every prior Groq vision model on a roughly 3-4 month cadence. Every
// other action uses CHAT_MODEL (text-only).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const CHAT_MODEL = 'llama-3.3-70b-versatile'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

async function callGroq(
  messages: { role: string; content: unknown }[],
  model: string,
  extra: Record<string, unknown> = {},
) {
  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (!groqKey) throw new Error('GROQ_API_KEY secret not configured')

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, temperature: 0.3, ...extra }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Groq API error (${res.status}): ${errText}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

function langName(body: Record<string, unknown>) {
  return body.language === 'bm' ? 'Bahasa Melayu' : 'English'
}

async function handleChat(body: Record<string, unknown>) {
  const message = body.message
  const context = body.context
  if (!message || typeof message !== 'string') throw new Error('message is required')

  const systemPrompt =
    'You are the NexERP business assistant for a Malaysian SME. Answer questions about ' +
    'the business using ONLY the data given in the context below. Be concise, format money ' +
    'as RM X,XXX.XX, and reply in the same language the user asked in (English or Bahasa ' +
    "Melayu). If the context doesn't contain enough information to answer, say so honestly " +
    'instead of guessing.\n\nContext:\n' + (typeof context === 'string' && context ? context : '(no context provided)')

  const reply = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
    CHAT_MODEL,
  )
  return { reply }
}

interface CoaOption {
  id: string
  code?: string
  name_en?: string
  name?: string
}

async function handleCategorize(body: Record<string, unknown>) {
  const description = body.description
  const accounts = body.accounts as CoaOption[] | undefined
  if (!description || typeof description !== 'string') throw new Error('description is required')
  if (!Array.isArray(accounts) || accounts.length === 0) throw new Error('accounts is required and must be a non-empty list')

  const accountList = accounts
    .map((a) => `${a.id}: ${a.code ? a.code + ' - ' : ''}${a.name_en || a.name || ''}`)
    .join('\n')

  const systemPrompt =
    'You are an accounting assistant for a Malaysian SME. Given a bank/business transaction ' +
    'description and a list of available chart-of-accounts entries, pick the SINGLE most ' +
    'appropriate account for this transaction. Respond with ONLY a JSON object in this exact ' +
    'shape, no other text: {"account_id": "<id from the list below>", "confidence": <number 0 to 1>, ' +
    '"reasoning": "<short one-sentence reason>"}. You MUST pick account_id from the ids listed ' +
    'below — never invent one. If nothing fits well, pick the closest match and lower the confidence.\n\n' +
    'Available accounts:\n' + accountList

  const raw = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: description },
    ],
    CHAT_MODEL,
    { response_format: { type: 'json_object' } },
  )

  let parsed: { account_id?: string; confidence?: number; reasoning?: string }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('AI returned an unparseable response')
  }

  const match = accounts.find((a) => String(a.id) === String(parsed.account_id))
  if (!match) throw new Error('AI suggested an account not in the provided list')

  return {
    account_id: match.id,
    account_name: match.name_en || match.name || '',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
  }
}

const DEFAULT_VISION_MODEL = 'qwen/qwen3.6-27b'

async function handleReceipt(body: Record<string, unknown>) {
  const imageBase64 = body.image_base64
  const mimeType = typeof body.mime_type === 'string' && body.mime_type ? body.mime_type : 'image/jpeg'
  if (!imageBase64 || typeof imageBase64 !== 'string') throw new Error('image_base64 is required')

  const visionModel = Deno.env.get('GROQ_VISION_MODEL') || DEFAULT_VISION_MODEL

  const systemPrompt =
    'You are a receipt-scanning assistant for a Malaysian SME expense claim system. Extract ' +
    'the following fields from the receipt image and respond with ONLY a JSON object, no other ' +
    'text: {"vendor": "<merchant/store name>", "amount": <total amount as a plain number, no ' +
    'currency symbol>, "date": "<YYYY-MM-DD>", "description": "<short summary of what was ' +
    'purchased>", "confidence": <number 0 to 1>}. If a field cannot be read clearly, use null ' +
    'for that field and lower the confidence.'

  let raw: string
  try {
    raw = await callGroq(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the receipt details from this image.' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
      visionModel,
      { response_format: { type: 'json_object' } },
    )
  } catch (err) {
    // Re-thrown with the resolved model + payload size so the caller can see in the
    // error body whether GROQ_VISION_MODEL was actually picked up, and rule out truncation.
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Receipt vision call failed (model=${visionModel}, base64_len=${imageBase64.length}): ${msg}`)
  }

  let parsed: { vendor?: string; amount?: number; date?: string; description?: string; confidence?: number }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`AI returned an unparseable response (model=${visionModel}): ${raw.slice(0, 300)}`)
  }

  return {
    vendor: typeof parsed.vendor === 'string' ? parsed.vendor : null,
    amount: typeof parsed.amount === 'number' ? parsed.amount : null,
    date: typeof parsed.date === 'string' ? parsed.date : null,
    description: typeof parsed.description === 'string' ? parsed.description : '',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
  }
}

async function handleNarrateReport(body: Record<string, unknown>) {
  const context = body.context
  const reportType = typeof body.report_type === 'string' && body.report_type ? body.report_type : 'financial report'
  if (!context || typeof context !== 'string') throw new Error('context is required')

  const systemPrompt =
    'You are a financial narrator for a Malaysian SME. Given the report figures below, write a ' +
    'SHORT plain-language summary — 2 to 3 sentences maximum — of business performance that a ' +
    "non-accountant owner can understand at a glance. Mention the key number(s) and one notable " +
    'observation. Format money as RM X,XXX.XX. Interpret the data, do not just repeat it verbatim. ' +
    `Reply in ${langName(body)}.\n\nReport type: ${reportType}\n\nData:\n${context}`

  const reply = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Summarize this report.' },
    ],
    CHAT_MODEL,
  )
  return { summary: reply }
}

async function handleBusinessInsight(body: Record<string, unknown>) {
  const context = body.context
  if (!context || typeof context !== 'string') throw new Error('context is required')

  const systemPrompt =
    'You are a business advisor for a Malaysian SME. Given the business snapshot below (sales, ' +
    'stock, cashflow), produce 3 to 5 short, concrete insights or recommendations — each ONE ' +
    'sentence. Respond with ONLY a JSON object in this exact shape, no other text: ' +
    '{"insights": ["...", "..."]}. Base every insight strictly on the data given — never invent ' +
    `numbers not present in it. Reply in ${langName(body)}.\n\nBusiness snapshot:\n${context}`

  const raw = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Give me insights and recommendations.' },
    ],
    CHAT_MODEL,
    { response_format: { type: 'json_object' } },
  )

  let parsed: { insights?: unknown }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('AI returned an unparseable response')
  }
  const insights = Array.isArray(parsed.insights) ? parsed.insights.filter((i) => typeof i === 'string') : []
  if (insights.length === 0) throw new Error('AI returned no usable insights')
  return { insights }
}

async function handleDraftReminder(body: Record<string, unknown>) {
  const invoice = body.invoice as { ref_no?: string; customer_name?: string; total?: number; paid_amt?: number; due_date?: string } | undefined
  if (!invoice || typeof invoice !== 'object') throw new Error('invoice is required')

  const outstanding = Number(invoice.total || 0) - Number(invoice.paid_amt || 0)
  const invoiceSummary =
    `Invoice ${invoice.ref_no || '-'} for ${invoice.customer_name || 'the customer'}, ` +
    `amount RM${Number(invoice.total || 0).toFixed(2)}, outstanding RM${outstanding.toFixed(2)}, ` +
    `due date ${invoice.due_date || '-'} (overdue).`

  const systemPrompt =
    'You are drafting a payment reminder message for a Malaysian SME to send to a customer with ' +
    'an overdue invoice. Write a short, polite, professional reminder (email or WhatsApp style, ' +
    'plain text, no subject line) that includes the invoice number, outstanding amount, and due ' +
    'date. Do not be aggressive or threatening. This is a DRAFT for the business owner to review ' +
    `and edit before sending — do not include placeholders like [Your Name], sign off simply. ` +
    `Reply in ${langName(body)}.\n\n${invoiceSummary}`

  const reply = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Draft the reminder message.' },
    ],
    CHAT_MODEL,
  )
  return { draft: reply }
}

async function handleFollowUpSuggestion(body: Record<string, unknown>) {
  const context = body.context
  if (!context || typeof context !== 'string') throw new Error('context is required')

  const systemPrompt =
    'You are a sales assistant for a Malaysian SME. Given a customer\'s order/invoice history ' +
    'below, suggest ONE short, concrete follow-up action for the salesperson (eg. re-engage a ' +
    'lapsed customer, suggest an upsell based on buying pattern, or note nothing urgent is ' +
    'needed). 1-2 sentences maximum. Base it strictly on the history given — never invent orders ' +
    `or dates not present in it. Reply in ${langName(body)}.\n\nCustomer history:\n${context}`

  const reply = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Suggest a follow-up action.' },
    ],
    CHAT_MODEL,
  )
  return { suggestion: reply }
}

interface ReconcileCandidate {
  type: string
  ref: string
  date: string
  amount: number
  desc?: string
}

async function handleReconcileMatch(body: Record<string, unknown>) {
  const transactions = body.transactions as { idx: number; date: string; description: string; amount: number }[] | undefined
  const candidates = body.candidates as ReconcileCandidate[] | undefined
  if (!Array.isArray(transactions) || transactions.length === 0) throw new Error('transactions is required and must be a non-empty list')
  if (!Array.isArray(candidates)) throw new Error('candidates is required')

  const txnList = transactions.map((t) => `#${t.idx}: ${t.date}, "${t.description}", RM${Number(t.amount).toFixed(2)}`).join('\n')
  const candList = candidates.map((c, i) => `${i}: [${c.type}] ${c.ref} — ${c.date}, RM${Number(c.amount).toFixed(2)}, ${c.desc || ''}`).join('\n')

  const systemPrompt =
    'You are a bank reconciliation assistant for a Malaysian SME. Given a list of bank ' +
    'transactions and a list of candidate accounting records (invoices, payments, journal ' +
    'entries), match each bank transaction to the SINGLE best candidate by amount (must be equal ' +
    'or very close) and date proximity. If nothing fits well, say no match rather than guessing. ' +
    'Respond with ONLY a JSON object in this exact shape, no other text: {"matches": ' +
    '[{"txn_idx": <number>, "candidate_index": <number or null>, "confidence": <0 to 1>, ' +
    '"reasoning": "<short reason>"}]}. candidate_index MUST be an index from the candidate list ' +
    `below, or null. Include exactly one entry per transaction index given.\n\n` +
    `Bank transactions:\n${txnList || '(none)'}\n\nCandidate records:\n${candList || '(none)'}`

  const raw = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Match the bank transactions to candidates.' },
    ],
    CHAT_MODEL,
    { response_format: { type: 'json_object' } },
  )

  let parsed: { matches?: { txn_idx?: number; candidate_index?: number | null; confidence?: number; reasoning?: string }[] }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('AI returned an unparseable response')
  }
  const rawMatches = Array.isArray(parsed.matches) ? parsed.matches : []

  const matches = rawMatches.map((m) => {
    const candidate =
      typeof m.candidate_index === 'number' && candidates[m.candidate_index] ? candidates[m.candidate_index] : null
    return {
      txn_idx: typeof m.txn_idx === 'number' ? m.txn_idx : null,
      candidate,
      confidence: typeof m.confidence === 'number' ? m.confidence : null,
      reasoning: typeof m.reasoning === 'string' ? m.reasoning : '',
    }
  })

  return { matches }
}

async function handleMonthEndSummary(body: Record<string, unknown>) {
  const context = body.context
  if (!context || typeof context !== 'string') throw new Error('context is required')

  const systemPrompt =
    'You are an accountant assistant for a Malaysian SME, writing a month-end close summary for ' +
    'the business owner. Given the figures below, write a SHORT summary (3-5 sentences) covering: ' +
    'total income, total expenses, net profit/loss, and a comparison to the prior month if that ' +
    'data is given. Explicitly call out any anomaly (eg. an expense category that jumped ' +
    'sharply vs last month) if the data shows one — otherwise say performance looks normal. ' +
    'Base this strictly on the figures given, never invent numbers not present in them. Format ' +
    `money as RM X,XXX.XX. Reply in ${langName(body)}.\n\nFigures:\n${context}`

  const reply = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Write the month-end summary.' },
    ],
    CHAT_MODEL,
  )
  return { summary: reply }
}

interface LowStockProduct {
  name: string
  code?: string
  stock_qty: number
  reorder_point: number
  total_sold?: number
}

async function handleGeneratePO(body: Record<string, unknown>) {
  const products = body.products as LowStockProduct[] | undefined
  if (!Array.isArray(products) || products.length === 0) throw new Error('products is required and must be a non-empty list')

  const productList = products
    .map((p) => `${p.name}${p.code ? ' (' + p.code + ')' : ''}: current stock ${p.stock_qty}, reorder point ${p.reorder_point}, total units sold historically ${p.total_sold ?? 'unknown'}`)
    .join('\n')

  const systemPrompt =
    'You are drafting a Purchase Order for a Malaysian SME whose stock has fallen at or below ' +
    'reorder point for the products listed below. There is no supplier data on file and no ' +
    'purchase order system — this is a plain-text DRAFT for the business owner to review, fill ' +
    'in supplier details, and place manually. For EACH product, suggest a reasonable reorder ' +
    'quantity based on its historical sales volume and current stock gap (there is no precise ' +
    'sales-velocity data, so use judgement and keep quantities conservative, round numbers). ' +
    'Format as a simple purchase order draft: a header noting supplier details are TBD, then a ' +
    `product list (name, suggested qty, brief one-line reason). Reply in ${langName(body)}.\n\n` +
    `Low-stock products:\n${productList}`

  const reply = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Draft the purchase order.' },
    ],
    CHAT_MODEL,
  )
  return { draft: reply }
}

async function handleMarketingAdvice(body: Record<string, unknown>) {
  const context = body.context
  if (!context || typeof context !== 'string') throw new Error('context is required')

  const systemPrompt =
    'You are a marketing advisor for a Malaysian SME. Given the business snapshot below (sales ' +
    'trend, customer count, top-selling products), suggest 3 to 4 short, concrete marketing or ' +
    'promotion ideas relevant to this specific data (eg. bundle top sellers, target repeat ' +
    'customers, run a promotion during a slow trend). Each idea ONE sentence. Respond with ONLY a ' +
    'JSON object in this exact shape, no other text: {"ideas": ["...", "..."]}. Base every idea ' +
    `strictly on the data given — never invent products/numbers not present in it. Reply in ${langName(body)}.\n\n` +
    `Business snapshot:\n${context}`

  const raw = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Suggest marketing ideas.' },
    ],
    CHAT_MODEL,
    { response_format: { type: 'json_object' } },
  )

  let parsed: { ideas?: unknown }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('AI returned an unparseable response')
  }
  const ideas = Array.isArray(parsed.ideas) ? parsed.ideas.filter((i) => typeof i === 'string') : []
  if (ideas.length === 0) throw new Error('AI returned no usable ideas')
  return { ideas }
}

async function handleTaxGuidance(body: Record<string, unknown>) {
  const question = body.question
  if (!question || typeof question !== 'string') throw new Error('question is required')

  const systemPrompt =
    'You are answering a general Malaysian tax/compliance question (SST, PCB, LHDN e-Invoice) for ' +
    'a Malaysian SME owner, based on general public knowledge of Malaysian tax rules. Be concise ' +
    'and practical. You are NOT a licensed tax agent and this is NOT official advice — do not ' +
    'claim certainty on edge cases, and explicitly suggest confirming with LHDN or a licensed ' +
    `accountant when the question involves a specific/unusual situation. Reply in ${langName(body)}.`

  const reply = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ],
    CHAT_MODEL,
  )
  return { answer: reply }
}

const DOC_TYPE_DESCRIPTIONS: Record<string, string> = {
  demand_letter: 'a formal demand letter (surat tuntutan) requesting overdue payment',
  followup_email: 'a professional follow-up email',
  sop: 'a simple Standard Operating Procedure (SOP)',
  proposal: 'a simple business proposal',
}

async function handleGenerateDocument(body: Record<string, unknown>) {
  const docType = typeof body.doc_type === 'string' ? body.doc_type : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const context = typeof body.context === 'string' ? body.context.trim() : ''
  if (!context) throw new Error('context is required')

  const docLabel = DOC_TYPE_DESCRIPTIONS[docType] || 'a business document'

  const systemPrompt =
    `You are drafting ${docLabel} for a Malaysian SME business owner. ` +
    `${name ? `Recipient/subject name: ${name}. ` : ''}` +
    `Purpose/context provided by the user: ${context}\n\n` +
    'Write a complete, ready-to-use plain-text draft (no markdown formatting symbols) that the ' +
    'owner can copy and use directly, with placeholders like [Company Name] only for details ' +
    `genuinely not given above. Reply in ${langName(body)}.`

  const reply = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate the document draft.' },
    ],
    CHAT_MODEL,
  )
  return { draft: reply }
}

async function handleDailyDigest(body: Record<string, unknown>) {
  const context = body.context
  if (!context || typeof context !== 'string') throw new Error('context is required')

  const systemPrompt =
    'You are producing a short daily action-item digest for a Malaysian SME owner, combining ' +
    'overdue invoices, low-stock products, and upcoming compliance deadlines given below. ' +
    'Produce a prioritized list of concrete action items for TODAY — each ONE sentence, most ' +
    'urgent first (eg. a compliance deadline due today outranks a low-stock item). If a section ' +
    'has no items, do not invent one. If everything is empty, return an empty list. Respond with ' +
    'ONLY a JSON object in this exact shape, no other text: {"items": ["...", "..."]}. Base this ' +
    `strictly on the data given — never invent figures/dates not present in it. Reply in ${langName(body)}.\n\n` +
    `${context}`

  const raw = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: "Generate today's action items." },
    ],
    CHAT_MODEL,
    { response_format: { type: 'json_object' } },
  )

  let parsed: { items?: unknown }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('AI returned an unparseable response')
  }
  const items = Array.isArray(parsed.items) ? parsed.items.filter((i) => typeof i === 'string') : []
  return { items }
}

async function handleFraudScan(body: Record<string, unknown>) {
  const context = body.context
  if (!context || typeof context !== 'string') throw new Error('context is required')

  const systemPrompt =
    'You are a fraud/anomaly detection assistant reviewing recent POS transactions and journal ' +
    'entries for a Malaysian SME (last 30 days, given below). Flag any suspicious PATTERNS — eg. ' +
    'transactions clustered outside normal business hours (very early morning/late night), ' +
    'unusual clusters of identical amounts in quick succession, statistical outliers in amount ' +
    'compared to the rest of the data, or repeated suspicious round-number transactions. This ' +
    'dataset has NO discount or void tracking, so do not claim to check for those specifically — ' +
    'only flag what the data actually shows. If nothing looks suspicious, return an empty list — ' +
    'do not invent findings to fill a quota. Respond with ONLY a JSON object, no other text: ' +
    '{"flags": ["...", "..."]}. Each flag ONE sentence, citing the specific transaction/entry ref ' +
    `or date that triggered it. Reply in ${langName(body)}.\n\n${context}`

  const raw = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Scan for anomalies.' },
    ],
    CHAT_MODEL,
    { response_format: { type: 'json_object' } },
  )

  let parsed: { flags?: unknown }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('AI returned an unparseable response')
  }
  const flags = Array.isArray(parsed.flags) ? parsed.flags.filter((f) => typeof f === 'string') : []
  return { flags }
}

async function handleOnboardingTip(body: Record<string, unknown>) {
  const context = body.context
  if (!context || typeof context !== 'string') throw new Error('context is required')

  const systemPrompt =
    'You are a friendly onboarding guide for a Malaysian SME setting up their ERP system for the ' +
    'first time. Given the current wizard step described below, give ONE short, encouraging, ' +
    'practical tip (1-2 sentences) relevant to that step — eg. why an accurate SSM number matters, ' +
    'how fiscal year choice affects reporting, which chart-of-accounts template suits which ' +
    `industry. Keep it simple and non-technical. Reply in ${langName(body)}.\n\n${context}`

  const reply = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Give the tip.' },
    ],
    CHAT_MODEL,
  )
  return { tip: reply }
}

async function handleLogisticsSuggest(body: Record<string, unknown>) {
  const context = body.context
  if (!context || typeof context !== 'string') throw new Error('context is required')

  const systemPrompt =
    'You are a logistics assistant for a Malaysian SME giving a brief delivery planning tip for ' +
    'the delivery order below. This is TEXT-BASED ADVISORY ONLY — you have no real map/routing ' +
    'data, so do not claim precise distances, travel times, or turn-by-turn directions. Give ONE ' +
    'short practical suggestion (1-2 sentences) about timing (eg. avoid peak traffic hours in ' +
    'Malaysian cities) or general routing considerations based on the address/area given, or note ' +
    `if a driver/vehicle assignment is missing. Reply in ${langName(body)}.\n\n${context}`

  const reply = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Give delivery planning advice.' },
    ],
    CHAT_MODEL,
  )
  return { suggestion: reply }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ success: false, error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ success: false, error: 'Missing Authorization header' }, 401)

    // Defense in depth: confirm the caller is a real authenticated Supabase user,
    // on top of the platform's own verify_jwt check on this function.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return jsonResponse({ success: false, error: 'Unauthorized' }, 401)

    const body = await req.json()
    const action = body?.action

    let data
    switch (action) {
      case 'chat':
        data = await handleChat(body)
        break
      case 'categorize':
        data = await handleCategorize(body)
        break
      case 'receipt':
        data = await handleReceipt(body)
        break
      case 'narrate_report':
        data = await handleNarrateReport(body)
        break
      case 'business_insight':
        data = await handleBusinessInsight(body)
        break
      case 'draft_reminder':
        data = await handleDraftReminder(body)
        break
      case 'follow_up_suggestion':
        data = await handleFollowUpSuggestion(body)
        break
      case 'reconcile_match':
        data = await handleReconcileMatch(body)
        break
      case 'month_end_summary':
        data = await handleMonthEndSummary(body)
        break
      case 'generate_po':
        data = await handleGeneratePO(body)
        break
      case 'marketing_advice':
        data = await handleMarketingAdvice(body)
        break
      case 'tax_guidance':
        data = await handleTaxGuidance(body)
        break
      case 'generate_document':
        data = await handleGenerateDocument(body)
        break
      case 'daily_digest':
        data = await handleDailyDigest(body)
        break
      case 'fraud_scan':
        data = await handleFraudScan(body)
        break
      case 'onboarding_tip':
        data = await handleOnboardingTip(body)
        break
      case 'logistics_suggest':
        data = await handleLogisticsSuggest(body)
        break
      default:
        return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400)
    }

    return jsonResponse({ success: true, data })
  } catch (err) {
    console.error('ai-proxy error:', err)
    return jsonResponse({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      debug: {
        groq_api_key_set: !!Deno.env.get('GROQ_API_KEY'),
        groq_vision_model_secret: Deno.env.get('GROQ_VISION_MODEL') || `(not set — using default: ${DEFAULT_VISION_MODEL})`,
      },
    }, 500)
  }
})
