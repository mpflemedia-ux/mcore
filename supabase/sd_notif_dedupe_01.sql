-- SD notification dedupe (sd.status / sd.message spam). WRITE ONLY — Mike runs in Supabase SQL Editor (one transaction).
-- Idempotent: safe to run twice. Guarded by to_regclass. ref_id type-agnostic (live = uuid): every compare is ::text = ::text.
--
-- Root cause (client inserts, no DB trigger was writing these):
--  a) app/sd-pa.js SD.escalate() ran on EVERY openPage('admin') by a platform_admin (no once-per-day guard, unlike
--     SD.digest). Each run: up to 20 SRs >4h old × (every platform_admin + tenant owner) → new 'sd.status' row each time.
--  b) SD.setStatus → SD.bellFor inserted 1 row per recipient per status step (multi-step moves = several rows), never
--     merged with the still-unread previous row for the same SR.
--  c) Group thread message (sd-multi-data.js) went in as type 'sd.status' (client) / 'sd.new' kind=action (PA side
--     default), ref_id null → never grouped.
-- Fix (same mechanism for every writer: app bellFor/bellNew, sd-result/sd-agent edge functions):
--  BEFORE INSERT trigger on notifications for type sd.status / sd.message:
--   group_key = type||':'||ref_id (or 'sd.message:<group id>' from the client). Skip the actor (user_id = actor/auth.uid()).
--   If the recipient already has an UNREAD row with that group_key (sd.status: any age; sd.message: last 10 min)
--   → UPDATE that row (title/body/kind/priority/link, created_at = now()) and drop the insert (1 event = 1 row per user).
--   Bump is only done when the caller could have written that row anyway (service role, platform_admin, or caller's
--   tenant owns the SR/group and recipient is same tenant or a platform_admin) — otherwise plain insert, RLS decides.
--  Push: a dropped insert fires no INSERT webhook/realtime → no re-push. push-send flush() dedupes on push_log 'n:<id>',
--   so a bumped row that was already pushed is never pushed again (one never pushed may be pushed once by flush).

-- ---------- 1) one-off: re-type group-thread messages that were stored as sd.status / sd.new ----------
do $$ begin
  if to_regclass('public.notifications') is null then raise notice 'notifications missing — skip'; return; end if;
  update public.notifications set type = 'sd.message', kind = 'for_you'
  where category = 'service_desk' and ref_id is null and type in ('sd.status', 'sd.new')
    and (title like '%: new message' or title like '%: mesej baharu');
end $$;

-- ---------- 2) one-off: keep only the newest UNREAD per (user_id, ref_id, type); older duplicates → read ----------
do $$ begin
  if to_regclass('public.notifications') is null then return; end if;
  with r as (
    select id, row_number() over (
             partition by user_id, type, coalesce(ref_id::text, 'g:' || split_part(title, ':', 1))
             order by created_at desc, id::text desc) as rn
    from public.notifications
    where type in ('sd.status', 'sd.message') and read_at is null and deleted_at is null
      and (ref_id is not null or title like '%: new message' or title like '%: mesej baharu'))
  update public.notifications n set read_at = now()
  from r where r.id = n.id and r.rn > 1;
  -- kept unread rows get the group_key the trigger matches on
  update public.notifications set group_key = type || ':' || ref_id::text
  where type in ('sd.status', 'sd.message') and ref_id is not null and read_at is null and deleted_at is null
    and group_key is distinct from (type || ':' || ref_id::text);
end $$;

-- ---------- 3) coalesce trigger ----------
create or replace function public.sd_notif_coalesce() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_gk text; v_uid uuid; v_actor uuid; v_id uuid; v_ok boolean := false;
  v_ctid uuid; v_crole text; v_otid uuid; v_rpa boolean;
