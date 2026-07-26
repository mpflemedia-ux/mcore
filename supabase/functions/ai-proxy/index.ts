// NexERP — ai-proxy Edge Function
// Single reuse-able proxy to Groq for all AI features (chat, categorize, receipt).
// The Groq API key is read from the GROQ_API_KEY secret — never hardcode it here.
//
// Request:  POST { action: 'chat' | 'categorize' | 'receipt', ...action-specific fields }
// Response: { success: true, data: {...} } | { success: false, error: string }
//
// All three actions (chat, categorize, receipt) are implemented. 'receipt' uses a
// vision-capable model read from the GROQ_VISION_MODEL secret (falls back to
// qwen/qwen3.6-27b) — kept out of code so it can be swapped without a redeploy if
// Groq deprecates it, which has happened to every prior Groq vision model on a
// roughly 3-4 month cadence.

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
