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
        const el = document.getElementById('insights-content');
        if (!el) return;
        // Default overview — no drill-down active
        this._insightsDrilldown = null;
        this._renderInsightsOverview(el);
    },

    _renderInsightsOverview(el) {
        const w7  = this._aggregate(7);
        const w30 = this._aggregate(30);
        const MIN_DAYS = 4; // minimum logged days before showing tiles

        // Compute mood label (top 2 emotions this week, neutral)
        const moodLabel = (() => {
            const top = w7.emotions.sorted.slice(0, 2);
            return top.length ? top.map(([tag]) => tag).join(' · ') : null;
        })();

        // Goal stat: x days out of logged days with goal set
        const goalLabel = w7.goal.set > 0 ? `${w7.goal.set}/7` : null;

        const lowData = w7.journaling.daysLogged < MIN_DAYS;

        // Build tiles
        const tile = (id, value, label, trend) => `
            <div class="ins-tile" onclick="app._openInsightDrilldown('${id}')">
                <div class="ins-tile-caret">›</div>
                <div class="ins-tile-value">${value}</div>
                <div class="ins-tile-label">${label}</div>
                ${trend ? `<div class="ins-tile-trend">${trend}</div>` : ''}
            </div>`;

        const tilesHtml = lowData ? `
            <div class="ins-card" style="margin-bottom:10px">
                <div class="ins-empty" style="padding:6px 0">Your weekly picture fills in as you log — keep going 🌱<br><span style="font-size:12px">${w7.journaling.daysLogged} of 7 days so far</span></div>
            </div>` : `
            <div class="ins-tiles-grid">
                ${tile('sleep',  w7.sleep.avgHours != null ? w7.sleep.avgHours + ' hrs' : '—', 'Sleep avg')}
                ${tile('energy', w7.energy.avg != null ? w7.energy.avg + '/10' : '—', 'Energy avg')}
                ${tile('effort', w7.effort.avg != null ? w7.effort.avg + '/10' : '—', 'Effort avg')}
                ${tile('mood',   moodLabel || '—', 'Top feelings')}
                ${tile('habits', w7.habits.pct != null ? w7.habits.pct + '%' : '—', 'Habit rate')}
                ${tile('goal',   goalLabel || '—', 'Goal days')}
            </div>
            <div class="ins-hint">Tap any stat for the full breakdown</div>`;

        // Callout cards
        const callouts = this._buildCallouts(w7, w30);
        const calloutHtml = callouts.length ? callouts.map(c => `<div class="ins-callout">${c}</div>`).join('') : '';

        // Habit chart (inline bar chart)
        const habitChartHtml = this._habitBarChart(w7);

        // Journaling streak line
        const streakHtml = `<div class="ins-stat-row">
            <span class="ins-stat-label">Days journaled</span>
            <span class="ins-stat-val">${w7.journaling.daysLogged}/7 this week · ${w7.journaling.streak} day streak</span>
        </div>
        <div class="ins-stat-row">
            <span class="ins-stat-label">Total days logged</span>
            <span class="ins-stat-val">${Object.keys(this.getEntries()).length}</span>
        </div>`;

        el.innerHTML = `<div style="padding-bottom:20px">
            <div class="ins-section-title">This week</div>
            ${tilesHtml}
            ${calloutHtml || callouts.length === 0 ? '' : ''}
            ${calloutHtml ? `<div class="ins-card" style="margin-bottom:10px">${calloutHtml}</div>` : ''}
            <div class="ins-section-title">Habits this week</div>
            ${habitChartHtml}
            <div class="ins-section-title">Journal streak</div>
            <div class="ins-card">${streakHtml}</div>
        </div>`;
    },

    // Rule-based callouts — max 3, most notable first.
    _buildCallouts(w7, w30) {
        const out = [];
        const MIN = 4;
        if (w7.journaling.daysLogged < MIN) return out;

        // Sleep vs energy observation
        if (w7.sleep.count >= 3 && w7.energy.count >= 3) {
            const goodSleepDays   = w7.sleep.series.filter(d => d.hours >= 7);
            const poorSleepDays   = w7.sleep.series.filter(d => d.hours && d.hours < 6.5);
            const entries = this.getEntries();
            if (goodSleepDays.length >= 2 && w7.energy.avg) {
                out.push(`On days after 7+ hrs of sleep, your energy tends to stay higher — nice pattern this week.`);
            } else if (poorSleepDays.length >= 2) {
                out.push(`A couple of shorter nights this week. Protecting your sleep often shows up in energy the next day.`);
            }
        }

        // Habit momentum
        if (w7.habits.pct != null) {
            if (w7.habits.pct >= 80) out.push(`Strong habit week — ${w7.habits.pct}% of scheduled habits done. That consistency adds up.`);
            else if (w7.habits.pct >= 50) out.push(`You completed ${w7.habits.pct}% of your scheduled habits this week. Every one counts.`);
        }

        // Emotion presence
        if (w7.emotions.daysWithEmotions >= 3) {
            const top = w7.emotions.sorted[0];
            if (top) out.push(`"${top[0]}" showed up most this week (${top[1]}×). Noticing your feelings is its own kind of awareness.`);
        }

        // Goal follow-through
        if (w7.goal.set >= 3) {
            const followPct = Math.round((w7.goal.yes + w7.goal.partly * 0.5) / w7.goal.set * 100);
            if (followPct >= 70) out.push(`You moved toward your goals on most days you set one — great follow-through.`);
        }

        return out.slice(0, 3);
    },

    // Lightweight inline SVG habit bar chart for the week.
    _habitBarChart(w7) {
        if (!w7.habits.perHabit.length) return `<div class="ins-card"><div class="ins-empty">Add habits in the Habits tab to see your weekly chart here.</div></div>`;

        const days  = w7.dates.slice().reverse(); // oldest first
        const DAY   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
        const entries = this.getEntries();
        const habits  = this.getHabits().filter(h => h.active);

        // Bar heights: completion rate per day (0-1)
        const bars = days.map(date => {
            const dow = new Date(date + 'T00:00:00').getDay();
            const sched = habits.filter(h => h.days.includes(dow));
            if (!sched.length) return { label: DAY[dow], rate: null };
            const done = sched.filter(h => entries[date]?.habits?.[h.id]).length;
            return { label: DAY[dow], rate: done / sched.length };
        });

        const W = 280, H = 60, barW = Math.floor(W / bars.length) - 4;
        const svgBars = bars.map((b, i) => {
            const x = i * (W / bars.length) + 2;
            if (b.rate == null) return `<text x="${x + barW/2}" y="${H}" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="9" fill="var(--body-muted)">${b.label}</text>`;
            const bh = Math.max(4, Math.round(b.rate * (H - 16)));
            const fill = b.rate >= 0.8 ? 'var(--accent)' : b.rate >= 0.4 ? 'var(--accent-border)' : 'var(--border-card)';
            return `<rect x="${x}" y="${H - 12 - bh}" width="${barW}" height="${bh}" rx="3" fill="${fill}"/>
                    <text x="${x + barW/2}" y="${H}" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="9" fill="var(--body-muted)">${b.label}</text>`;
        }).join('');

        return `<div class="ins-card">
            <div class="ins-chart-wrap">
                <svg viewBox="0 0 ${W} ${H + 2}" xmlns="http://www.w3.org/2000/svg">${svgBars}</svg>
            </div>
            <div style="font-family:'Fredoka',sans-serif;font-size:11px;color:var(--body-muted);margin-top:4px">Daily habit completion · this week</div>
        </div>`;
    },

    /* ─── DRILL-DOWN ROUTER ───────────────────────────────────── */

    _openInsightDrilldown(id) {
        const el = document.getElementById('insights-content');
        if (!el) return;
        this._insightsDrilldown = id;
        const w7  = this._aggregate(7);
        const w30 = this._aggregate(30);
        const back = `<button class="ins-detail-back" onclick="app.renderInsights()">← Back to Insights</button>`;

        switch (id) {
            case 'sleep':  el.innerHTML = back + this._drillSleep(w7, w30);  break;
            case 'energy': el.innerHTML = back + this._drillScale10('energy', 'Energy', 'natural energy', w7, w30); break;
            case 'effort': el.innerHTML = back + this._drillScale10('effort', 'Effort', 'effort put in', w7, w30); break;
            case 'mood':   el.innerHTML = back + this._drillMood(w7, w30);   break;
            case 'habits': el.innerHTML = back + this._drillHabits(w7, w30); break;
            case 'goal':   el.innerHTML = back + this._drillGoal(w7, w30);   break;
            default:       el.innerHTML = back + '<div class="ins-empty">Coming soon.</div>';
        }
    },

    /* ─── SHARED HELPERS ──────────────────────────────────────── */

    // Tiny sparkline SVG for a series of values in [0, max].
    _sparkline(series, max, color) {
        const pts = series.filter(v => v != null);
        if (pts.length < 2) return '';
        const W = 260, H = 48;
        const vals = series.map(v => v ?? null);
        const step = W / (vals.length - 1);
        const points = vals.map((v, i) => {
            if (v == null) return null;
            return `${Math.round(i * step)},${Math.round(H - (v / max) * H)}`;
        }).filter(Boolean);
        if (points.length < 2) return '';
        return `<div class="ins-chart-wrap">
            <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
                <polyline points="${points.join(' ')}" fill="none" stroke="${color || 'var(--accent)'}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
                ${points.map(p => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="3" fill="${color || 'var(--accent)'}"/>`).join('')}
            </svg>
        </div>`;
    },

    _fmt(val, suffix) {
        return val != null ? val + (suffix || '') : '—';
    },

    /* ─── SLEEP DRILL-DOWN ────────────────────────────────────── */
    _drillSleep(w7, w30) {
        const s7  = w7.sleep,  s30 = w30.sleep;
        const spark = this._sparkline(s7.series.map(d => d.hours), 12, 'var(--accent)');
        const rows = [
            ['Avg hours (7 days)',   this._fmt(s7.avgHours,   ' hrs')],
            ['Avg quality (7 days)', this._fmt(s7.avgQuality, ' / 5')],
            ['Avg hours (30 days)',  this._fmt(s30.avgHours,  ' hrs')],
            ['Days logged',          s7.count + ' this week · ' + s30.count + ' this month'],
        ];
        const lowData = s7.count < 3;
        return `<div>
            <div class="ins-card-heading">Sleep</div>
            ${lowData ? `<div class="ins-empty">Log sleep quality in the Morning journal for a few days to see trends.</div>` : ''}
            ${spark ? `<div class="ins-card">${spark}<div style="font-family:'Fredoka',sans-serif;font-size:11px;color:var(--body-muted);margin-top:4px">Hours slept · this week (oldest → newest)</div></div>` : ''}
            <div class="ins-card">
                ${rows.map(([l,v]) => `<div class="ins-stat-row"><span class="ins-stat-label">${l}</span><span class="ins-stat-val">${v}</span></div>`).join('')}
            </div>
        </div>`;
    },

    /* ─── GENERIC SCALE10 DRILL-DOWN (energy / effort) ──────── */
    _drillScale10(field, title, desc, w7, w30) {
        const a7  = field === 'energy' ? w7.energy  : w7.effort;
        const a30 = field === 'energy' ? w30.energy : w30.effort;
        const spark = this._sparkline(a7.series.map(d => d.val), 10, 'var(--accent)');
        const lowData = a7.count < 3;
        return `<div>
            <div class="ins-card-heading">${title}</div>
            ${lowData ? `<div class="ins-empty">Log your ${desc} in the Evening journal for a few days to see trends here.</div>` : ''}
            ${spark ? `<div class="ins-card">${spark}<div style="font-family:'Fredoka',sans-serif;font-size:11px;color:var(--body-muted);margin-top:4px">${title} /10 · this week</div></div>` : ''}
            <div class="ins-card">
                <div class="ins-stat-row"><span class="ins-stat-label">Avg this week</span><span class="ins-stat-val">${this._fmt(a7.avg, ' / 10')}</span></div>
                <div class="ins-stat-row"><span class="ins-stat-label">Avg this month</span><span class="ins-stat-val">${this._fmt(a30.avg, ' / 10')}</span></div>
                <div class="ins-stat-row"><span class="ins-stat-label">Days logged</span><span class="ins-stat-val">${a7.count} this week · ${a30.count} this month</span></div>
            </div>
        </div>`;
    },

    /* ─── MOOD / EMOTIONS DRILL-DOWN ─────────────────────────── */
    _drillMood(w7, w30) {
        const e7  = w7.emotions;
        const e30 = w30.emotions;
        const lowData = e7.daysWithEmotions < 3;

        // Frequency rows for this week
        const freqRows7  = e7.sorted.slice(0, 10).map(([tag, cnt]) =>
            `<div class="ins-stat-row"><span class="ins-stat-label">${tag}</span><span class="ins-stat-val">×${cnt}</span></div>`
        ).join('');

        // Top emotions last 30 days
        const top30 = e30.sorted.slice(0, 5).map(([tag, cnt]) => `${tag} ×${cnt}`).join(' · ');

        // Balance note (neutral, observational)
        const balanceNote = (() => {
            const total = e7.pleasant + e7.difficult;
            if (total < 4) return '';
            const pPct = Math.round(e7.pleasant / total * 100);
            if (pPct >= 65) return `This week you felt a good mix — with more energising feelings in the mix.`;
            if (pPct <= 35) return `It's been a heavier week for many people. Your feelings are valid — the awareness matters.`;
            return `A balanced mix of feelings this week — highs and lows are both part of it.`;
        })();

        return `<div>
            <div class="ins-card-heading">Feelings this week</div>
            ${lowData ? `<div class="ins-empty">Log emotions in the Evening journal for a few days to see your patterns here.</div>` : ''}
            ${balanceNote ? `<div class="ins-callout" style="margin-bottom:10px">${balanceNote}</div>` : ''}
            ${!lowData && freqRows7 ? `<div class="ins-card"><div class="ins-card-heading" style="font-size:13px;margin-bottom:8px">This week</div>${freqRows7}</div>` : ''}
            ${top30 ? `<div class="ins-card"><div class="ins-card-heading" style="font-size:13px;margin-bottom:4px">Top feelings · last 30 days</div><div style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-text);line-height:1.8">${top30}</div></div>` : ''}
        </div>`;
    },

    /* ─── HABITS DRILL-DOWN ───────────────────────────────────── */
    _drillHabits(w7, w30) {
        const h7 = w7.habits, h30 = w30.habits;
        const perHabitRows = h7.perHabit.map(({h, done, sched, pct, streak}) =>
            `<div class="ins-stat-row">
                <span class="ins-stat-label">${h.icon} ${h.name}</span>
                <span class="ins-stat-val">${done}/${sched}${streak > 1 ? ' · ' + streak + '🔥' : ''}</span>
            </div>`
        ).join('');

        return `<div>
            <div class="ins-card-heading">Habits</div>
            <div class="ins-card">
                <div class="ins-stat-row"><span class="ins-stat-label">Completion this week</span><span class="ins-stat-val">${this._fmt(h7.pct, '%')}</span></div>
                <div class="ins-stat-row"><span class="ins-stat-label">Completion this month</span><span class="ins-stat-val">${this._fmt(h30.pct, '%')}</span></div>
            </div>
            ${perHabitRows ? `<div class="ins-card">${perHabitRows}</div>` : '<div class="ins-empty">No habits with data yet.</div>'}
            ${this._habitBarChart(w7)}
        </div>`;
    },

    /* ─── GOAL DRILL-DOWN ─────────────────────────────────────── */
    _drillGoal(w7, w30) {
        const g7  = w7.goal,  g30 = w30.goal;
        const lowData = g7.set < 3;
        const followPct7 = g7.set ? Math.round((g7.yes + g7.partly * 0.5) / g7.set * 100) : null;

        return `<div>
            <div class="ins-card-heading">Goal follow-through</div>
            ${lowData ? `<div class="ins-empty">Set a morning goal for a few days to track your follow-through here.</div>` : ''}
            <div class="ins-card">
                <div class="ins-stat-row"><span class="ins-stat-label">Goals set this week</span><span class="ins-stat-val">${g7.set}/7 days</span></div>
                ${followPct7 != null ? `<div class="ins-stat-row"><span class="ins-stat-label">Follow-through rate</span><span class="ins-stat-val">${followPct7}%</span></div>` : ''}
                <div class="ins-stat-row"><span class="ins-stat-label">Yes / Partly / No</span><span class="ins-stat-val">${g7.yes} · ${g7.partly} · ${g7.no}</span></div>
                <div class="ins-stat-row"><span class="ins-stat-label">Goals set this month</span><span class="ins-stat-val">${g30.set} days</span></div>
            </div>
        </div>`;
    },

});
