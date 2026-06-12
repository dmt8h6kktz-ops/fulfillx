// js/onboarding.js — first-launch onboarding flow (data-safe, additive)
//
// DATA SAFETY (see FulFillX-Onboarding-Spec §0):
//  • Existing users NEVER see onboarding and have ZERO data modified.
//  • Append-only: this module only CREATES keys/records that don't exist yet;
//    it never deletes, clears, replaces, or overwrites an existing one.
//  • The existing-user check (maybeStartOnboarding) runs at the EARLIEST point
//    in app.init() — before any default seeding — so it can't misfire.
//
// All state names/shapes below were read from the real codebase:
//  • habit object schema: { id, name, icon, slots:[], days:[0..6], active }
//    (data.js DEFAULT_HABITS) — `icon` renders as raw emoji text everywhere,
//    so seeded habits store an emoji; Phosphor names are used only in this UI.
//  • Main Goal: entries[today].morning.maingoal (string).
//  • theme key: fulfillx.theme. Reminder: existing _requestNotificationPermission().

/* ── Static onboarding data ─────────────────────────────────────────────── */

// Eight focus areas (screen 3). Six own habit groups; sleep & purpose own none.
const OB_FOCUS = [
    { slug: 'health',        label: 'Health & body',           icon: 'heartbeat' },
    { slug: 'discipline',    label: 'Discipline & foundation', icon: 'shield-check' },
    { slug: 'calm',          label: 'Calm & mind',             icon: 'flower-lotus' },
    { slug: 'relationships', label: 'Relationships',           icon: 'users-three' },
    { slug: 'learning',      label: 'Learning & growth',       icon: 'graduation-cap' },
    { slug: 'creativity',    label: 'Creativity',              icon: 'palette' },
    { slug: 'sleep',         label: 'Sleep & recovery',        icon: 'moon-stars' },
    { slug: 'purpose',       label: 'Purpose & self',          icon: 'compass' }
];

// Six habit-owning groups (screen 4). Each habit carries a Phosphor name (`ph`)
// for the chip, an `emoji` for the stored habit.icon, and a default `slot`.
const OB_GROUPS = [
    { focus: 'health', label: 'Health & body', icon: 'heartbeat', habits: [
        { name: 'Exercise',     ph: 'barbell',               emoji: '🏋️', slot: 'daytime' },
        { name: 'Walk / steps', ph: 'person-simple-walk',    emoji: '🚶', slot: 'daytime' },
        { name: 'Stretch',      ph: 'person-simple-tai-chi', emoji: '🤸', slot: 'morning' },
        { name: 'Cook a meal',  ph: 'cooking-pot',           emoji: '🍳', slot: 'evening' },
        { name: 'Boxing',       ph: 'boxing-glove',          emoji: '🥊', slot: 'daytime' },
        { name: 'Diet',         ph: 'fork-knife',            emoji: '🥗', slot: 'daytime' },
        { name: 'Vitamins',     ph: 'pill',                  emoji: '💊', slot: 'morning' }
    ]},
    { focus: 'discipline', label: 'Discipline & foundation', icon: 'shield-check', habits: [
        { name: 'Wake early',       ph: 'sun-horizon', emoji: '🌅', slot: 'morning' },
        { name: 'Make your bed',    ph: 'bed',         emoji: '🛏️', slot: 'morning' },
        { name: 'Cold shower',      ph: 'drop',        emoji: '🚿', slot: 'morning' },
        { name: 'Keep your routine', ph: 'repeat',     emoji: '🔁', slot: 'daytime' }
    ]},
    { focus: 'calm', label: 'Calm & mind', icon: 'flower-lotus', habits: [
        { name: 'Meditate',        ph: 'flower-lotus',         emoji: '🧘', slot: 'morning' },
        { name: 'Breathwork',      ph: 'wind',                 emoji: '🌬️', slot: 'morning' },
        { name: 'Journal',         ph: 'notebook',             emoji: '📓', slot: 'evening' },
        { name: 'Screen-free hour', ph: 'device-mobile-slash', emoji: '📵', slot: 'evening' }
    ]},
    { focus: 'relationships', label: 'Relationships', icon: 'users-three', habits: [
        { name: 'Reach out',             ph: 'chat-circle',  emoji: '💬', slot: 'daytime' },
        { name: 'Quality time (no phone)', ph: 'users-three', emoji: '🫂', slot: 'evening' },
        { name: 'Appreciate someone',    ph: 'heart',        emoji: '💛', slot: 'daytime' },
        { name: 'Call family',           ph: 'phone',        emoji: '📞', slot: 'evening' }
    ]},
    { focus: 'learning', label: 'Learning & growth', icon: 'graduation-cap', habits: [
        { name: 'Read',             ph: 'book-open',  emoji: '📖', slot: 'evening' },
        { name: 'Study a language', ph: 'translate',  emoji: '🗣️', slot: 'evening' },
        { name: 'Practice a skill', ph: 'target',     emoji: '🎯', slot: 'daytime' },
        { name: 'Podcast',          ph: 'headphones', emoji: '🎧', slot: 'daytime' }
    ]},
    { focus: 'creativity', label: 'Creativity', icon: 'palette', habits: [
        { name: 'Write',             ph: 'pencil-simple', emoji: '✍️', slot: 'evening' },
        { name: 'Draw / create',     ph: 'paint-brush',   emoji: '🎨', slot: 'daytime' },
        { name: 'Play an instrument', ph: 'music-note',   emoji: '🎵', slot: 'daytime' },
        { name: 'Make something',    ph: 'hammer',        emoji: '🔨', slot: 'daytime' }
    ]}
];

