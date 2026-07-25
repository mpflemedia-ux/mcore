// NexERP — ai-proxy Edge Function
// Single reuse-able proxy to Groq for all AI features (chat, categorize, receipt).
// The Groq API key is read from the GROQ_API_KEY secret — never hardcode it here.
//
// Request:  POST { action: 'chat' | 'categorize' | 'receipt', ...action-specific fields }
// Response: { success: true, data: {...} } | { success: false, error: string }
//
// Only 'chat' is implemented so far. 'categorize' and 'receipt' are wired into the
// switch but return 501 until those features are built (see NexERP AI feature plan).

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

async function callGroq(messages: { role: string; content: string }[], model: string) {
  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (!groqKey) throw new Error('GROQ_API_KEY secret not configured')

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, temperature: 0.3 }),
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
        return jsonResponse({ success: false, error: 'categorize action not implemented yet' }, 501)
      case 'receipt':
        return jsonResponse({ success: false, error: 'receipt action not implemented yet' }, 501)
      default:
        return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400)
    }

    return jsonResponse({ success: true, data })
  } catch (err) {
    console.error('ai-proxy error:', err)
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
