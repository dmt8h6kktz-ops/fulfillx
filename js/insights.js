// js/insights.js — aggregation layer + insights tab

// Internal emotion grouping — never surfaced as "good/bad" to the user.
const PLEASANT_EMOTIONS = new Set(['Happy','Calm','Grateful','Content','Excited','Motivated','Energized','Proud','Hopeful']);

Object.assign(app, {

    /* ─── AGGREGATION LAYER ──────────────────────────────────── */

    // Returns an array of date strings for the last N days (today inclusive).
    _dateRange(n) {
        const days = [];
        for (let i = 0; i < n; i++) {
            const d = new Date(); d.setDate(d.getDate() - i);
            days.push(localDateKey(d));
        }
        return days; // [today, yesterday, ...]
    },

    // Average of a number array, null if empty.
    _avg(arr) {
        const valid = arr.filter(v => v != null && !isNaN(v));
        return valid.length ? Math.round((valid.reduce((a,b) => a+b, 0) / valid.length) * 10) / 10 : null;
    },

    // Journaling stats over a date range.
    _aggJournaling(dates, entries) {
        const logged = dates.filter(d => {
            const e = entries[d];
            return e && (Object.keys(e.morning || {}).length || Object.keys(e.evening || {}).length || e.daytime);
        });
        // Streak: consecutive days ending today
        let streak = 0;
        for (let i = 0; i < dates.length; i++) {
            if (logged.includes(dates[i])) streak++;
            else break;
        }
        return { daysLogged: logged.length, streak };
    },

    // Sleep stats (morning.sleep).
    _aggSleep(dates, entries) {
        const hours   = [], quality = [];
        dates.forEach(d => {
            const s = entries[d]?.morning?.sleep;
            if (!s) return;
            if (s.hours)   hours.push(parseFloat(s.hours));
            if (s.quality) quality.push(parseInt(s.quality));
        });
        const series = dates.map(d => {
            const s = entries[d]?.morning?.sleep;
            return { date: d, hours: s?.hours ? parseFloat(s.hours) : null, quality: s?.quality ? parseInt(s.quality) : null };
        });
        return { avgHours: this._avg(hours), avgQuality: this._avg(quality), series, count: hours.length };
    },

    // Energy stats (evening.energy).
    _aggEnergy(dates, entries) {
        const vals = dates.map(d => entries[d]?.evening?.energy ?? null).filter(v => v != null);
        const series = dates.map(d => ({ date: d, val: entries[d]?.evening?.energy ?? null }));
        return { avg: this._avg(vals), series, count: vals.length };
    },

    // Effort stats (evening.effort).
    _aggEffort(dates, entries) {
        const vals = dates.map(d => entries[d]?.evening?.effort ?? null).filter(v => v != null);
        const series = dates.map(d => ({ date: d, val: entries[d]?.evening?.effort ?? null }));
        return { avg: this._avg(vals), series, count: vals.length };
    },

    // Emotion frequency + balance (evening.emotions).
    _aggEmotions(dates, entries) {
        const freq = {};
        let pleasant = 0, difficult = 0, totalTagged = 0;
        dates.forEach(d => {
            const ems = entries[d]?.evening?.emotions;
            if (!Array.isArray(ems)) return;
            ems.forEach(tag => {
                freq[tag] = (freq[tag] || 0) + 1;
                totalTagged++;
                if (PLEASANT_EMOTIONS.has(tag)) pleasant++;
                else difficult++;
            });
        });
        const sorted = Object.entries(freq).sort((a,b) => b[1]-a[1]);
        const daysWithEmotions = dates.filter(d => Array.isArray(entries[d]?.evening?.emotions) && entries[d].evening.emotions.length).length;
        return { freq, sorted, pleasant, difficult, totalTagged, daysWithEmotions };
    },

    // Habit completion over dates.
    _aggHabits(dates, entries, habits) {
        const active = habits.filter(h => h.active);
        let schedTotal = 0, doneTotal = 0;
        const perHabit = active.map(h => {
            let sched = 0, done = 0;
            dates.forEach(d => {
                const dow = new Date(d + 'T00:00:00').getDay();
                if (h.days.includes(dow)) { sched++; if (entries[d]?.habits?.[h.id]) done++; }
            });
            schedTotal += sched; doneTotal += done;
            const streak = this._habitStreak(h, entries);
            return { h, sched, done, pct: sched ? Math.round(done/sched*100) : null, streak };
        }).filter(x => x.sched > 0);
        return { pct: schedTotal ? Math.round(doneTotal/schedTotal*100) : null, perHabit, schedTotal, doneTotal };
    },

    _habitStreak(h, entries) {
        let streak = 0;
        for (let i = 0; i < 60; i++) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const dow = d.getDay();
            if (!h.days.includes(dow)) continue;
            const dateKey = localDateKey(d);
            if (entries[dateKey]?.habits?.[h.id]) streak++;
            else break;
        }
        return streak;
    },

    // Goal follow-through (evening.goalreview.choice).
    _aggGoal(dates, entries) {
        let yes = 0, partly = 0, no = 0, set = 0;
        dates.forEach(d => {
            const gr = entries[d]?.evening?.goalreview;
            if (!gr?.choice) return;
            set++;
            if (gr.choice === 'yes')    yes++;
            else if (gr.choice === 'partly') partly++;
            else                        no++;
        });
        return { yes, partly, no, set, total: dates.length };
    },

    // Tools usage over dates.
    _aggTools(dates, toolEntries, toolUsage) {
        const dateSet = new Set(dates);
        return TOOL_REGISTRY.map(t => {
            const entries = (toolEntries[t.id] || []).filter(e => dateSet.has(e.date));
            const usageDates = (toolUsage[t.id] || []).filter(d => dateSet.has(d));
            return { t, entryCount: entries.length, usageCount: usageDates.length, entries };
        }).filter(x => x.entryCount || x.usageCount);
    },

    // Master aggregation call — returns all stats for last N days.
    _aggregate(n) {
        const dates   = this._dateRange(n);
        const entries = this.getEntries();
        const habits  = this.getHabits();
        const toolEntries = this.getToolEntries();
        const toolUsage   = JSON.parse(localStorage.getItem('fulfillx.toolUsage') || '{}');
        return {
            dates,
            journaling: this._aggJournaling(dates, entries),
            sleep:      this._aggSleep(dates, entries),
            energy:     this._aggEnergy(dates, entries),
            effort:     this._aggEffort(dates, entries),
            emotions:   this._aggEmotions(dates, entries),
            habits:     this._aggHabits(dates, entries, habits),
            goal:       this._aggGoal(dates, entries),
            tools:      this._aggTools(dates, toolEntries, toolUsage),
        };
    },

    renderInsights() {
        const today = this.getTodayKey();
        const entries = this.getEntries();
        const todayData = entries[today] || {};

        let completed = 0;
        if (todayData.morning && Object.keys(todayData.morning).length > 0) completed++;
        if (todayData.daytime) completed++;
        if (todayData.evening && Object.keys(todayData.evening).length > 0) completed++;

        const totalDays = Object.keys(entries).length;
        const sleepHours = todayData.morning?.sleep?.hours;

        // Habit consistency: scheduled instances vs completed over last 7 days
        const habits = this.getHabits().filter(h => h.active);
        let schedInstances = 0, doneInstances = 0;
        const habitConsistency = habits.map(h => {
            let scheduled = 0, done = 0;
            for (let i = 0; i < 7; i++) {
                const d = new Date(); d.setDate(d.getDate() - i);
                const dow = d.getDay();
                if (h.days.includes(dow)) {
                    scheduled++;
                    const dateKey = localDateKey(d);
                    if (entries[dateKey]?.habits?.[h.id]) done++;
                }
            }
            schedInstances += scheduled;
            doneInstances += done;
            return { h, scheduled, done };
        }).filter(x => x.scheduled > 0);

        const consistencyPct = schedInstances > 0 ? Math.round((doneInstances / schedInstances) * 100) : null;

        const habitRows = habitConsistency.length ? habitConsistency.map(({h, scheduled, done}) =>
            `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-card)">
                <span style="font-family:'Fredoka',sans-serif;font-size:14px;color:var(--body-text)">${h.icon} ${h.name}</span>
                <span style="font-family:'Baloo 2',sans-serif;font-size:13px;font-weight:600;color:var(--accent)">${done}/${scheduled}</span>
            </div>`
        ).join('') : `<p class="habit-empty">No scheduled habits yet — add some in the Habits tab.</p>`;

        // Toolbox readout
        const toolEntries = this.getToolEntries();
        const toolUsage   = JSON.parse(localStorage.getItem('fulfillx.toolUsage') || '{}');
        const toolRows = TOOL_REGISTRY.map(t => {
            const entryCount = (toolEntries[t.id] || []).length;
            const usageDates = toolUsage[t.id] || [];
            const lastUsed = entryCount > 0
                ? (toolEntries[t.id][0].date)
                : (usageDates.length > 0 ? usageDates[usageDates.length - 1] : null);
            if (!entryCount && !usageDates.length) return null;
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-card)">
                <span style="font-family:'Fredoka',sans-serif;font-size:14px;color:var(--body-text)">${t.icon} ${t.name}</span>
                <span style="font-family:'Baloo 2',sans-serif;font-size:12px;font-weight:600;color:var(--accent)">${entryCount ? entryCount + ' entr' + (entryCount === 1 ? 'y' : 'ies') : 'used ' + usageDates.length + '×'}${lastUsed ? ' · ' + lastUsed : ''}</span>
            </div>`;
        }).filter(Boolean).join('');

        document.getElementById('insights-content').innerHTML = `
            <div style="padding-bottom: 20px;">
                <div class="insight-stat">
                    <div class="insight-stat-label">Today's Journals</div>
                    <div class="insight-stat-value">${completed}/3</div>
                    <div class="insight-stat-desc">${completed === 3 ? 'Complete! Amazing work 🎉' : 'Keep building your ritual'}</div>
                </div>
                ${sleepHours ? `
                <div class="insight-stat">
                    <div class="insight-stat-label">Sleep Last Night</div>
                    <div class="insight-stat-value">${sleepHours} hrs</div>
                    <div class="insight-stat-desc">Quality sleep impacts everything</div>
                </div>` : ''}
                <div class="insight-stat">
                    <div class="insight-stat-label">Days Journaled</div>
                    <div class="insight-stat-value">${totalDays}</div>
                    <div class="insight-stat-desc">Total days you've shown up</div>
                </div>
                <div class="insight-stat">
                    <div class="insight-stat-label">Habit consistency · 7 days</div>
                    <div class="insight-stat-value">${consistencyPct !== null ? consistencyPct + '%' : '—'}</div>
                    <div class="insight-stat-desc" style="margin-bottom:10px">${consistencyPct !== null ? 'of scheduled habit instances completed' : 'Start tracking to see consistency'}</div>
                    ${habitRows}
                </div>
                <div class="insight-stat">
                    <div class="insight-stat-label">Toolbox</div>
                    ${toolRows || `<p class="habit-empty">No tools used yet — try one from the Toolbox tab.</p>`}
                </div>
            </div>
        `;
    },

});
