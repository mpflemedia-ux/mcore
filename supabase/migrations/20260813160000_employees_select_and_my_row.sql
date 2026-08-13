-- Staff must read employees in their tenant (attendance self-select)
-- and resolve "my" employee row by auth email / profile name.

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employees_select_own_tenant ON public.employees;
CREATE POLICY employees_select_own_tenant ON public.employees
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
  );

-- Optional: allow tenant members to update/insert only if policies missing
-- (do not drop existing tighter policies for write)

CREATE OR REPLACE FUNCTION public.my_employee_row()
RETURNS SETOF public.employees
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.*
  FROM public.employees e
  WHERE e.deleted_at IS NULL
    AND e.tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    AND (
      (
        e.email IS NOT NULL
        AND length(trim(e.email)) > 0
        AND lower(trim(e.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      )
      OR (
        e.name IS NOT NULL
        AND lower(trim(e.name)) = lower(trim(coalesce(
          (SELECT full_name FROM public.user_profiles WHERE id = auth.uid()),
          ''
        )))
      )
    )
  ORDER BY e.updated_at DESC NULLS LAST, e.created_at DESC NULLS LAST
  LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.my_employee_row() TO authenticated;