begin
  if NEW.type is null or NEW.type not in ('sd.status', 'sd.message') then return NEW; end if;
  v_gk := case when NEW.ref_id is not null then NEW.type || ':' || NEW.ref_id::text
               when NEW.group_key like NEW.type || ':%' then NEW.group_key end;
  if v_gk is not null then NEW.group_key := v_gk; end if;
  begin v_uid := auth.uid(); exception when others then v_uid := null; end;
  v_actor := coalesce(NEW.actor_id, v_uid);
  if v_actor is not null and NEW.user_id::text = v_actor::text then return null; end if;   -- never notify the actor
  if v_gk is null or NEW.user_id is null then return NEW; end if;

  -- may this caller touch the recipient's row? (mirror of who could insert it)
  if v_uid is null then v_ok := true;                                                      -- service role / edge fn
  else
    select p.tenant_id, lower(coalesce(p.role, '')) into v_ctid, v_crole from public.user_profiles p where p.id = v_uid;
    if v_crole = 'platform_admin' then v_ok := true;
    else
      if NEW.ref_id is not null and to_regclass('public.service_requests') is not null then
        execute 'select tenant_id from public.service_requests where id::text = $1' into v_otid using NEW.ref_id::text;
      elsif to_regclass('public.service_request_groups') is not null then
        execute 'select tenant_id from public.service_request_groups where id::text = $1' into v_otid using split_part(v_gk, ':', 2);
      end if;
      select exists (select 1 from public.user_profiles u where u.id = NEW.user_id and lower(coalesce(u.role, '')) = 'platform_admin') into v_rpa;
      v_ok := v_ctid is not null and v_otid is not null and v_ctid::text = v_otid::text
              and (v_rpa or NEW.tenant_id::text = v_ctid::text);
    end if;
  end if;
  if not v_ok then return NEW; end if;

  select x.id into v_id from public.notifications x
  where x.user_id = NEW.user_id and x.tenant_id is not distinct from NEW.tenant_id
    and x.group_key = v_gk and x.read_at is null and x.deleted_at is null
    and (NEW.type = 'sd.status' or x.created_at > now() - interval '10 minutes')
  order by x.created_at desc limit 1 for update;
  if v_id is null then return NEW; end if;

  update public.notifications set
    title = NEW.title, body = NEW.body, kind = coalesce(NEW.kind, kind),
    priority = greatest(coalesce(priority, 0), coalesce(NEW.priority, 0)),
    link = coalesce(NEW.link, link), actor_id = coalesce(NEW.actor_id, actor_id), created_at = now()
  where id = v_id;
  return null;                                                                             -- bumped, no new row
end $$;
revoke all on function public.sd_notif_coalesce() from public;

do $$ begin
  if to_regclass('public.notifications') is null then return; end if;
  execute 'drop trigger if exists sd_notif_coalesce_bi on public.notifications';
  execute $t$create trigger sd_notif_coalesce_bi before insert on public.notifications
           for each row when (NEW.type in ('sd.status', 'sd.message')) execute function public.sd_notif_coalesce()$t$;
  execute 'create index if not exists notifications_unread_gk_idx on public.notifications (user_id, group_key)
           where read_at is null and deleted_at is null';
end $$;

-- ---------- 4) roadmap ----------
do $$ begin
  if to_regclass('public.dev_roadmap_items') is null then return; end if;
  update public.dev_roadmap_items set stage = 'completed', module = 'service_desk',
    description = 'sd.status/sd.message spam: 1 event = 1 notif per recipient. BEFORE INSERT trigger bumps the unread row (group_key type:sr_id) instead of inserting, skips actor; escalation once per SR per stage per day; group thread messages typed sd.message; one-off mark-read of duplicate unread rows.'
  where title = 'SD notification dedupe';
  insert into public.dev_roadmap_items (title, description, module, stage)
  select 'SD notification dedupe',
    'sd.status/sd.message spam: 1 event = 1 notif per recipient. BEFORE INSERT trigger bumps the unread row (group_key type:sr_id) instead of inserting, skips actor; escalation once per SR per stage per day; group thread messages typed sd.message; one-off mark-read of duplicate unread rows.',
    'service_desk', 'completed'
  where not exists (select 1 from public.dev_roadmap_items where title = 'SD notification dedupe');
end $$;
