// js/tour.js — First-run feature tour (Build 3 of 3)
//
// A 7-slide, swipeable walkthrough shown ONCE on a genuine fresh install, and
// replayable anytime from Settings → About → Replay tour.
//
// DATA SAFETY:
//  • The tour writes exactly one key: fulfillx.tourSeen = 'true'. Nothing else.
//  • Existing users are auto-marked tourSeen (same philosophy as onboarding's
//    fulfillx.onboarded) so this update never pops the tour at them — only a
//    genuine fresh install sees it.
//  • Replaying from Settings sets NO flags and touches NO data.
//
// Launch order (see app.init): [App Lock gate] → TOUR → onboarding → home.
// "Get started"/Skip on first run sets tourSeen, then hands off to the EXISTING
// onboarding flow (this module does not duplicate or refactor onboarding).
//
// Previews are stylized inline SVG (no CDN, no live screenshots) so they never
// go stale; all fills are theme tokens via CSS classes — no raw colors.

const TOUR_SLIDES = [
    { icon: 'ph-house', label: 'Home', title: 'Your daily home',
      desc: 'Your greeting, today’s quote, your sessions, and the week at a glance — set the mood with light or warm-night themes.' },
    { icon: 'ph-notebook', label: 'Journals', title: 'Journal with intention',
      desc: 'Guided morning, daytime & evening check-ins to open and close your day.',
      badge: 'Customize', highlight: 'Customize the prompts & widgets' },
    { icon: 'ph-target', label: 'Habits', title: 'Build your habits',
      desc: 'Track what matters and keep your streaks going.',
      badge: 'Add your own', highlight: 'Add your own & schedule them' },
    { icon: 'ph-toolbox', label: 'Toolbox', title: 'Tools for the moment',
      desc: 'Quick exercises for whenever you need a reset.',
      badge: 'Reorder & hide', highlight: 'Show, hide & reorder the tools' },
    { icon: 'ph-chart-line-up', label: 'Insights', title: 'See your patterns',
      desc: 'Sleep, energy, effort & mood over time — tap any stat to explore.' },
    { icon: 'ph-clock-counter-clockwise', label: 'History', title: 'Look back',
      desc: 'Revisit past days, photos & streaks whenever you like.' },
    { icon: 'ph-gear', label: 'Settings', title: 'Make it yours',
      desc: 'Themes, reminders, journal & Toolbox customization, data backup — and you can replay this tour anytime.' },
];

