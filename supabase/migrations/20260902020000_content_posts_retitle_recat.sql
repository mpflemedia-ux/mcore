-- Recategorise + retitle content_posts to match actual TikTok captions.
-- Then drop empty published TikTok drafts (no video id, no URL, no views).
-- Live prune of "not on TikTok anymore" happens in tiktok-sync when video.list > 0.
-- Safe to re-run.

-- 1) Map known captions / old planner titles → correct title + category
UPDATE public.content_posts SET title = 'Dalam kepala — lejar merapu', category = 'pain_point'
WHERE title ILIKE '%dalam kepala%';

UPDATE public.content_posts SET title = 'Bukan Excel vs M-Core', category = 'comparison'
WHERE title ILIKE '%excel%m-core%' OR title ILIKE '%bukan excel%';

UPDATE public.content_posts SET title = 'Sistem penuh, harga percuma', category = 'other'
WHERE title ILIKE '%sistem penuh%harga percuma%' OR title ILIKE '%free vs%' OR title ILIKE '%percuma vs bayar%';

UPDATE public.content_posts SET title = 'Cara langgan pelan M-Core percuma', category = 'demo'
WHERE title ILIKE '%cara langgan%' OR title ILIKE '%pelan percuma%' OR title ILIKE '%trial 14%';

UPDATE public.content_posts SET title = 'Stok habis, jualan hilang', category = 'pain_point'
WHERE title ILIKE '%stok habis%' OR title ILIKE '%stock vs jualan%' OR title ILIKE '%stock vs%';

UPDATE public.content_posts SET title = 'Owner tak nampak nombor sebenar', category = 'pain_point'
WHERE title ILIKE '%owner tak nampak%' OR title ILIKE '%dashboard nombor%';

UPDATE public.content_posts SET title = '5 app vs 1 workspace', category = 'comparison'
WHERE title ILIKE '%5 app%' OR title ILIKE '%4 app%' OR title ILIKE '%satu nombor%' OR title ILIKE '%1 nombor%';

UPDATE public.content_posts SET title = 'Mulakan kerja dalam M-Core', category = 'demo'
WHERE title ILIKE '%mulakan kerja%' OR title ILIKE '%malaysia, bukan template%' OR title ILIKE '%bukan template%';

UPDATE public.content_posts SET title = 'Bayaran masuk, lejar auto', category = 'demo'
WHERE title ILIKE '%bayaran masuk%' OR title ILIKE '%invoice tak bayar%';

UPDATE public.content_posts SET title = 'Payroll EPF SOCSO PCB', category = 'demo'
WHERE title ILIKE '%payroll%';

UPDATE public.content_posts SET title = 'POS jualan terus kira untung', category = 'demo'
WHERE title ILIKE '%pos %' OR title ILIKE '%pos jualan%';

UPDATE public.content_posts SET title = 'Staff nampak apa owner benarkan', category = 'demo'
WHERE title ILIKE '%staff nampak%' OR title ILIKE '%role%bukan rasa%' OR title ILIKE '%owner nampak, staff%';

UPDATE public.content_posts SET title = 'Cuti umum 2026 dalam planner', category = 'seasonal'
WHERE title ILIKE '%cuti umum%' OR title ILIKE '%bermusim%';

UPDATE public.content_posts SET title = 'Log masuk, nombor terus nampak', category = 'demo'
WHERE title ILIKE '%log masuk%';

UPDATE public.content_posts SET title = 'Tragedi roti habis waktu puncak', category = 'pain_point'
WHERE title ILIKE '%tragedi roti%' OR title ILIKE '%roti habis%' OR title ILIKE '%buku kotak kasut%';

UPDATE public.content_posts SET title = 'Kenapa SSM tak boleh daftar TikTok Seller Center', category = 'pain_point'
WHERE title ILIKE '%ssm%' OR title ILIKE '%seller center%';

UPDATE public.content_posts SET title = 'Penyelesaian lejar merapu', category = 'demo'
WHERE title ILIKE '%penyelesaian lejar%' OR title ILIKE '%spreadsheet malam%';

UPDATE public.content_posts SET title = 'Owner menyesal lewat siap sistem', category = 'pain_point'
WHERE title ILIKE '%owner menyesal%' OR title ILIKE '%whatsapp%ticket%';

-- 2) Leftover category keys (usp_*, pricing, product, bermusim) → the 5 UI buckets
UPDATE public.content_posts SET category = 'seasonal'
WHERE lower(coalesce(category,'')) IN ('bermusim','season','holiday');

UPDATE public.content_posts SET category = 'pain_point'
WHERE lower(coalesce(category,'')) IN ('pain','painpoint','usp_pain');

UPDATE public.content_posts SET category = 'comparison'
WHERE lower(coalesce(category,'')) IN ('usp_one_workspace','one_workspace');

UPDATE public.content_posts SET category = 'demo'
WHERE lower(coalesce(category,'')) IN ('usp_malaysia','usp_owner','product','pricing','feature');

UPDATE public.content_posts SET category = 'other'
WHERE category IS NULL OR btrim(category) = ''
   OR lower(category) NOT IN ('demo','pain_point','comparison','seasonal','other');

-- 3) Buang draf published kosong (bukan video TikTok sebenar)
DELETE FROM public.content_posts
WHERE lower(coalesce(platform,'tiktok')) = 'tiktok'
  AND lower(coalesce(status,'')) = 'published'
  AND tiktok_video_id IS NULL
  AND coalesce(post_url,'') = ''
  AND coalesce(views,0) = 0
  AND coalesce(likes,0) = 0;
