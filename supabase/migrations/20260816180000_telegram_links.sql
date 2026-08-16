-- Telegram links (user / customer / supplier) — all tenants
CREATE TABLE IF NOT EXISTS public.telegram_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('user','customer','supplier')),
  subject_id uuid NOT NULL,
  chat_id text NOT NULL,
  username text,
  linked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, subject_type, subject_id)
);
CREATE INDEX IF NOT EXISTS telegram_links_tenant_idx ON public.telegram_links(tenant_id);

CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  code text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('user','customer','supplier')),
  subject_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

-- Authenticated users: own tenant only
DROP POLICY IF EXISTS telegram_links_select ON public.telegram_links;
DROP POLICY IF EXISTS telegram_links_all ON public.telegram_links;
CREATE POLICY telegram_links_all ON public.telegram_links FOR ALL TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS telegram_link_codes_all ON public.telegram_link_codes;
CREATE POLICY telegram_link_codes_all ON public.telegram_link_codes FOR ALL TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1));
