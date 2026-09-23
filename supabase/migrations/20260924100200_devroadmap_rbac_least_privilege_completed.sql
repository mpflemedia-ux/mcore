-- Mark RBAC least-privilege work completed on dev roadmap (idempotent upsert by title key)
DO $$
DECLARE
  tid uuid;
  item_id uuid;
  title_en text := 'RBAC least-privilege (roles & permissions)';
  title_bm text := 'RBAC least-privilege (peranan & kebenaran)';
  desc_en text := 'Fixed child→parent elevation, vouchers not implied by accounting, filtered accounting/sales tabs, Expense Claims child nav, delete Owner/Admin-only for CRM/invoices/quotations, SQL has_module + DEFINER harden. Bake workflow patches index.html on main. PR: see git history fix/rbac-least-privilege.';
BEGIN
  -- Prefer platform home tenant if present; else first active tenant (roadmap is often platform-scoped)
  SELECT id INTO tid FROM public.tenants
  WHERE deleted_at IS NULL AND coalesce(is_active, true) = true
  ORDER BY CASE WHEN lower(coalesce(code,'')) IN ('mp','mpworkspace','platform') THEN 0 ELSE 1 END, created_at NULLS LAST
  LIMIT 1;

  IF tid IS NULL THEN
    RAISE NOTICE 'dev_roadmap: no tenant; skip';
    RETURN;
  END IF;

  IF to_regclass('public.dev_roadmap_items') IS NULL THEN
    RAISE NOTICE 'dev_roadmap_items missing; skip';
    RETURN;
  END IF;

  SELECT id INTO item_id FROM public.dev_roadmap_items
  WHERE tenant_id = tid
    AND deleted_at IS NULL
    AND (
      title ILIKE '%RBAC least-privilege%'
      OR title ILIKE '%roles & permissions%'
      OR title ILIKE '%role permissions fix%'
    )
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF item_id IS NOT NULL THEN
    UPDATE public.dev_roadmap_items SET
      status = 'completed',
      description = coalesce(nullif(trim(description), ''), desc_en),
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
    WHERE id = item_id;
  ELSE
    INSERT INTO public.dev_roadmap_items (
      tenant_id, title, description, status, priority, completed_at, created_at, updated_at
    ) VALUES (
      tid, title_en, desc_en, 'completed', 'high', now(), now(), now()
    );
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip auto-complete: %', SQLERRM;
END $$;
