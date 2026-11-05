# Local-only migrations (not pushed to the public repo)

Gitignored. Put write-only SQL here instead of `supabase/migrations/` whenever the
file names a real person together with their personal financial specifics — a staff
settlement/repayment schedule, an individual's exact owed/paid amounts, bank details,
IC, etc. (schema/function SQL — `CREATE OR REPLACE FUNCTION`, `ALTER TABLE`, indexes —
has no personal data and keeps going in the normal tracked `supabase/migrations/`).

Mike still gets the file (it's on disk, sent in chat) and runs it the same way in the
Supabase SQL Editor — it just never reaches the public GitHub repo.