// Cross-suggest: focus areas that own no habits steer toward existing ones (§3).
const OB_CROSS = {
    sleep:   ['Diet', 'Vitamins', 'Exercise', 'Stretch', 'Meditate', 'Breathwork', 'Screen-free hour'],
    purpose: ['Journal', 'Read', 'Practice a skill']
};

// Flat name → habit-def index (for seeding + suggestion lookup).
const OB_HABIT_INDEX = (() => {
    const idx = {};
    OB_GROUPS.forEach(g => g.habits.forEach(h => { idx[h.name] = { ...h, focus: g.focus }; }));
    return idx;
})();

// localStorage keys that mean "this install has been used before" (§1).
// Onboarding ships AFTER all of these features, so any prior user has at least
// one (config + habits are seeded on first run of older versions; photoIndex
// mirrors the IndexedDB photo store synchronously). Keys this update itself
// would create are deliberately excluded so an interrupted onboarding can't be
// mistaken for prior use.
const OB_PRIOR_DATA_KEYS = [
    'fulfillx.config', 'fulfillx.entries', 'fulfillx.habits',
    'fulfillx.toolboxConfig', 'fulfillx.toolEntries', 'fulfillx.toolUsage',
    'fulfillx.attachmentStyle', 'fulfillx.values', 'fulfillx.photoIndex',
    'fulfillx.mindDumpReminder', 'fulfillx.theme'
];

