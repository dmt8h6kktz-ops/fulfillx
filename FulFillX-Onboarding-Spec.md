# FulFillX — Onboarding Spec

First-launch onboarding flow. Six screens, mostly skippable, lands the user on a populated home. Seeds real app state from the user's choices. **Must never touch or erase existing user data.**

---

## 0. DATA-SAFETY INVARIANTS (highest priority — read first)

These are hard rules. If any of them can't be satisfied, stop and flag it rather than guessing.

1. **Existing users never see onboarding and never have data modified.** Onboarding is new; every current install already has `fulfillx.*` data from prior versions. A brand-new install has none. Use that to tell them apart.
2. **Append-only.** Onboarding may *create* keys that don't exist yet. It must never delete, clear, replace, or overwrite an existing localStorage key or IndexedDB record.
3. **The existing-data check runs before any seeding this session.** Do not let default first-run seeding write keys before the onboarding decision is made, or the check will misfire.
4. **Idempotent.** Re-running init never re-shows onboarding once the flag is set, and never double-seeds.
5. **Discover real keys/schemas — don't assume.** Read the codebase to find the actual key names and the actual habit object shape. Match them exactly.

---

## 1. Trigger + existing-user migration

On app init, at the **earliest point** (after the data layer is available, before any default seeding and before rendering home):

```
const onboarded = localStorage.getItem('fulfillx.onboarded');

if (onboarded === 'true') {
    // normal launch — do nothing special
} else {
    // Has this install been used before? (any real prior data)
    const hasPriorData = /* true if ANY existing fulfillx.* user-data key
                            is present in localStorage, OR any IndexedDB
                            photo/data record exists */;

    if (hasPriorData) {
        // EXISTING USER -> silently migrate, never show onboarding, seed nothing
        localStorage.setItem('fulfillx.onboarded', 'true');
        localStorage.setItem('fulfillx.onboardedAt', new Date().toISOString());
    } else {
        // Genuine fresh install -> run onboarding
        showOnboarding();
    }
}
```

**`hasPriorData` definition:** presence of any key the app writes for real content — habits, journal/diary entries, history, toolbox config/history, main goal, saved settings — or any IndexedDB record. Because onboarding ships *after* those features, any prior user already has at least one. Enumerate the app's actual keys; treat the presence of any one as prior use. If the only keys present are ones this same update would seed, exclude those from the signal.

After onboarding completes (or is skipped to the end), set `fulfillx.onboarded='true'` + `onboardedAt`, then fall through to the normal app — **including the app's existing first-run default seeding** (journal widgets, etc.). Onboarding seeds the user's *choices* on top; it does not replace default seeding of unrelated systems.

---

## 2. Screens (one step per screen, Back/Next, progress dots)

**1 — Welcome.** Wordmark + mission line ("Helping you become You.") + one or two sentences of purpose. Single **Get started** button. (No Back. A small **Skip** in the corner jumps to the final screen and marks onboarded.)

**2 — Your name.** Single text field, "What should we call you?" Optional. Writes to the app's existing name/profile key only if non-empty. Greeting on home uses it.

**3 — Focus areas (multi-select).** "What do you want to build?" Eight tappable areas, choose any number:
Health & body · Discipline & foundation · Calm & mind · Relationships · Learning & growth · Creativity · Sleep & recovery · Purpose & self.
Stored as `fulfillx.focusAreas` (array of slugs). Drives screen 4 ordering/suggestions and the light tone hook (§4). Skippable.

**4 — Starting habits (multi-select, grouped).** "Pick a few to start — start small, add more anytime." Shows the six habit groups (§3) as toggle chips, scrollable, with pinned heading + Back/Next bar + live "N selected" count. Focus picks from screen 3 float their groups/suggested habits to the top (see §3 mapping); **nothing is auto-selected** — the user chooses. Selected habits are seeded as real habit objects (§5). Skippable (seeds none).

**5 — First intention (skippable).** "Set one thing you're working toward." Single field -> the app's existing **Main Goal**. Only written if non-empty **and** no main goal already exists. Prominent **Skip** since this is reflective.

**6 — You're set.** Confirmation + two quick prefs: **theme** (warm-night dark / light — writes the app's existing theme key) and **daily reminder** opt-in (writes the existing reminder/notification-pref key; if on, registers via the existing reminder system — do not invent a new one). **Enter FulFillX** -> set onboarded flag -> normal home.

Visual: reuse the design-system tokens (both themes), the warm-night dark default, real **Phosphor Regular** icons (not inline SVG), and existing component styles. Match the approved mockups (`FulFillX-Onboarding.html`, `FulFillX-Onboarding-Habits.html`).

---

## 3. Habit library + focus mapping (locked)

**Six groups that own habits:**

- **Health & body:** Exercise · Walk / steps · Stretch · Cook a meal · Boxing · Diet · Vitamins
- **Discipline & foundation:** Wake early · Make your bed · Cold shower · Keep your routine
- **Calm & mind:** Meditate · Breathwork · Journal · Screen-free hour
- **Relationships:** Reach out · Quality time (no phone) · Appreciate someone · Call family
- **Learning & growth:** Read · Study a language · Practice a skill · Podcast
- **Creativity:** Write · Draw / create · Play an instrument · Make something

