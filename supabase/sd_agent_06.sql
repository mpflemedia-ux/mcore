reset role;

-- SR Agent Backend -- Fasa 4 hotfix. sd_agent_04.sql's catch-all (step 6: every remaining
-- service_desk/service_requests row with kind null -> kind='for_you') missed the one special
-- case notif-core.js NT.classify() itself carves out: a title matching /pindaan|revision/i gets
-- kind='action' there, regardless of which code path wrote the row. Caught by querying the live
-- data after running sd_agent_04.sql -- 2 rows from the sd-result public "client requested
-- revision" flow (title "...: revision requested (Minta pindaan)", a different wording than
-- SD.setStatus's "...: Revision"/"Revisi" that sd_agent_04.sql's steps 3/4 already matched) came
-- out for_you instead of action. Idempotent; safe to run even if already correct.

update public.notifications set kind = 'action'
where category = 'service_desk' and ref_table = 'service_requests' and kind <> 'action'
  and title ~* 'pindaan|revision';