function obSlug(name) {
    return 'h_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/* ── Controller (mixed into the global `app`) ───────────────────────────── */

Object.assign(app, {

    // Called at the earliest point of app.init(). Returns true only when it has
    // taken over the screen with onboarding (a genuine fresh install), in which
    // case init() should stop and resume after obFinish() re-runs it.
    maybeStartOnboarding() {
        const onboarded = localStorage.getItem('fulfillx.onboarded');
        if (onboarded === 'true') return false;

        if (this._hasPriorFulfillxData()) {
            // EXISTING USER → silently migrate, never show onboarding, seed nothing.
            localStorage.setItem('fulfillx.onboarded', 'true');
            localStorage.setItem('fulfillx.onboardedAt', new Date().toISOString());
            return false;
        }

        // Genuine fresh install → run onboarding (defers the rest of init).
        this._renderOnboarding();
        return true;
    },

    _hasPriorFulfillxData() {
        return OB_PRIOR_DATA_KEYS.some(k => localStorage.getItem(k) !== null);
    },

    /* ── Flow setup ─────────────────────────────────────────────────────── */
    _renderOnboarding() {
        this._ob = { step: 1, name: '', focus: new Set(), habits: new Set(),
                     intention: '', theme: 'dark', reminder: false };
        // Warm-night dark is the onboarding default (visual preview only — the
        // chosen pref is written to localStorage at obFinish, never before).
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('appContainer')?.classList.add('theme-graphite');
        const ov = document.getElementById('onboarding');
        ov.classList.add('active');
        this._obRender();
    },

    _obDots() {
        let dots = '';
        for (let i = 1; i <= 6; i++) {
            dots += `<span class="ob-dot${i === this._ob.step ? ' active' : ''}"></span>`;
        }
        return `<div class="ob-dots">${dots}</div>`;
    },

    _obRender() {
        const ov = document.getElementById('onboarding');
        ov.innerHTML = this[`_obScreen${this._ob.step}`]();
        ov.scrollTop = 0;
    },

    /* ── Screen 1 — Welcome ─────────────────────────────────────────────── */
    _obScreen1() {
        return `
        <div class="ob-screen">
            <div class="ob-top">
                <span></span>
                <button class="ob-skip" onclick="app.obSkipToEnd()">Skip</button>
            </div>
            <div class="ob-body ob-center">
                <p class="ob-wordmark">FULFILL<span>X</span></p>
                <p class="ob-mission">Helping you become You.</p>
                <p class="ob-purpose">A calm home for your habits, journals and reflections —
                    built to help you show up for the person you're becoming, one day at a time.</p>
            </div>
            <div class="ob-foot">
                ${this._obDots()}
                <button class="ob-btn ob-btn-primary" onclick="app.obNext()">Get started</button>
            </div>
        </div>`;
    },

    /* ── Screen 2 — Name ────────────────────────────────────────────────── */
    _obScreen2() {
        return `
        <div class="ob-screen">
            <div class="ob-top"><span></span><span></span></div>
            <div class="ob-body">
                <h2 class="ob-h">What should we call you?</h2>
                <p class="ob-sub">Optional — we'll use it to greet you on your home screen.</p>
                <input id="ob-name" class="ob-field" type="text" autocomplete="off"
                       placeholder="Your name" value="${this._esc(this._ob.name)}"
                       maxlength="40">
            </div>
            <div class="ob-foot">
                ${this._obDots()}
                <div class="ob-nav">
                    <button class="ob-btn ob-btn-ghost" onclick="app.obBack()">Back</button>
                    <button class="ob-btn ob-btn-primary" onclick="app.obNext()">Next</button>
                </div>
            </div>
        </div>`;
    },

    /* ── Screen 3 — Focus areas ─────────────────────────────────────────── */
    _obScreen3() {
        const chips = OB_FOCUS.map(f => `
            <button class="ob-focus-chip${this._ob.focus.has(f.slug) ? ' active' : ''}"
                    onclick="app.obToggleFocus('${f.slug}', this)">
                <i class="ph ph-${f.icon}"></i><span>${f.label}</span>
            </button>`).join('');
        return `
        <div class="ob-screen">
            <div class="ob-top">
                <span></span>
                <button class="ob-skip" onclick="app.obNext()">Skip</button>
            </div>
            <div class="ob-body">
                <h2 class="ob-h">What do you want to build?</h2>
                <p class="ob-sub">Pick any that speak to you — they shape the habits we suggest next.</p>
                <div class="ob-focus-grid">${chips}</div>
            </div>
            <div class="ob-foot">
                ${this._obDots()}
                <div class="ob-nav">
                    <button class="ob-btn ob-btn-ghost" onclick="app.obBack()">Back</button>
                    <button class="ob-btn ob-btn-primary" onclick="app.obNext()">Next</button>
                </div>
            </div>
        </div>`;
    },

    /* ── Screen 4 — Starting habits ─────────────────────────────────────── */
    _obScreen4() {
        // Selected focus groups float to the top, in selection order.
        const selected = [...this._ob.focus];
        const ordered  = OB_GROUPS.slice().sort((a, b) => {
            const ai = selected.indexOf(a.focus), bi = selected.indexOf(b.focus);
            const av = ai === -1 ? 99 : ai, bv = bi === -1 ? 99 : bi;
            return av - bv;
        });
        // Cross-suggested habit names from the two non-owning focus areas.
        const suggested = new Set();
        selected.forEach(s => (OB_CROSS[s] || []).forEach(n => suggested.add(n)));

        const groupsHtml = ordered.map(g => `
            <div class="ob-group">
                <div class="ob-group-head"><i class="ph ph-${g.icon}"></i>${g.label}</div>
                <div class="ob-chips">
                    ${g.habits.map(h => `
                        <button class="ob-chip${this._ob.habits.has(h.name) ? ' active' : ''}${suggested.has(h.name) ? ' suggested' : ''}"
                                onclick="app.obToggleHabit('${this._esc(h.name)}', this)">
                            <i class="ph ph-${h.ph}"></i><span>${h.name}</span>
                        </button>`).join('')}
                </div>
            </div>`).join('');

        return `
        <div class="ob-screen">
            <div class="ob-top ob-pinned">
                <div class="ob-pin-head">
                    <h2 class="ob-h ob-h-sm">Pick a few to start</h2>
                    <button class="ob-skip" onclick="app.obNext()">Skip</button>
                </div>
                <p class="ob-sub ob-sub-tight">Start small, add more anytime ·
                    <span class="ob-count" id="ob-count">${this._ob.habits.size} selected</span></p>
            </div>
            <div class="ob-body ob-scroll">
                <div class="ob-groups">${groupsHtml}</div>
            </div>
            <div class="ob-foot">
                ${this._obDots()}
                <div class="ob-nav">
                    <button class="ob-btn ob-btn-ghost" onclick="app.obBack()">Back</button>
                    <button class="ob-btn ob-btn-primary" onclick="app.obNext()">Next</button>
                </div>
            </div>
        </div>`;
    },

    /* ── Screen 5 — First intention ─────────────────────────────────────── */
    _obScreen5() {
        return `
        <div class="ob-screen">
            <div class="ob-top">
                <span></span>
                <button class="ob-skip" onclick="app.obSkipIntention()">Skip</button>
            </div>
            <div class="ob-body">
                <h2 class="ob-h">Set one thing you're working toward.</h2>
                <p class="ob-sub">It becomes your Main Goal — the quiet north star on your home screen.
                    You can change it anytime.</p>
                <input id="ob-intention" class="ob-field" type="text" autocomplete="off"
                       placeholder="I'm working toward…" value="${this._esc(this._ob.intention)}"
                       maxlength="120">
            </div>
            <div class="ob-foot">
                ${this._obDots()}
                <div class="ob-nav">
                    <button class="ob-btn ob-btn-ghost" onclick="app.obBack()">Back</button>
                    <button class="ob-btn ob-btn-primary" onclick="app.obNext()">Next</button>
                </div>
            </div>
        </div>`;
    },

    /* ── Screen 6 — You're set ──────────────────────────────────────────── */
    _obScreen6() {
        const t = this._ob.theme;
        return `
        <div class="ob-screen">
            <div class="ob-top"><span></span><span></span></div>
            <div class="ob-body ob-center">
                <div class="ob-done-mark"><i class="ph ph-check-circle"></i></div>
                <h2 class="ob-h">You're set.</h2>
                <p class="ob-sub">Two quick preferences and you're in.</p>

                <div class="ob-pref-label">Theme</div>
                <div class="ob-theme-row">
                    <button class="ob-theme-opt${t === 'dark' ? ' active' : ''}" onclick="app.obSetTheme('dark', this)">
                        <i class="ph ph-moon-stars"></i><span>Warm night</span>
                    </button>
                    <button class="ob-theme-opt${t === 'light' ? ' active' : ''}" onclick="app.obSetTheme('light', this)">
                        <i class="ph ph-sun"></i><span>Light</span>
                    </button>
                </div>

                <div class="ob-pref-label">Daily reminder</div>
                <button class="ob-reminder-row${this._ob.reminder ? ' active' : ''}" id="ob-reminder"
                        onclick="app.obToggleReminder()">
                    <span class="ob-reminder-text"><i class="ph ph-bell"></i> Gentle daily nudge to check in</span>
                    <span class="ob-switch"><span class="ob-switch-knob"></span></span>
                </button>
            </div>
            <div class="ob-foot">
                ${this._obDots()}
                <button class="ob-btn ob-btn-primary" onclick="app.obFinish()">Enter FulFillX</button>
            </div>
        </div>`;
    },

    /* ── Navigation / capture ───────────────────────────────────────────── */
    _obCaptureCurrent() {
        if (this._ob.step === 2) {
            this._ob.name = (document.getElementById('ob-name')?.value || '').trim();
        } else if (this._ob.step === 5) {
            this._ob.intention = (document.getElementById('ob-intention')?.value || '').trim();
        }
    },

    obNext() {
        this._obCaptureCurrent();
        if (this._ob.step < 6) { this._ob.step++; this._obRender(); }
    },

    obBack() {
        this._obCaptureCurrent();
        if (this._ob.step > 1) { this._ob.step--; this._obRender(); }
    },

    obSkipToEnd() {            // welcome corner Skip → jump straight to the final screen
        this._ob.step = 6;
        this._obRender();
    },

    obSkipIntention() {        // skip step 5 without recording an intention
        this._ob.intention = '';
        this._ob.step = 6;
        this._obRender();
    },

    obToggleFocus(slug, el) {
        if (this._ob.focus.has(slug)) this._ob.focus.delete(slug);
        else this._ob.focus.add(slug);
        el.classList.toggle('active');
    },

    obToggleHabit(name, el) {
        if (this._ob.habits.has(name)) this._ob.habits.delete(name);
        else this._ob.habits.add(name);
        el.classList.toggle('active');
        const count = document.getElementById('ob-count');
        if (count) count.textContent = `${this._ob.habits.size} selected`;
    },

    obSetTheme(theme, el) {
        this._ob.theme = theme;
        el.parentElement.querySelectorAll('.ob-theme-opt').forEach(b => b.classList.remove('active'));
        el.classList.add('active');
        // Live preview only — not persisted until obFinish.
        document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
        document.getElementById('appContainer')?.classList.toggle('theme-graphite', theme !== 'light');
    },

    obToggleReminder() {
        this._ob.reminder = !this._ob.reminder;
        document.getElementById('ob-reminder')?.classList.toggle('active', this._ob.reminder);
    },

    /* ── Finish → seed choices (create-only) → resume normal init ───────── */
    obFinish() {
        this._obCaptureCurrent();
        this._seedOnboardingChoices();
        // Set the flag LAST so an interruption before this point is detected as
        // prior data next launch (existing-user path) rather than re-onboarding.
        localStorage.setItem('fulfillx.onboarded', 'true');
        localStorage.setItem('fulfillx.onboardedAt', new Date().toISOString());

        const ov = document.getElementById('onboarding');
        ov.classList.remove('active');
        ov.innerHTML = '';
        // Resume the deferred app boot. onboarded === 'true' now, so
        // maybeStartOnboarding() returns false and init runs through once,
        // applying theme + seeding any unrelated first-run defaults.
        this.init();
    },

    _seedOnboardingChoices() {
        // Name → fulfillx.name (create-only, only if entered).
        if (this._ob.name && localStorage.getItem('fulfillx.name') === null) {
            localStorage.setItem('fulfillx.name', this._ob.name);
        }

        // Focus areas → fulfillx.focusAreas (create-only, only if any chosen).
        if (this._ob.focus.size && localStorage.getItem('fulfillx.focusAreas') === null) {
            localStorage.setItem('fulfillx.focusAreas', JSON.stringify([...this._ob.focus]));
        }

        // Chosen habits → fulfillx.habits, additive + de-duped by id. Only written
        // when ≥1 chosen, so skipping leaves the store unset and the app's normal
        // first-run default-habit seeding applies instead.
        if (this._ob.habits.size) {
            const existing = JSON.parse(localStorage.getItem('fulfillx.habits') || '[]');
            const byId = new Set(existing.map(h => h.id));
            this._ob.habits.forEach(name => {
                const def = OB_HABIT_INDEX[name];
                if (!def) return;
                const id = obSlug(name);
                if (byId.has(id)) return;                 // de-dupe, never replace
                existing.push({ id, name, icon: def.emoji, slots: [def.slot],
                                days: [0,1,2,3,4,5,6], active: true });
                byId.add(id);
            });
            localStorage.setItem('fulfillx.habits', JSON.stringify(existing));
        }

        // Intention → today's Main Goal, create-only (only if none already set).
        if (this._ob.intention) {
            const entries = JSON.parse(localStorage.getItem('fulfillx.entries') || '{}');
            const today = localDateKey();
            if (!entries[today]) entries[today] = {};
            if (!entries[today].morning) entries[today].morning = {};
            if (!entries[today].morning.maingoal) {
                entries[today].morning.maingoal = this._ob.intention;
                localStorage.setItem('fulfillx.entries', JSON.stringify(entries));
            }
        }

        // Theme → fulfillx.theme (a deliberate choice on screen 6).
        localStorage.setItem('fulfillx.theme', this._ob.theme === 'light' ? 'light' : 'dark');

        // Reminder pref → new fulfillx.dailyReminder (create-only); register via
        // the EXISTING notification system rather than inventing a new one.
        if (this._ob.reminder) {
            if (localStorage.getItem('fulfillx.dailyReminder') === null) {
                localStorage.setItem('fulfillx.dailyReminder',
                    JSON.stringify({ enabled: true, time: '20:00' }));
            }
            if (typeof this._requestNotificationPermission === 'function') {
                this._requestNotificationPermission();
            }
        }
    }

});
