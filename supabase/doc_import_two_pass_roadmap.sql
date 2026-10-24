-- WRITE-ONLY. Mike runs in Supabase SQL Editor after ai-proxy two-pass deploy.
-- Doc import: vision OCR then chat structure (WA screenshot / photo path).

update public.dev_roadmap_items
set stage = 'completed', module = 'core',
    description = 'Projects Import from doc: image/screenshot path is two-pass (qwen OCR flat document_text + llama nested tasks). Fixes Groq 400 json_validate_failed on WA screenshots. Text PDF path unchanged. DEFAULT_VISION_MODEL -> qwen/qwen3.8-27b.'
where title = 'Doc import two-pass OCR for screenshots';

insert into public.dev_roadmap_items (title, description, module, stage)
select
  'Doc import two-pass OCR for screenshots',
  'Projects Import from doc: image/screenshot path is two-pass (qwen OCR flat document_text + llama nested tasks). Fixes Groq 400 json_validate_failed on WA screenshots. Text PDF path unchanged. DEFAULT_VISION_MODEL -> qwen/qwen3.8-27b.',
  'core',
  'completed'
where not exists (
  select 1 from public.dev_roadmap_items where title = 'Doc import two-pass OCR for screenshots'
);
