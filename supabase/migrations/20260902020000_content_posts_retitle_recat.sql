-- Recategorise + retitle the 18 manual TikTok rows to match actual content.
-- Does NOT delete rows (live prune happens in tiktok-sync when video.list returns >0).
-- Safe to re-run.

UPDATE public.content_posts SET
  title = 'Dalam kepala — lejar merapu',
  category = 'pain_point'
WHERE title ILIKE '%dalam kepala%lejar merapu%';

UPDATE public.content_posts SET
  title = 'Bukan Excel vs M-Core',
  category = 'comparison'
WHERE title ILIKE '%excel vs m-core%' OR title ILIKE '%bukan excel vs%';

UPDATE public.content_posts SET
  title = 'Sistem penuh, harga percuma',
  category = 'other'
WHERE title ILIKE '%sistem penuh%harga percuma%';

UPDATE public.content_posts SET
  title = 'Cara langgan pelan M-Core percuma',
  category = 'demo'
WHERE title ILIKE '%cara langgan pelan percuma%';

UPDATE public.content_posts SET
  title = 'Stok habis, jualan hilang',
  category = 'pain_point'
WHERE title ILIKE '%stok habis%jualan hilang%';

UPDATE public.content_posts SET
  title = 'Owner tak nampak nombor sebenar',
  category = 'pain_point'
WHERE title ILIKE '%owner tak nampak%';

UPDATE public.content_posts SET
  title = '5 app vs 1 workspace',
  category = 'comparison'
WHERE title ILIKE '%5 app vs%';

UPDATE public.content_posts SET
  title = 'Mulakan kerja dalam M-Core',
  category = 'demo'
WHERE title ILIKE '%mulakan kerja dalam m-core%';

UPDATE public.content_posts SET
  title = 'Bayaran masuk, lejar auto',
  category = 'demo'
WHERE title ILIKE '%bayaran masuk%lejar auto%';

UPDATE public.content_posts SET
  title = 'Payroll EPF SOCSO PCB',
  category = 'demo'
WHERE title ILIKE '%payroll%epf%';

UPDATE public.content_posts SET
  title = 'POS jualan terus kira untung',
  category = 'demo'
WHERE title ILIKE '%pos jualan terus%';

UPDATE public.content_posts SET
  title = 'Staff nampak apa owner benarkan',
  category = 'demo'
WHERE title ILIKE '%staff nampak apa owner%';

UPDATE public.content_posts SET
  title = 'Cuti umum 2026 dalam planner',
  category = 'seasonal'
WHERE title ILIKE '%cuti umum 2026%';

UPDATE public.content_posts SET
  title = 'Log masuk, nombor terus nampak',
  category = 'demo'
WHERE title ILIKE '%log masuk%nombor terus%';

UPDATE public.content_posts SET
  title = 'Tragedi roti habis waktu puncak',
  category = 'pain_point'
WHERE title ILIKE '%tragedi roti habis%';

UPDATE public.content_posts SET
  title = 'Kenapa SSM tak boleh daftar TikTok Seller Center',
  category = 'pain_point'
WHERE title ILIKE '%ssm%seller center%';

UPDATE public.content_posts SET
  title = 'Penyelesaian lejar merapu',
  category = 'demo'
WHERE title ILIKE '%penyelesaian lejar merapu%';

UPDATE public.content_posts SET
  title = 'Owner menyesal lewat siap sistem',
  category = 'pain_point'
WHERE title ILIKE '%owner menyesal%';
