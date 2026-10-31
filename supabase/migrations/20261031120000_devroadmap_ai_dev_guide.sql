-- Roadmap: AI dev guide (CLAUDE.md + Claude Code commands + Grok instructions). Idempotent, write-only.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.dev_roadmap_items WHERE title = 'AI dev guide: CLAUDE.md + Claude Code commands + Grok instructions') THEN
    UPDATE public.dev_roadmap_items
    SET stage = 'completed',
        module = 'core',
        description = 'CLAUDE.md (repo root) merged with M-Core working rules: full system audit, 8-point feature audit, ONE recommendation, discussion template, engineering rules (SQL write-only/idempotent/one block, tenant_id, soft delete, EN/BM, design tokens, sw/?v bump, notifications), 6-part final summary, system map, tenant context. Claude Code slash commands .claude/commands/discuss.md, proceed.md, summary.md. Condensed chat version docs/ai/grok-instructions.md for Grok/Claude chat. Docs only, no app code change.'
    WHERE title = 'AI dev guide: CLAUDE.md + Claude Code commands + Grok instructions';
  ELSE
    INSERT INTO public.dev_roadmap_items (title, description, module, stage)
    VALUES (
      'AI dev guide: CLAUDE.md + Claude Code commands + Grok instructions',
      'CLAUDE.md (repo root) merged with M-Core working rules: full system audit, 8-point feature audit, ONE recommendation, discussion template, engineering rules (SQL write-only/idempotent/one block, tenant_id, soft delete, EN/BM, design tokens, sw/?v bump, notifications), 6-part final summary, system map, tenant context. Claude Code slash commands .claude/commands/discuss.md, proceed.md, summary.md. Condensed chat version docs/ai/grok-instructions.md for Grok/Claude chat. Docs only, no app code change.',
      'core',
      'completed'
    );
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'dev_roadmap schema variant; skip: %', SQLERRM;
END $$;
