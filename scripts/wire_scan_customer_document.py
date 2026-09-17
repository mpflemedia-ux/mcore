#!/usr/bin/env python3
from pathlib import Path
p = Path('supabase/functions/ai-proxy/index.ts')
s = p.read_text(encoding='utf-8')
FN = r'''async function handleScanCustomerDocument(body: Record<string, unknown>) {
  const imageUrls = buildImageUrls(body)
  const visionModel = Deno.env.get('GROQ_VISION_MODEL') || DEFAULT_VISION_MODEL

  const systemPrompt =
    'Extract contact details from this image, which may be a business card, name card, ID document, or a screenshot/photo containing a person or company\'s contact info. Return ONLY a JSON object, no other text, with EXACTLY these keys: {"name": "<full name or company name>", "email": "<email address>", "phone": "<phone number, keep original format shown>", "address": "<street address line>", "city": "<city>", "postcode": "<postal code>", "state": "<Malaysian state, if identifiable — eg \'W.P. Kuala Lumpur\', \'Selangor\', \'Johor\'>"}. Use null for any field not clearly legible in the image — do not guess.'

  let raw: string
  try {
    raw = await callGroq(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the contact details from this image.' },
            ...imageUrls.map((url) => ({ type: 'image_url', image_url: { url } })),
          ],
        },
      ],
      visionModel,
      { response_format: { type: 'json_object' }, max_tokens: 1024 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Customer document vision call failed (model=${visionModel}): ${msg}`)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`AI returned an unparseable response (model=${visionModel}): ${raw.slice(0, 300)}`)
  }

  const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
  return {
    name: str(parsed.name),
    email: str(parsed.email),
    phone: str(parsed.phone),
    address: str(parsed.address),
    city: str(parsed.city),
    postcode: str(parsed.postcode),
    state: str(parsed.state),
  }
}

'''
CASE = """      case 'scan_customer_document':
        data = await handleScanCustomerDocument(body)
        break
"""
if "async function handleScanCustomerDocument(body: Record<string, unknown>)" not in s:
    marker = 'async function handleScanBankStatement'
    if marker not in s:
        raise SystemExit('handleScanBankStatement not found')
    s = s.replace(marker, FN + marker, 1)
if "case 'scan_customer_document'" not in s:
    marker = """      case 'scan_bank_statement':
        data = await handleScanBankStatement(body)
        break"""
    if marker not in s:
        raise SystemExit('scan_bank_statement case not found')
    s = s.replace(marker, marker + '\n' + CASE, 1)
p.write_text(s, encoding='utf-8')
print('wired', p.stat().st_size)
