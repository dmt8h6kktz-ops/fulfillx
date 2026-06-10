// js/app.js — bootstrap, navigation, settings, theme; runs on DOMContentLoaded

Object.assign(app, {
    init() {
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
        const container = document.getElementById('appContainer');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const useDark = pref === 'dark' || (pref === 'system' && prefersDark);
        container.classList.toggle('theme-graphite', useDark);
        if (pref !== 'system') localStorage.setItem('fulfillx.theme', pref);
        else localStorage.setItem('fulfillx.theme', 'system');
    },

    updateGreeting() {
        const hour = new Date().getHours();
        const greeting = document.getElementById('greeting');
        if (hour < 12) greeting.textContent = 'Good morning';
        else if (hour < 17) greeting.textContent = 'Good afternoon';
        else greeting.textContent = 'Good evening';
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
        document.getElementById('daily-quote-text').textContent = `"${quote.text}"`;
        document.getElementById('daily-quote-author').textContent = `— ${quote.author}`;
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
