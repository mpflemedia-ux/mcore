-- Sample Sales Academy data for active Phion Sdn. Bhd. only.
-- Uses existing customers. Does not insert customers.

WITH tn AS (
  SELECT id
  FROM public.tenants
  WHERE name = 'Phion Sdn. Bhd.'
    AND deleted_at IS NULL
    AND COALESCE(is_active, true) = true
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1
), picked AS (
  SELECT c.id, row_number() OVER (ORDER BY c.created_at) AS n
  FROM public.customers c
  JOIN tn ON tn.id = c.tenant_id
  WHERE c.deleted_at IS NULL
  ORDER BY c.created_at
  LIMIT 5
), staged AS (
  SELECT id,
    CASE n WHEN 1 THEN 'contacted' WHEN 2 THEN 'discovery' WHEN 3 THEN 'proposal' WHEN 4 THEN 'verbal' ELSE 'signed' END AS stage,
    CASE n WHEN 1 THEN current_date - 2 WHEN 2 THEN current_date + 3 WHEN 3 THEN current_date + 1 WHEN 4 THEN current_date + 7 ELSE NULL END AS follow_up
  FROM picked
)
UPDATE public.customers c
SET pipeline_stage = s.stage,
    next_follow_up_at = s.follow_up
FROM staged s
WHERE c.id = s.id;

WITH tn AS (
  SELECT id FROM public.tenants
  WHERE name = 'Phion Sdn. Bhd.' AND deleted_at IS NULL AND COALESCE(is_active, true) = true
  ORDER BY updated_at DESC NULLS LAST LIMIT 1
)
DELETE FROM public.crm_activities a
USING tn
WHERE a.tenant_id = tn.id AND a.notes LIKE 'SA-SAMPLE%';

WITH tn AS (
  SELECT id FROM public.tenants
  WHERE name = 'Phion Sdn. Bhd.' AND deleted_at IS NULL AND COALESCE(is_active, true) = true
  ORDER BY updated_at DESC NULLS LAST LIMIT 1
), who AS (
  SELECT p.id FROM public.user_profiles p
  JOIN tn ON tn.id = p.tenant_id
  LIMIT 1
), picked AS (
  SELECT c.id, c.pipeline_stage
  FROM public.customers c
  JOIN tn ON tn.id = c.tenant_id
  WHERE c.deleted_at IS NULL AND c.pipeline_stage IS NOT NULL
  ORDER BY c.created_at
  LIMIT 5
)
INSERT INTO public.crm_activities (tenant_id, record_id, type, notes, occurred_at, user_id, created_by)
SELECT tn.id, p.id,
  CASE p.pipeline_stage WHEN 'contacted' THEN 'call' WHEN 'discovery' THEN 'whatsapp' WHEN 'proposal' THEN 'meeting' ELSE 'note' END,
  'SA-SAMPLE ' || p.pipeline_stage,
  now(), who.id, who.id
FROM picked p
CROSS JOIN tn
LEFT JOIN who ON true;

WITH tn AS (
  SELECT id FROM public.tenants
  WHERE name = 'Phion Sdn. Bhd.' AND deleted_at IS NULL AND COALESCE(is_active, true) = true
  ORDER BY updated_at DESC NULLS LAST LIMIT 1
), who AS (
  SELECT p.id FROM public.user_profiles p JOIN tn ON tn.id = p.tenant_id LIMIT 1
), picked AS (
  SELECT c.id, c.pipeline_stage
  FROM public.customers c JOIN tn ON tn.id = c.tenant_id
  WHERE c.deleted_at IS NULL AND c.pipeline_stage IS NOT NULL
  ORDER BY c.created_at LIMIT 5
)
INSERT INTO public.crm_stage_history (tenant_id, record_id, from_stage, to_stage, changed_by, changed_at, created_by)
SELECT tn.id, p.id, NULL, p.pipeline_stage, who.id, now(), who.id
FROM picked p
CROSS JOIN tn
LEFT JOIN who ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_stage_history h
  WHERE h.record_id = p.id AND h.to_stage = p.pipeline_stage AND h.deleted_at IS NULL
);

