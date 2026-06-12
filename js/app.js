// js/app.js — bootstrap, navigation, settings, theme; runs on DOMContentLoaded

Object.assign(app, {
    init() {
        // First-launch onboarding gate — runs before ANY default seeding so the
        // existing-user check can't misfire. Returns true only on a genuine fresh
        // install (onboarding shown); init resumes via obFinish() → this.init().
        if (this.maybeStartOnboarding()) return;
        this.migrateV16Config();     // idempotent — safe on every load
        this.migrateToolboxConfig(); // idempotent — seeds order/hidden
        this.getConfig();
        this.getHabits();
        this.initHistory();
        this.initTheme();
        this.updateGreeting();
        this.updateQuote();
        this.renderToolbox();
        this.renderHabits();
        this.updateCompletionBadges();
        this._updateHomeHero();
        this.renderInsights();
        this.updateTodoFab();
        this.renderWeekStrip();
        this._startReminderPoller();
        setInterval(() => this.updateGreeting(), 60000);
    },

    initTheme() {
        const saved = localStorage.getItem('fulfillx.theme') || 'system';
        this.applyTheme(saved);
    },

    applyTheme(pref) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const useDark = pref === 'dark' || (pref === 'system' && prefersDark);
        // New: drive theme via data-theme on <html>
        document.documentElement.setAttribute('data-theme', useDark ? 'dark' : 'light');
        // Legacy: keep .theme-graphite class in sync (removes itself over phases)
        document.getElementById('appContainer')?.classList.toggle('theme-graphite', useDark);
        if (pref !== 'system') localStorage.setItem('fulfillx.theme', pref);
        else localStorage.setItem('fulfillx.theme', 'system');
    },

    updateGreeting() {
        const hour = new Date().getHours();
        // Name comes from onboarding (fulfillx.name); falls back to the prior
        // hardcoded default so existing installs greet exactly as before.
        const name = localStorage.getItem('fulfillx.name') || 'Daryl';
        const greeting = document.getElementById('greeting');
        let base;
        if (hour < 12) base = 'Good morning';
        else if (hour < 17) base = 'Good afternoon';
        else base = 'Good evening';
        greeting.textContent = `${base}, ${name}`;
        this._updateHomeEyebrow();
        this._updateHomeHero();
    },

    _updateHomeEyebrow() {
        const el = document.getElementById('home-eyebrow');
        if (!el) return;
        const now = new Date();
        el.textContent = now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
    },

    _updateHomeHero() {
        const hour    = new Date().getHours();
        const today   = this.getTodayKey ? this.getTodayKey() : localDateKey();
        const entries = this.getEntries ? this.getEntries() : {};
        const mDone   = !!(entries[today]?.morning && Object.keys(entries[today].morning).length);
        const eDone   = !!(entries[today]?.evening  && Object.keys(entries[today].evening).length);
        // Time logic: <12 → morning hero; 12–17 → first undone; ≥17 → evening hero
        let morningIsHero;
        if (hour < 12)       morningIsHero = true;
        else if (hour < 17)  morningIsHero = !mDone;
        else                 morningIsHero = false;
        // Completed session is always secondary
        if (mDone) morningIsHero = false;
        if (eDone && !mDone) morningIsHero = true;

        const bm   = document.getElementById('box-morning');
        const be   = document.getElementById('box-evening');
        const pill = document.getElementById('box-daytime');
        const list = document.querySelector('.home-journals');

        // Apply visual classes
        if (bm) { bm.classList.toggle('journal-hero', morningIsHero); bm.classList.toggle('journal-secondary', !morningIsHero); }
        if (be) { be.classList.toggle('journal-hero', !morningIsHero); be.classList.toggle('journal-secondary', morningIsHero); }

        // Set session-specific eyebrow label (read by CSS ::before via attr())
        if (bm) bm.dataset.heroLabel = '☀️  Next · Morning';
        if (be) be.dataset.heroLabel = '🌙  Next · Evening';

        // Reorder DOM so hero floats to top, secondary below, pill last
        if (list && bm && be && pill) {
            const hero = morningIsHero ? bm : be;
            const sec  = morningIsHero ? be : bm;
            list.insertBefore(hero, list.firstChild);
            list.insertBefore(sec, pill);
        }
    },

    updateQuote() {
        // VERIFIED QUOTE SEED — expand only with genuine, correctly attributed quotes.
        // TODO: add more quotes only after verifying against a reliable primary source.
        const quotes = [
            { text: "Your time is limited, so don't waste it living someone else's life.", author: "Steve Jobs" },
            { text: "We suffer more often in imagination than in reality.", author: "Seneca" },
            { text: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
            { text: "When we are no longer able to change a situation, we are challenged to change ourselves.", author: "Viktor E. Frankl" },
            { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
            { text: "You have power over your mind — not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
            { text: "The unexamined life is not worth living.", author: "Socrates" },
            { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
            { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
            { text: "Happiness is not something ready made. It comes from your own actions.", author: "Dalai Lama" },
            { text: "Act as if what you do makes a difference. It does.", author: "William James" },
            { text: "I have learned that people will forget what you said and did, but never how you made them feel.", author: "Maya Angelou" }
        ];
        // Use day of year so quote stays consistent through the day
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
        const quote = quotes[dayOfYear % quotes.length];
        document.getElementById('daily-quote-text').textContent = quote.text;
        document.getElementById('daily-quote-author').textContent = quote.author.toUpperCase();
    },


    /* ── TAB SWITCHING ────────────────────────────────── */
    switchTab(tab, el) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.journal-detail').forEach(d => d.classList.remove('active'));
        document.getElementById(tab).classList.add('active');
        if (el) el.classList.add('active');
        if (tab === 'insights') this.renderInsights();
        if (tab === 'habits')   this.renderHabits();
        if (tab === 'history')  this.renderHistory();
        // FAB is home-only
        const fab = document.getElementById('todoFab');
        if (fab) {
            if (tab === 'home') this.updateTodoFab();
            else fab.classList.remove('visible');
        }
    },

    openSettings() {
        document.getElementById('settings').classList.add('active');
        this.updateThemeButtons();
        this.renderCustomizationEditor();
        this.renderToolboxCustomizer();
    },

    closeSettings() {
        document.getElementById('settings').classList.remove('active');
    },

    setTheme(pref) {
        this.applyTheme(pref);
        this.updateThemeButtons();
    },

    updateThemeButtons() {
        const saved = localStorage.getItem('fulfillx.theme') || 'system';
        ['light', 'system', 'dark'].forEach(t => {
            document.getElementById('theme-' + t).classList.toggle('active', t === saved);
        });
    },

});

document.addEventListener('DOMContentLoaded', () => app.init());
