-- Change password (Settings → My Account) — roadmap only.
-- WRITE-ONLY: run in Supabase SQL Editor as postgres. Rerun-safe. No schema changes.
-- App change is Auth-only (sb.auth.signInWithPassword + updateUser); no DB migration.

insert into public.dev_roadmap_items (title, description, module, stage)
select 'Change password (Settings → My Account)',
  'Logged-in Change Password under Settings → Akaun Saya / My Account. Current + new + confirm; re-auth with signInWithPassword then updateUser; EN/BM; togglePw; min 8. Forgot/reset OTP unchanged.',
  'core', 'completed'
where not exists (select 1 from public.dev_roadmap_items where title = 'Change password (Settings → My Account)');

update public.dev_roadmap_items set stage = 'completed', module = 'core',
  description = 'Logged-in Change Password under Settings → Akaun Saya / My Account. Current + new + confirm; re-auth with signInWithPassword then updateUser; EN/BM; togglePw; min 8. Forgot/reset OTP unchanged.'
where title = 'Change password (Settings → My Account)' and stage is distinct from 'completed';

select title, stage, module from public.dev_roadmap_items where title = 'Change password (Settings → My Account)';
