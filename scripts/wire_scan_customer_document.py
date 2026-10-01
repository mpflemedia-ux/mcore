#!/usr/bin/env python3
from pathlib import Path
import re
p = Path('supabase/functions/ai-proxy/index.ts')
s = p.read_text(encoding='utf-8')
FN = r'''async function handleScanCustomerDocument(body: Record<string, unknown>) {
  const imageUrls = buildImageUrls(body)
  const visionModel = Deno.env.get('GROQ_VISION_MODEL') || DEFAULT_VISION_MODEL

  const systemPrompt =
    'Extract customer/contact details from this image for a Malaysian SME CRM form. ' +
    'The image may be: (1) a business/name card, (2) a social profile screenshot (TikTok, Instagram, Facebook, WhatsApp, Google Maps, website About), ' +
    '(3) a Malaysian SSM certificate / Form 9 / Borang D / business registration, or (4) any photo/PDF page with person or company contact info. ' +
    'Return ONLY a JSON object, no other text, with EXACTLY these keys: ' +
    '{"name": "<person or company/business display name>", ' +
    '"email": "<email address>", ' +
    '"phone": "<phone number, keep original format shown>", ' +
    '"address": "<street address or location line(s); for social bios use location lines>", ' +
    '"city": "<city if identifiable>", ' +
    '"postcode": "<postal code if identifiable>", ' +
    '"state": "<Malaysian state if identifiable — eg \'W.P. Kuala Lumpur\', \'Selangor\', \'Johor\'>", ' +
    '"notes": "<extras that do not fit other fields: website URL, @handle, job title, operating hours, SSM registration no., bio slogan — concise, newline-separated>"}. ' +
    'Rules: Prefer company/business name over an individual when both appear on a business profile. ' +
    'For SSM certificates: name = registered company/business name; put registration number (and incorporation date if present) in notes as "SSM: <no>" (and "Incorporated: YYYY-MM-DD" if shown). ' +
    'For social screenshots: name = profile display name; put @handle, hours, and leftover bio lines in notes; map clear location mentions into address/city/state ' +
    '(eg "KL" / "Kuala Lumpur" → city "Kuala Lumpur", state "W.P. Kuala Lumpur"). ' +
    'Use null for any field not clearly legible in the image — do not guess.'

  let raw: string
  try {
    raw = await callGroq(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the customer/contact details from this image for CRM autofill.' },
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
    notes: str(parsed.notes),
  }
}

'''
CASE = """      case 'scan_customer_document':
        data = await handleScanCustomerDocument(body)
        break
"""
# Replace existing handler if present
pat = re.compile(
    r"async function handleScanCustomerDocument\(body: Record<string, unknown>\) \{[\s\S]*?\n\}\n\n",
    re.M,
)
if pat.search(s):
    s2, n = pat.subn(FN, s, count=1)
    if n != 1:
        raise SystemExit(f'replace count {n}')
    s = s2
    print('replaced handleScanCustomerDocument')
elif "async function handleScanCustomerDocument(body: Record<string, unknown>)" not in s:
    marker = 'async function handleScanBankStatement'
    if marker not in s:
        raise SystemExit('handleScanBankStatement not found')
    s = s.replace(marker, FN + marker, 1)
    print('inserted handleScanCustomerDocument')
else:
    print('handler present but pattern miss — abort')
    raise SystemExit(2)
if "case 'scan_customer_document'" not in s:
    marker = """      case 'scan_bank_statement':
        data = await handleScanBankStatement(body)
        break"""
    if marker not in s:
        raise SystemExit('scan_bank_statement case not found')
    s = s.replace(marker, marker + '\n' + CASE, 1)
    print('inserted case')
p.write_text(s, encoding='utf-8')
print('wired', p.stat().st_size)
