// M-Core sd-agent — RETIRED (Nov 2026). The external SR Agent (scheduled Claude task) was removed at the owner's request.
// This stub stays deployed so the old endpoint and its x-agent-secret no longer do anything: every call gets 410 Gone.
// Service Desk itself is unchanged; staff handle Service Requests manually.
Deno.serve(() => new Response(JSON.stringify({ ok: false, error: 'sd-agent retired' }), { status: 410, headers: { 'Content-Type': 'application/json' } }));
