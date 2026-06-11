# FulFillX — Visual Overhaul Spec (warm-night design system, both themes)

Apply the locked home look as a reusable SYSTEM across every screen. This is the single
authoritative spec for the overhaul (it includes the tokens, components, and every screen phase).
PRESENTATION ONLY — never change data, storage, or logic. Both themes are driven by CSS variables
in styles.css. Reuse Phosphor icons. Charts stay inline SVG/CSS (no chart lib, no CDN). Never
break existing localStorage/IndexedDB data.

## HOW TO BUILD
Execute the phases in order, one at a time, with targeted edits. After each phase: confirm its
acceptance, summarize what changed and how to verify, commit ("Overhaul Phase N: <name>"),
continue. If a phase can't be done cleanly, stop and explain.

## THEME MECHANISM
- A single root attribute drives the theme: `<html data-theme="dark">` / `data-theme="light"`.
- ALL surfaces read CSS variables — switching theme is ONE attribute change, never a per-element
  edit. Wire the existing Settings theme toggle (and, if present, an Auto option: light by day /
  dark by night) to set + persist this attribute (reuse the current theme preference).
- After the overhaul, NO screen contains raw theme colors — only `var(--…)`.

## TOKENS (define both blocks in styles.css)

### [data-theme="dark"] — warm-night
--bg: radial-gradient(130% 78% at 70% -8%, #342A2B 0%, #221C1C 42%, #16110F 100%)
--glow-1: rgba(242,150,124,.36)  --glow-2: rgba(232,165,110,.17)
--t1:#F5F2FB  --t2:#A8A2BE  --t3:#857F9C
--accent:#F2967C  --on-accent:#16110F  --success:#7FD0A0
--surface:rgba(255,255,255,.06)  --surface-strong:rgba(255,255,255,.09)
--border:rgba(255,255,255,.12)  --blur:14px  --shadow:0 10px 30px rgba(0,0,0,.20)
--field:rgba(255,255,255,.07)  --nav-bg:rgba(18,16,24,.5)  --hairline:rgba(255,255,255,.08)

### [data-theme="light"] — same design, light surfaces
--bg: radial-gradient(130% 78% at 70% -8%, #F5F6F8 0%, #EDEFF2 44%, #E8EAEE 100%)
--glow-1: rgba(236,132,104,.13)  --glow-2: rgba(245,200,150,.10)
--t1:#2D3142  --t2:#6B7079  --t3:#A6AAB2
--accent:#EC8468  --on-accent:#FFFFFF  --success:#5BA37F
--surface:rgba(255,255,255,.70)  --surface-strong:rgba(255,255,255,.78)
--border:rgba(255,255,255,.90)  --blur:14px  --shadow:0 10px 28px rgba(70,80,100,.10)
--field:rgba(45,49,66,.06)  --nav-bg:rgba(255,255,255,.66)  --hairline:rgba(180,185,195,.25)
(Light surfaces are more opaque than dark — translucency reads crisper on light.)

### Shared
Fonts Baloo 2 (headings/labels) + Fredoka (body). Radii: hero 22 · card 16–18 · pill 16 · chip 15
· field 9–10. Type: greeting 26/700 Baloo · title 21/600 · card title 15–16/600 · body 12.5–13/300
Fredoka · eyebrow/label 10–11/500 uppercase letter-spaced · caption 9. Screen padding 22–24px;
card padding 14–19; card gap 11–12.

## COMPONENTS (classes consuming the tokens)
- App shell: `--bg` + two blurred glow blobs (`--glow-1` top-right, `--glow-2` lower-left).
- Top bar: wordmark (FulFill + accent X box) + gear (stroked). Back link uses --t2.
- Eyebrow: accent, uppercase, letter-spaced (dates + section labels).
- Page title / greeting: Baloo 700, --t1.
- Quote: centered, large accent quote-mark, --t2 body, --t3 uppercase attribution.
- Week strip: 7 cells; day letter (--t3, accent if today); cell = number on --field OR a photo
  thumbnail; today = 2px accent ring + accent letter + soft accent glow. Keep current behavior.
- Card: --surface + blur + --border + --shadow.   Hero: --surface-strong, larger, accent eyebrow.
- List row: title --t1, sub --t2, hairline divider (History/Habits/Toolbox lists).
- Stat tile: small card, big value --t1, label --t3, tiny trend (success/accent), accent chevron.
- Choice pills (Yes/Partly/No): --border outline; selected = accent fill + --on-accent.
- Tag chip (emotions): toggle; selected = accent fill + --on-accent.
- Scale (1–10): row of cells on --field; selected = accent fill.
- Field / textarea: --field bg, --border, --t1 text.
- Primary button: accent fill + --on-accent (Save, Next).   Dashed pill: --border dashed.
- Status chip: done = success tint; todo = accent tint.
- Bottom nav: --nav-bg + blur + --hairline top; items --t3, active = accent.
- Chart: inline SVG; data uses var(--accent), axis/grid var(--t3). No library.

## PATTERNS
- Editorial masthead (primary screens): eyebrow → title/greeting → (quote on home).
- Dynamic hero (home): the NEXT/relevant session is the hero on top; the other is a small card.
  Default time logic (tunable): before 12:00 → Morning hero; 12:00–17:00 → first not-done session
  (Morning if undone else Evening); after 17:00 → Evening hero. A completed session is always the
  small card, never the hero.
- Glass: dark = translucent + blur; light = more opaque + soft shadow.

---

## PHASES

### PHASE 1 — Foundation + Home
Set up both `[data-theme]` token blocks + the component classes in styles.css; wire the Settings
theme toggle to the root attribute and persist it. Apply the system to HOME: editorial masthead
(eyebrow + greeting + quote), the kept week strip, the dynamic hero (per the time logic), the
secondary session card, the quick-check-in pill, and the nav. Replace home's hardcoded colors with
tokens.
Acceptance: home matches the locked design in BOTH themes; toggling theme flips every surface via
the attribute; no raw theme colors remain on home; data intact.

### PHASE 2 — Journals (morning / daytime / evening)
Restyle the journal screens to the system: editorial header (eyebrow + title), one glass card per
widget, the Yes/Partly/No choice pills, text fields/textareas, the 1–10 scale (Energy/Effort),
emotion tags, the photo attachment, and the primary Save button. Group Energy/Effort/Emotions under
a "How was today?" eyebrow. No layout/logic change — restyle only.
Acceptance: all three journals render in the system in both themes; every widget type (text, scale,
sleep, habits, pills, tags, photo) is styled; saving/loading unchanged; data intact.

### PHASE 3 — Toolbox
Library: editorial header; each tool a glass card with a coral-tinted icon tile (Phosphor), its
purpose-first name (Baloo) and short purpose (Fredoka); keep any category grouping. In-tool guided
flow: one step per screen on a glass surface — eyebrow = tool name, step title, prompt, glass field,
Back / Next (Next = accent), then the review screen; per-tool history as glass list rows. Respect the
Customize Toolbox visibility/order.
Acceptance: library + every tool flow + tool history render in the system, both themes; flows and
saved entries unchanged.

### PHASE 4 — Insights
Editorial header; the six glass stat tiles with accent chevrons + trends; coral-bordered "we
noticed" callouts; glass chart cards with var(--accent) data; the per-tile drill-downs; the emotion-
frequency (Mood) view; day-of-week + correlations; the tools section. Charts inline SVG only.
Acceptance: overview, drill-downs, and emotion view render in the system, both themes; all numbers
and guards unchanged.

### PHASE 5 — Habits
Editorial header; habit cards/rows on glass; the scheduler (slots, days); toggles/checks in accent;
suggested habits. Restyle only.
Acceptance: habits manager + scheduling render in the system, both themes; logic intact.

### PHASE 6 — History
Editorial header; month grid + day-detail on glass; week-strip styling consistent with home; photo
previews; full diary/tool entries. Restyle only.
Acceptance: month grid + day detail render in the system, both themes; backfill and data intact.

### PHASE 7 — Settings
Editorial header; grouped rows on glass; the theme toggle (Light / Dark / Auto); Customize Journals
and Customize Toolbox; reminders; about. Restyle only.
Acceptance: settings render in the system, both themes; every control still works.

---

## GLOBAL ACCEPTANCE
Every screen matches the system in BOTH themes; the theme toggle flips ALL surfaces via the root
attribute; NO raw theme colors remain anywhere (only var(--…)); all existing data and logic intact.

## CONSTRAINTS
Targeted edits; commit per phase; presentation only (no data/logic changes); both themes verified at
phone widths; no CDN / chart libs; reuse Phosphor icons; never break localStorage/IndexedDB.
