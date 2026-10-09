-- Brozky Empire: KWSP Jumadil, RM 2864.00 over 3 months from Oct 2026.
-- 954.67 + 954.67 + 954.66 = 2864.00. Draft only.
INSERT INTO public.payment_vouchers (
  tenant_id, ref_no, voucher_date, payee_name, amount, payment_method, description, status, created_at, updated_at
)
SELECT t.id, v.ref_no, v.voucher_date::date, 'KWSP', v.amount, 'bank', v.description, 'draft', now(), now()
FROM public.tenants t
JOIN (
VALUES
  ('PV-20261009-KWSP1', '2026-10-09', 954.67, 'KWSP Jumadil — ansuran 1/3. Jumlah RM 2,864.00 dibahagi Okt, Nov, Dis 2026. Baucar ini RM 954.67.'),
  ('PV-20261109-KWSP2', '2026-11-09', 954.67, 'KWSP Jumadil — ansuran 2/3. Jumlah RM 2,864.00 dibahagi Okt, Nov, Dis 2026. Baucar ini RM 954.67.'),
  ('PV-20261209-KWSP3', '2026-12-09', 954.66, 'KWSP Jumadil — ansuran 3/3. Jumlah RM 2,864.00 dibahagi Okt, Nov, Dis 2026. Baucar ini RM 954.66. Baki selesai.')
) AS v(ref_no, voucher_date, amount, description) ON true
WHERE t.deleted_at IS NULL
  AND (t.code = 'BROZKY99' OR t.name ILIKE '%br%zky%empire%')
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_vouchers p
    WHERE p.tenant_id = t.id AND p.ref_no = v.ref_no AND p.deleted_at IS NULL
  );
