# FulFillX — Refactor: Split the single file into linked files (no build step)

Goal: split FulFillX.html into FulFillX.html + styles.css + js/ modules, using CLASSIC
<link> / <script src> tags so the app still opens by double-clicking. This is a PURE
EXTRACTION — zero behavior changes, no renamed storage keys, no logic changes. The only
thing that changes is where the code physically lives.

## CRITICAL — preserve existing user data & double-click
- Keep the entry file named EXACTLY `FulFillX.html` in the SAME folder. Do not rename or move
  it. (localStorage and IndexedDB on file:// are tied to the file's path — renaming or moving
  it would orphan the user's existing journal/habit/tool entries.)
- Do NOT change any localStorage keys, IndexedDB database/store names, or the data schema.
- Use CLASSIC scripts only: `<script src="..."></script>` and `<link rel="stylesheet">`.
  Do NOT use ES modules (`type="module"`) or `fetch()` for local files — those are blocked
  from file:// and would break double-click.
- Keep ALL JS functions and top-level variables in the global scope exactly as they are now:
  same names, same signatures, same logic. Inline HTML handlers (onclick=, etc.) must keep
  working unchanged. This is a physical move, NOT a rewrite or a namespacing pass.
- After the refactor, the app must open by double-clicking FulFillX.html and behave identically,
  with all previously-saved data still present.

## Before starting
- Commit the current working single-file FulFillX.html to git as a rollback point.

## STEP 1 — Extract the CSS
Move everything inside the `<style>` block into a new `styles.css` in the same folder; replace
the `<style>` block with `<link rel="stylesheet" href="styles.css">`. Change no rules. Verify
the app looks identical in both Slate and Graphite. Commit ("Refactor: extract CSS").

## STEP 2 — Extract the JS into modules
Create a `js/` folder and move the JS out of the inline `<script>` into these files, grouped by
feature. Move the EXISTING code as-is — do not rewrite logic or rename anything:
  js/data.js      — storage helpers, localDateKey, schema/migrations, IndexedDB photo store, shared state/vars
  js/journals.js  — journals + widget engine + widget render/save/load
  js/habits.js    — habit scheduler
  js/todo.js      — to-do widgets, quick-access button/sheet, reminders
  js/history.js   — History tab, month grid, day detail, backfill, home week strip
  js/toolbox.js   — tool registry, diary engine, all tools, tool history
  js/insights.js  — insights
  js/app.js       — bootstrap/init, bottom-nav routing, settings, theme toggle (this runs work on load)

Replace the inline `<script>` with classic `<script src>` tags loaded IN THIS ORDER
(data first, app.js LAST):
  data.js → journals.js → habits.js → todo.js → history.js → toolbox.js → insights.js → app.js

Rules:
- Only app.js (or the existing init / DOMContentLoaded handler) should EXECUTE work on load;
  every other file should only DEFINE functions/variables. That keeps load order safe.
- If a function doesn't fit neatly in one module, put it where it's most used — correctness
  and "no behavior change" matter more than perfect categorization.
- Do not change function names, storage keys, element IDs, or logic anywhere.

Verify the FULL app by double-clicking FulFillX.html: existing journals, habits, history,
photos, and tool entries all still load (data intact); every tab works; both themes work;
saving and loading work. Then commit ("Refactor: extract JS into js/ modules").

## After
- Report the final file list with line counts, and confirm existing data still loads.
- Nothing should look or behave differently than before the refactor.

## Out of scope (deferred)
- ES modules + a bundler (e.g. Vite): defer to the future Capacitor/native milestone.
- Any namespacing or logic cleanup: not now — this refactor changes location only.