WITH tn AS (
  SELECT id FROM public.tenants
  WHERE name = 'Phion Sdn. Bhd.' AND deleted_at IS NULL AND COALESCE(is_active, true) = true
  ORDER BY updated_at DESC NULLS LAST LIMIT 1
)
INSERT INTO public.academy_missions (tenant_id, day, sort, xp, title_en, title_bm, desc_en, desc_bm)
SELECT tn.id, v.day, v.sort, v.xp, v.title_en, v.title_bm, v.desc_en, v.desc_bm
FROM tn
CROSS JOIN (VALUES
  (1,1,40,'List 10 prospects','Senarai 10 prospek','Add prospects with a follow-up date.','Tambah prospek dengan tarikh susulan.'),
  (1,2,40,'Open 5 conversations','Buka 5 perbualan','Log 5 call or WhatsApp activities.','Log 5 panggilan atau WhatsApp.'),
  (1,3,30,'Book 2 discovery slots','Tempah 2 slot discovery','Set a follow-up on 2 prospects.','Tetapkan susulan pada 2 prospek.'),
  (2,1,50,'Complete 2 discoveries','Selesaikan 2 discovery','Move 2 prospects to Discovery.','Alih 2 prospek ke Discovery.'),
  (2,2,50,'Send 1 proposal','Hantar 1 cadangan','Move 1 prospect to Proposal.','Alih 1 prospek ke Cadangan.'),
  (2,3,40,'Note the need','Catat keperluan','Log a note on the proposal prospect.','Log nota pada prospek cadangan.'),
  (3,1,40,'Follow up the proposal','Susul cadangan','Log a follow-up on a proposal.','Log susulan pada cadangan.'),
  (3,2,60,'Confirm next step','Sahkan langkah seterusnya','Move 1 prospect to Verbal.','Alih 1 prospek ke Lisan.'),
  (3,3,80,'Onboard a signed client','Onboard pelanggan ditandatangani','Move 1 prospect to Signed.','Alih 1 prospek ke Ditandatangani.')
) AS v(day, sort, xp, title_en, title_bm, desc_en, desc_bm)
WHERE NOT EXISTS (
  SELECT 1 FROM public.academy_missions m WHERE m.tenant_id = tn.id AND m.deleted_at IS NULL
);

WITH tn AS (
  SELECT id FROM public.tenants
  WHERE name = 'Phion Sdn. Bhd.' AND deleted_at IS NULL AND COALESCE(is_active, true) = true
  ORDER BY updated_at DESC NULLS LAST LIMIT 1
)
INSERT INTO public.academy_modules (tenant_id, sort, title_en, title_bm, content_en, content_bm, before_en, before_bm, after_en, after_bm)
SELECT tn.id, v.sort, v.title_en, v.title_bm, v.content_en, v.content_bm, v.before_en, v.before_bm, v.after_en, v.after_bm
FROM tn
CROSS JOIN (VALUES
  (1,'Prospecting','Mencari prospek','Open with a useful reason.','Buka dengan sebab yang berguna.','We sell everything.','Kami jual semua.','I saw your outlet restocking weekly.','Saya nampak cawangan anda restock setiap minggu.'),
  (2,'Discovery questions','Soalan discovery','Ask about the current process.','Tanya proses semasa.','Should I send the package?','Nak saya hantar pakej?','What breaks when the supplier is late?','Apa yang tergendala bila pembekal lewat?'),
  (3,'Presenting a proposal','Bentang cadangan','Tie the offer to the need.','Ikat tawaran pada keperluan.','Here is the brochure.','Ini brosur.','You said late delivery costs a shift.','Anda kata penghantaran lewat rugi satu syif.'),
  (4,'Handling objections','Mengurus bantahan','Acknowledge, then compare.','Akui, kemudian bandingkan.','It is not expensive.','Ia tidak mahal.','Which part feels high against the late-delivery cost?','Bahagian mana terasa tinggi berbanding kos lewat?'),
  (5,'Closing and onboarding','Tutup dan onboard','Confirm the next step.','Sahkan langkah seterusnya.','Let me know.','Beritahu kemudian.','I send confirmation today. You approve by Friday.','Saya hantar pengesahan hari ini. Anda luluskan sebelum Jumaat.')
) AS v(sort, title_en, title_bm, content_en, content_bm, before_en, before_bm, after_en, after_bm)
WHERE NOT EXISTS (
  SELECT 1 FROM public.academy_modules m WHERE m.tenant_id = tn.id AND m.deleted_at IS NULL
);

UPDATE public.tenants
SET config = COALESCE(config, '{}'::jsonb) || '{"academy_signed_target": 5}'::jsonb
WHERE name = 'Phion Sdn. Bhd.' AND deleted_at IS NULL AND COALESCE(is_active, true) = true;

SELECT c.name, c.pipeline_stage, c.next_follow_up_at
FROM public.customers c
JOIN public.tenants t ON t.id = c.tenant_id
WHERE t.name = 'Phion Sdn. Bhd.' AND t.deleted_at IS NULL
  AND c.deleted_at IS NULL AND c.pipeline_stage IS NOT NULL
ORDER BY c.created_at
LIMIT 5;
