-- TikTok auto-sync for platform Content Planner.
-- Tokens stay in platform_integrations (service_role only).
-- content_posts.tiktok_video_id matches a live TikTok video so re-sync
-- updates views instead of duplicating rows.

ALTER TABLE public.content_posts
  ADD COLUMN IF NOT EXISTS tiktok_video_id text;

CREATE UNIQUE INDEX IF NOT EXISTS content_posts_tiktok_video_id_uidx
  ON public.content_posts (tiktok_video_id)
  WHERE tiktok_video_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.platform_integrations (
  provider text PRIMARY KEY,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  open_id text,
  display_name text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_integrations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_integrations FROM PUBLIC;
REVOKE ALL ON TABLE public.platform_integrations FROM anon;
REVOKE ALL ON TABLE public.platform_integrations FROM authenticated;
GRANT ALL ON TABLE public.platform_integrations TO service_role;

-- No RLS policies on purpose: anon/authenticated cannot read tokens.
-- Edge function tiktok-sync uses the service role.
