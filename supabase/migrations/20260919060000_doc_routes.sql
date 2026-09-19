-- Documents router log. App gate + RLS: mikepaulfreelancer@gmail.com only.
CREATE TABLE IF NOT EXISTS public.doc_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  created_by uuid,
  created_email text,
  original_name text,
  suggested_folder text,
  suggested_name text,
  final_folder text,
  final_name text,
  status text NOT NULL DEFAULT 'filed',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.doc_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS doc_routes_owner_only ON public.doc_routes;
CREATE POLICY doc_routes_owner_only ON public.doc_routes
  FOR ALL TO authenticated
  USING (lower(coalesce(auth.jwt()->>'email','')) = 'mikepaulfreelancer@gmail.com')
  WITH CHECK (lower(coalesce(auth.jwt()->>'email','')) = 'mikepaulfreelancer@gmail.com');