Object.assign(app, {

    /* ── launch gate (fresh-install only) ─────────────────────
       Returns true when it has taken over the screen with the tour, so init()
       defers; _tourComplete() re-runs init() to hand off to onboarding. */
    maybeStartTour() {
        if (localStorage.getItem('fulfillx.tourSeen') === 'true') return false;

        // Existing user (already onboarded, or has prior app data) → silently
        // mark seen, never show the tour. Mirrors the onboarding migration.
        if (localStorage.getItem('fulfillx.onboarded') === 'true'
            || (typeof this._hasPriorFulfillxData === 'function' && this._hasPriorFulfillxData())) {
            localStorage.setItem('fulfillx.tourSeen', 'true');
            return false;
        }

        this._tourMode = 'firstrun';
        this._renderTour();
        return true;
    },

    // Settings → Replay tour. Opens the same carousel; sets no flags.
    replayTour() {
        this._tourMode = 'replay';
        this._renderTour();
    },

    /* ── carousel render ──────────────────────────────────── */
    _renderTour() {
        this._tourIndex = 0;
        const track = document.getElementById('tourTrack');
        const dots  = document.getElementById('tourDots');
        if (!track || !dots) return;

        track.innerHTML = TOUR_SLIDES.map((s, i) => `
            <div class="tour-slide" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${TOUR_SLIDES.length}">
                <div class="tour-preview">${this._tourSVG(s.label.toLowerCase())}</div>
                <div class="tour-copy">
                    <div class="tour-eyebrow"><i class="ph ${s.icon}"></i> ${s.label}</div>
                    <h2 class="tour-title">${s.title}</h2>
                    <p class="tour-desc">${s.desc}</p>
                    ${s.highlight ? `<div class="tour-highlight"><span class="tour-badge">${s.badge}</span><span>${s.highlight}</span></div>` : ''}
                </div>
            </div>`).join('');

        dots.innerHTML = TOUR_SLIDES.map((_, i) =>
            `<button class="tour-dot" aria-label="Go to slide ${i + 1}" onclick="app.tourGoTo(${i})"></button>`).join('');

        const ov = document.getElementById('tour');
        if (ov) { ov.classList.add('active'); ov.setAttribute('aria-hidden', 'false'); }
        this._attachTourSwipe();
        this._tourUpdate();
    },

    _tourUpdate() {
        const i = this._tourIndex;
        const last = TOUR_SLIDES.length - 1;
        const track = document.getElementById('tourTrack');
        if (track) track.style.transform = `translateX(${-i * 100}%)`;

        document.querySelectorAll('#tourDots .tour-dot')
            .forEach((d, idx) => d.classList.toggle('active', idx === i));

        const next = document.getElementById('tourNext');
        if (next) {
            next.textContent = i === 0 ? 'Take the tour'
                : i === last ? (this._tourMode === 'replay' ? 'Done' : 'Get started')
                : 'Next';
        }
    },

    tourGoTo(i) {
        this._tourIndex = Math.max(0, Math.min(TOUR_SLIDES.length - 1, i));
        this._tourUpdate();
    },

    tourNext() {
        if (this._tourIndex >= TOUR_SLIDES.length - 1) { this._tourPrimary(); return; }
        this._tourIndex++;
        this._tourUpdate();
    },

    tourPrev() {
        if (this._tourIndex <= 0) return;
        this._tourIndex--;
        this._tourUpdate();
    },

    // Last-slide primary action.
    _tourPrimary() {
        if (this._tourMode === 'replay') this._closeTour();
        else this._tourComplete();
    },

    // Skip is available on every slide.
    tourSkip() {
        if (this._tourMode === 'replay') this._closeTour();
        else this._tourComplete();
    },

    // First-run finish/skip: set the flag, then hand off to onboarding via init().
    _tourComplete() {
        localStorage.setItem('fulfillx.tourSeen', 'true');
        this._closeTour();
        // Resume the deferred boot: tourSeen is now set, so maybeStartTour()
        // returns false and maybeStartOnboarding() takes over (fresh install).
        this.init();
    },

    _closeTour() {
        const ov = document.getElementById('tour');
        if (ov) { ov.classList.remove('active'); ov.setAttribute('aria-hidden', 'true'); }
    },

    /* ── swipe (touch + pointer); Next button & dots also navigate ── */
    _attachTourSwipe() {
        if (this._tourSwipeBound) return;
        this._tourSwipeBound = true;
        const vp = document.getElementById('tourViewport');
        if (!vp) return;
        let x0 = null;
        const start = e => { x0 = (e.touches ? e.touches[0].clientX : e.clientX); };
        const end = e => {
            if (x0 === null) return;
            const x1 = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);
            const dx = x1 - x0;
            x0 = null;
            if (Math.abs(dx) < 45) return;
            if (dx < 0) this.tourNext(); else this.tourPrev();
        };
        vp.addEventListener('touchstart', start, { passive: true });
        vp.addEventListener('touchend', end);
        vp.addEventListener('pointerdown', start);
        vp.addEventListener('pointerup', end);
    },

    /* ── stylized SVG previews (token-colored via CSS classes) ──
       Deliberately abstract so they never need updating when screens change. */
    _tourSVG(key) {
        const frame = inner => `<svg viewBox="0 0 200 250" class="tour-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="6" y="6" width="188" height="238" rx="22" class="tp-screen"/>${inner}</svg>`;
        const badge = '<rect x="120" y="70" width="60" height="18" rx="9" class="tp-accent"/>';
        switch (key) {
            case 'home': return frame(`
                <rect x="22" y="26" width="90" height="12" rx="6" class="tp-soft"/>
                <rect x="22" y="48" width="120" height="8" rx="4" class="tp-line"/>
                <rect x="22" y="74" width="156" height="44" rx="12" class="tp-card"/>
                <rect x="34" y="88" width="60" height="8" rx="4" class="tp-accent"/>
                <rect x="22" y="128" width="156" height="44" rx="12" class="tp-card"/>
                <rect x="34" y="142" width="50" height="8" rx="4" class="tp-line"/>
                <g class="tp-dotrow">
                    <circle cx="34" cy="206" r="7" class="tp-accent"/><circle cx="58" cy="206" r="7" class="tp-line"/>
                    <circle cx="82" cy="206" r="7" class="tp-accent"/><circle cx="106" cy="206" r="7" class="tp-line"/>
                    <circle cx="130" cy="206" r="7" class="tp-line"/><circle cx="154" cy="206" r="7" class="tp-line"/>
                </g>`);
            case 'journals': return frame(`
                <rect x="22" y="26" width="70" height="10" rx="5" class="tp-line"/>${badge}
                <rect x="22" y="104" width="156" height="22" rx="8" class="tp-bar"/>
                <rect x="32" y="111" width="90" height="8" rx="4" class="tp-line"/>
                <rect x="22" y="136" width="156" height="22" rx="8" class="tp-bar"/>
                <rect x="32" y="143" width="110" height="8" rx="4" class="tp-accent"/>
                <rect x="22" y="168" width="156" height="22" rx="8" class="tp-bar"/>
                <rect x="32" y="175" width="70" height="8" rx="4" class="tp-line"/>`);
            case 'habits': return frame(`
                <rect x="22" y="26" width="70" height="10" rx="5" class="tp-line"/>${badge}
                <circle cx="34" cy="116" r="9" class="tp-accent"/><rect x="52" y="111" width="100" height="10" rx="5" class="tp-line"/>
                <circle cx="34" cy="148" r="9" class="tp-accent"/><rect x="52" y="143" width="80" height="10" rx="5" class="tp-line"/>
                <circle cx="34" cy="180" r="9" class="tp-soft"/><rect x="52" y="175" width="110" height="10" rx="5" class="tp-line"/>`);
            case 'toolbox': return frame(`
                <rect x="22" y="26" width="70" height="10" rx="5" class="tp-line"/>${badge}
                <rect x="22" y="104" width="72" height="56" rx="12" class="tp-card"/><circle cx="58" cy="124" r="10" class="tp-accent"/>
                <rect x="106" y="104" width="72" height="56" rx="12" class="tp-card"/><circle cx="142" cy="124" r="10" class="tp-soft"/>
                <rect x="22" y="170" width="72" height="56" rx="12" class="tp-card"/><circle cx="58" cy="190" r="10" class="tp-soft"/>
                <rect x="106" y="170" width="72" height="56" rx="12" class="tp-card"/><circle cx="142" cy="190" r="10" class="tp-accent"/>`);
            case 'insights': return frame(`
                <rect x="22" y="26" width="70" height="10" rx="5" class="tp-line"/>
                <rect x="30" y="150" width="26" height="60" rx="6" class="tp-accent"/>
                <rect x="66" y="120" width="26" height="90" rx="6" class="tp-soft"/>
                <rect x="102" y="96" width="26" height="114" rx="6" class="tp-accent"/>
                <rect x="138" y="134" width="26" height="76" rx="6" class="tp-soft"/>
                <rect x="22" y="216" width="156" height="6" rx="3" class="tp-line"/>`);
            case 'history': return frame(`
                <rect x="22" y="26" width="70" height="10" rx="5" class="tp-line"/>
                <g class="tp-cal">
                    ${[0,1,2,3,4,5,6].map(c => [0,1,2].map(r =>
                        `<circle cx="${30 + c * 24}" cy="${78 + r * 24}" r="7" class="${(c + r) % 4 === 0 ? 'tp-accent' : 'tp-line'}"/>`).join('')).join('')}
                </g>
                <rect x="22" y="166" width="72" height="56" rx="12" class="tp-soft"/>
                <rect x="106" y="166" width="72" height="56" rx="12" class="tp-card"/>`);
            case 'settings': return frame(`
                <rect x="22" y="26" width="70" height="10" rx="5" class="tp-line"/>
                ${[0,1,2,3].map(r => `
                    <rect x="22" y="${66 + r * 40}" width="156" height="30" rx="10" class="tp-bar"/>
                    <rect x="32" y="${74 + r * 40}" width="14" height="14" rx="4" class="tp-accent"/>
                    <rect x="56" y="${77 + r * 40}" width="${70 - r * 8}" height="8" rx="4" class="tp-line"/>`).join('')}`);
            default: return frame('');
        }
    },
});
