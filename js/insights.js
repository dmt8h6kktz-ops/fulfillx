// js/insights.js — insights tab

Object.assign(app, {
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
