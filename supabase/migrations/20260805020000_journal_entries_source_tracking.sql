-- Adds a generic source reference to journal_entries so any auto-posting
-- code path (live transaction posting or the historical backfill script)
-- can check "has a journal already been posted for this record?" with an
-- exact, unambiguous lookup — instead of matching on the free-text
-- description, which collides for payroll (every employee in the same
-- run currently shares the identical "Payroll MM/YYYY" description) and is
-- fragile in general.
--
-- source_table/source_id point back at the record that caused the posting
-- (e.g. source_table='invoices', source_id=<that invoice's id>). Nullable —
-- entries posted before this existed, or any future manual/adjusting
-- journal entry with no single source record, simply leave these null.

alter table journal_entries add column if not exists source_table text;
alter table journal_entries add column if not exists source_id uuid;

create index if not exists journal_entries_source_idx on journal_entries(tenant_id, source_table, source_id);
