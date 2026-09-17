/** Wire into index.ts switch:
 *   case 'scan_customer_document':
 *     data = await handleScanCustomerDocument(body)
 *     break
 */
export async function handleScanCustomerDocument(
  body: Record<string, unknown>,
  deps: {
    buildImageUrls: (body: Record<string, unknown>) => string[]
    callGroq: (messages: { role: string; content: unknown }[], model: string, extra?: Record<string, unknown>) => Promise<string>
    visionModel: string
  },
) {
  const imageUrls = deps.buildImageUrls(body)
  const systemPrompt =
    'Extract contact details from this image, which may be a business card, name card, ID document, or a screenshot/photo containing a person or company\'s contact info. Return ONLY a JSON object, no other text, with EXACTLY these keys: {"name": "<full name or company name>", "email": "<email address>", "phone": "<phone number, keep original format shown>", "address": "<street address line>", "city": "<city>", "postcode": "<postal code>", "state": "<Malaysian state, if identifiable — eg \'W.P. Kuala Lumpur\', \'Selangor\', \'Johor\'>"}. Use null for any field not clearly legible in the image — do not guess.'
  const raw = await deps.callGroq(
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
    deps.visionModel,
    { response_format: { type: 'json_object' }, max_tokens: 1024 },
  )
  const parsed = JSON.parse(raw) as Record<string, unknown>
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
