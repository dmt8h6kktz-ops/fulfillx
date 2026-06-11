# FulFillX — Customize Toolbox Specification (hide & reorder)

Builds on the current refactored, multi-file app. Adds a "Customize Toolbox" screen in Settings,
mirroring "Customize journals," that lets the user show/hide and reorder the tools in their
toolbox. Hiding NEVER deletes a tool's saved entries. No build step, vanilla JS; reuse existing
styles, the toolbox engine, and per-tool history. Both themes, mobile-first, all dates via
localDateKey, never break existing localStorage/IndexedDB data. Lives mainly in toolbox.js +
the settings code.

## DATA
- New key `fulfillx.toolboxConfig` = `{ order: [toolId, ...], hidden: [toolId, ...] }`.
- On load, run an idempotent seed/migration: ensure every known tool id appears in `order`
  (append any missing ids — including future built-ins — to the end), and that nothing is hidden
  by default. So existing users get ALL tools visible in the current order, and any tool added
  later shows up automatically. Never hide a tool the user hasn't chosen to hide.

## PHASE 1 — "Customize Toolbox" screen in Settings
- Add a "Customize Toolbox" entry in Settings, next to "Customize journals".
- It lists every tool by its purpose-first display name (e.g. "Cravings · The 5 R's"), each row
  with: a reorder control (drag handle or up/down) and a show/hide toggle.
- Reordering and toggling visibility write to `fulfillx.toolboxConfig` immediately.
- Reuse the journal-customization UI pattern and styles so it feels identical.
Acceptance: toggling hide and reordering persist across reloads; both themes; mobile widths fine.

## PHASE 2 — Toolbox library respects the config
- The Toolbox library renders only non-hidden tools, in `toolboxConfig.order`.
- Hidden tools' history and entries are PRESERVED (not deleted). Re-showing a tool restores its
  card with its full history intact.
- Hiding only affects library visibility — it does not delete data or schedules. (Keep it simple:
  a hidden tool just doesn't show its card.)
Acceptance: hidden tools disappear from the library and reappear with their history when
re-shown; library order matches the config; no entries are ever lost.

## OUT OF SCOPE (planned follow-ons, NOT in this spec)
- Create-your-own custom tool (a guided-prompt builder reusing the diary engine: name, icon,
  ordered step prompts; runs and saves like the built-ins; no special mechanics).
- Request-a-tool (needs a feedback channel — revisit at the native/feedback step).

## CONSTRAINTS
- Targeted edits; commit per phase; reuse theme/engine/history; no new dependencies, no CDN.
- Never break or discard existing localStorage / IndexedDB data.