**Two focus areas that own no habits — tone + cross-suggest only:**

- **Sleep & recovery** -> steers journal tone toward wind-down/recovery (§4) and cross-suggests, from the groups above: Diet, Vitamins, Exercise, Stretch, Meditate, Breathwork, Screen-free hour.
- **Purpose & self** -> steers journal tone toward meaning/values/reflection (§4) and cross-suggests: Journal, Read, Practice a skill. (Working toward the goal itself lives in the Main Goal, not a habit.)

**Pre-suggestion behavior (screen 4):** selected focus areas' groups sort to the top; cross-suggested habits get a subtle "suggested" accent. No auto-selection. The suggested-accent is nice-to-have; the must-haves are browse-all + multi-select + correct seeding.

**Suggested Phosphor icons** (swap any name not present in the bundled set):
Exercise `barbell` · Walk `person-simple-walk` · Stretch `person-simple-tai-chi` · Cook a meal `cooking-pot` · Boxing `boxing-glove` · Diet `fork-knife` · Vitamins `pill` · Wake early `sun-horizon` · Make your bed `bed` · Cold shower `drop` · Keep your routine `repeat` · Meditate `flower-lotus` · Breathwork `wind` · Journal `notebook` · Screen-free hour `device-mobile-slash` · Reach out `chat-circle` · Quality time `users-three` · Appreciate someone `heart` · Call family `phone` · Read `book-open` · Study a language `translate` · Practice a skill `target` · Podcast `headphones` · Write `pencil-simple` · Draw / create `paint-brush` · Play an instrument `music-note` · Make something `hammer`.

---

## 4. Light tone hook (keep minimal — defer if it risks scope)

Store `fulfillx.focusAreas` so it's available app-wide. The only behavioral hook for this phase: if **Sleep & recovery** is selected, the evening journal may show one optional wind-down reflection prompt; if **Purpose & self** is selected, one values/meaning reflection prompt. Implement as *adding an optional prompt string* the journal already supports — **do not restructure the journal engine.** If that can't be done as a tiny additive change, store `focusAreas` now and defer the tone hook to its own follow-up phase.

---

## 5. Seeding chosen habits (additive)

For each habit the user selected on screen 4, construct a habit object **matching the existing habit schema** (read it from the code — V1.2 first-class habits with time-of-day slot + day-of-week scheduling). Defaults:

- `name`: the label above; `icon`: from the §3 map.
- schedule: **every day**; slot: a sensible default (e.g. anytime/daytime, or the app's default slot).
- `id`/`createdAt`/`order`: per the existing model.

Insert **additively and de-duped** into the app's habits store — append without removing or replacing anything already there. (On a fresh install the store is empty, so this is just the chosen habits.)

---

## 6. State written by onboarding (all create-only / additive)

- `fulfillx.onboarded` = `'true'`, `fulfillx.onboardedAt` = ISO string
- name -> existing profile/name key (only if entered)
- `fulfillx.focusAreas` -> array (only if any chosen)
- chosen habits -> existing habits store (additive, §5)
- Main Goal -> existing main-goal key (only if entered AND none exists)
- theme -> existing theme key
- reminder pref -> existing reminder/notification-pref key (+ register via existing system if on)

Nothing else is written. No existing key is read-then-overwritten.

---

## 7. Out of scope (deferred)

Deep per-area journal-tone rewriting; custom-habit creation inside onboarding; "request a tool"; editing the focus list later from settings (it's just stored for now). These are separate future phases.

---

## 8. Verification checklist

**Data safety (most important):**
- On your real install (existing data): after the update, **onboarding does not appear**; home loads normally; **all habits, journals, history, photos, toolbox, main goal are intact and unchanged**; `fulfillx.onboarded` is now `'true'`.
- No existing localStorage key or IndexedDB record was deleted or overwritten.

**Fresh install (test safely — see note):**
- Onboarding appears on a truly empty install.
- Completing it: name greets on home; chosen habits appear as real scheduled habits; intention shows as Main Goal; theme + reminder applied; lands on a populated home.
- Relaunch does **not** re-show onboarding.
- Skipping any step leaves that state unset with no crash; skipping to the end still marks onboarded and lands on home (with the app's normal defaults).

**Safe way to test fresh-install without risking your data:** file:// storage is scoped to the file path, so copy the whole app folder to a different location and open the copied `FulFillX.html` there — it starts with empty storage, a clean fresh-install simulation, while your real folder is untouched. (Keep the entry file named exactly `FulFillX.html`.)

---

## 9. Build notes

- New module `js/onboarding.js` + styles in `styles.css` + a container in `FulFillX.html` + one hook call in the init path of `app.js`. Keep edits targeted; don't rewrite unrelated files.
- Presentation + onboarding logic only. Don't refactor other systems.
- Both themes via existing tokens; real Phosphor icons; no raw color literals.
- Commit at the end as one savepoint.
