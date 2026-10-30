# sd-agent

Locked backend for the external SR-processing agent (a scheduled Claude task that reads new
Service Requests, drafts documents, and asks clients for missing info). The agent never touches
Supabase storage or the database directly — every action goes through this Edge Function,
authenticated by a shared secret header (`x-agent-secret`), checked against `SD_AGENT_SECRET` or
`SD_AGENT_SECRET_NEXT` (set `_NEXT` to rotate the secret without downtime, then promote it and
clear `_NEXT`).

Deploy with `--no-verify-jwt` — auth is this function's own secret check, not a Supabase user JWT.

Every call is logged to `sd_agent_runs` (`action`, `status: ok|error|skipped`, `detail` jsonb),
visible to platform admins at **Admin → Service Desk → Agent**.

## Actions

All requests are `POST` with `Content-Type: application/json` and header `x-agent-secret: <secret>`.

### `queue`

List Service Requests that need the agent's attention: status in `submitted|triaged|in_progress|revision`,
agent enabled for that tenant+service, and (no AI draft yet, or the client replied since the
agent's last message, or status is `revision`).

```json
// request
{"action":"queue"}
// response
{"ok":true,"items":[{
  "id":"...", "tenant_id":"...", "tenant_name":"Atas Angin My Sdn Bhd", "tenant_code":"ATASAN12",
  "ref_no":"SR-ATASAN12-202611-0001", "title":"...", "description":"...", "form_data":{"letter_type":"Confirmation letter"},
  "service_code":"letters", "priority":"normal", "status":"submitted", "due_at":"2026-11-03T08:00:00Z",
  "events":[{"id":"...","type":"comment","body":"...","meta":{},"by_agent":false,"created_at":"..."}],
  "attachments":[{"event_id":"...","name":"reference.pdf","path":"<tenant>/service-requests/<id>/...","deliverable":false}]
}]}
```

### `file_url` — signed URL for an attachment

```json
{"action":"file_url","request_id":"...","path":"<tenant>/service-requests/<id>/169...-file.pdf"}
// {"ok":true,"url":"https://...signed..."}
```

### `letterhead_url` — signed URL for the tenant's letterhead PDF

```json
{"action":"letterhead_url","tenant_id":"..."}
// {"ok":true,"url":"..."}  or  {"ok":true,"missing":true}
```

### `ask_client` — move the request to waiting_client with a question

Walks the status chain (e.g. `submitted → triaged → in_progress → waiting_client`), one hop at a
time, exactly mirroring what repeated clicks of the app's own status buttons would do (same
optimistic lock, same SLA-pause bookkeeping). Rejected if the agent already asked and the client
hasn't replied since (one outstanding question at a time).

```json
{"action":"ask_client","request_id":"...","body":"Could you confirm the recipient's full name?"}
// {"ok":true,"status":"waiting_client"}  or  {"ok":false,"error":"awaiting_reply"}
```

### `resume` — waiting_client → in_progress

```json
{"action":"resume","request_id":"..."}
// {"ok":true,"status":"in_progress"}
```

### `upload_draft` — save a draft PDF as an internal (staff-only) note

```json
{"action":"upload_draft","request_id":"...","filename":"draft-v1.pdf","base64":"JVBERi0x...","summary":"Draft confirmation letter, v1"}
// {"ok":true,"version":1,"path":"<tenant>/service-requests/<id>/169...-draft-v1.pdf"}
```

Rejected with `{"ok":false,"error":"not_pdf"}` / `"too_large"` if the decoded bytes aren't a PDF
(`%PDF-` magic header) or exceed 25 MB.

### `next_ref` — a numbered document reference (for letters etc. the agent drafts)

```json
{"action":"next_ref","tenant_id":"...","key":"letters"}
// {"ok":true,"seq":3,"ref":"LETTERS/2026/003"}
```

Sequence resets each year per `(tenant_id, key)` (`doc_counters.counter_key` = `"<key>:<year>"`).

### `note` — a plain internal note (no status change)

```json
{"action":"note","request_id":"...","body":"Checked against KWSP portal, matches."}
// {"ok":true}
```

### `log` — free-form diagnostic entry

```json
{"action":"log","request_id":"...","action":"ocr_attempt","status":"skipped","detail":{"reason":"low_confidence"}}
// {"ok":true}
```

## Errors

`401 {"ok":false,"error":"secret"}` — missing/wrong `x-agent-secret`.
`400 {"ok":false,"error":"unknown_action"}` — bad `action`.
`500 {"ok":false,"error":"<message>"}` — unexpected failure (also logged to `sd_agent_runs`).
