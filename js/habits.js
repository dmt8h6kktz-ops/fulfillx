// js/habits.js — habit manager

Object.assign(app, {
    /* ── HABITS MANAGER ───────────────────────────────────── */
    renderHabits() {
        const habits = this.getHabits().filter(h => h.active);
        const container = document.getElementById('habits-content');

        const SUGGESTIONS = [
            { name: 'Reading',        icon: '📖', slots: ['evening'],  days: [0,1,2,3,4,5,6] },
            { name: 'Running',         icon: '🏃', slots: ['morning'],  days: [1,3,5] },
            { name: 'Exercise / Gym',  icon: '💪', slots: ['daytime'],  days: [1,3,5] },
            { name: 'Walking',         icon: '🚶', slots: ['daytime'],  days: [0,1,2,3,4,5,6] },
            { name: 'Meditation',      icon: '🧘', slots: ['morning'],  days: [0,1,2,3,4,5,6] },
            { name: 'Breathwork',      icon: '🌬️', slots: ['morning'],  days: [0,1,2,3,4,5,6] },
            { name: 'Language study',  icon: '🗣️', slots: ['evening'],  days: [0,1,2,3,4,5,6] },
            { name: 'Journaling',      icon: '✍️', slots: ['morning'],  days: [0,1,2,3,4,5,6] },
            { name: 'Stretching',      icon: '🤸', slots: ['morning'],  days: [0,1,2,3,4,5,6] }
        ];
        const activeNames = new Set(habits.map(h => h.name.toLowerCase()));
        const suggestions = SUGGESTIONS.filter(s => !activeNames.has(s.name.toLowerCase()));

        const listHtml = !habits.length ? `
            <div class="widget-box">
                <p class="habit-empty" style="text-align:center;padding:6px 0">No habits yet — add your first one.</p>
            </div>
            <button class="add-widget-btn" style="margin-bottom:12px" onclick="app.showAddHabit()">+ Add habit</button>` : `
            <div class="widget-box" style="padding-bottom:4px">
                <div class="widget-title" style="margin-bottom:10px">Your habits</div>
                ${habits.map(h => `
                    <div class="habit-manager-item">
                        <div class="habit-manager-info">
                            <span class="habit-manager-icon">${h.icon}</span>
                            <div>
                                <div class="habit-manager-name">${h.name}</div>
                                <div class="habit-schedule-summary">${this.scheduleSummary(h)}</div>
                            </div>
                        </div>
                        <div class="habit-manager-actions">
                            <button class="cust-action-btn" onclick="app.editHabit('${h.id}')">Edit</button>
                            <button class="cust-action-btn del" onclick="app.removeHabit('${h.id}')">Remove</button>
                        </div>
                    </div>`).join('')}
                <button class="add-widget-btn" style="margin-top:8px" onclick="app.showAddHabit()">+ Add habit</button>
            </div>`;

        const suggHtml = suggestions.length ? `
            <div class="widget-box" style="margin-top:12px">
                <div class="widget-title" style="margin-bottom:10px">Try a new habit</div>
                ${suggestions.map((s, idx) => `
                    <div class="habit-manager-item" style="${idx === suggestions.length-1 ? 'border-bottom:none' : ''}">
                        <div class="habit-manager-info">
                            <span class="habit-manager-icon">${s.icon}</span>
                            <div>
                                <div class="habit-manager-name">${s.name}</div>
                                <div class="habit-schedule-summary">${this.scheduleSummary(s)}</div>
                            </div>
                        </div>
                        <button class="cust-action-btn" onclick="app.trySuggestedHabit(${idx})">Try</button>
                    </div>`).join('')}
            </div>` : '';

        container.innerHTML = listHtml + suggHtml;
        container.dataset.suggestions = JSON.stringify(suggestions);
    },

    trySuggestedHabit(idx) {
        const suggestions = JSON.parse(document.getElementById('habits-content').dataset.suggestions || '[]');
        const s = suggestions[idx];
        if (!s) return;
        const habits = this.getHabits();
        const alreadyExists = habits.some(h => h.name.toLowerCase() === s.name.toLowerCase() && h.active);
        if (alreadyExists) { this.showToast('Already in your habits'); return; }
        habits.push({ id: 'h_' + Date.now(), name: s.name, icon: s.icon, slots: s.slots, days: s.days, active: true });
        this.saveHabits(habits);
        this.renderHabits();
        this.showToast(`${s.name} added!`);
    },

    scheduleSummary(h) {
        const slotLabel = { morning: 'Morning', daytime: 'Daytime', evening: 'Evening' };
        const slots = (h.slots || []).map(s => slotLabel[s] || s).join(' & ');
        const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const d = (h.days || []).slice().sort((a,b)=>a-b);
        let days;
        if (d.length === 7) days = 'Every day';
        else if (d.join() === '1,2,3,4,5') days = 'Weekdays';
        else if (d.join() === '0,6') days = 'Weekends';
        else days = d.map(n => DAY[n]).join(', ');
        return `${slots} · ${days}`;
    },

    showAddHabit() {
        this._editingHabitId = null;
        document.getElementById('he-heading').textContent = 'Add Habit';
        document.getElementById('he-name').value = '';
        document.getElementById('he-icon').value = '';
        document.querySelectorAll('.he-slot-cb').forEach(cb => cb.checked = false);
        this.setHabitDays([0,1,2,3,4,5,6]);
        document.getElementById('habitEditor').classList.add('active');
    },

    editHabit(id) {
        const h = this.getHabits().find(x => x.id === id);
        if (!h) return;
        this._editingHabitId = id;
        document.getElementById('he-heading').textContent = 'Edit Habit';
        document.getElementById('he-name').value = h.name;
        document.getElementById('he-icon').value = h.icon;
        document.querySelectorAll('.he-slot-cb').forEach(cb => cb.checked = h.slots.includes(cb.value));
        this.setHabitDays(h.days);
        document.getElementById('habitEditor').classList.add('active');
    },

    closeHabitEditor() {
        document.getElementById('habitEditor').classList.remove('active');
    },

    setHabitDays(days) {
        document.querySelectorAll('.he-day-btn').forEach(btn =>
            btn.classList.toggle('active', days.includes(parseInt(btn.dataset.day))));
    },

    toggleHabitDay(btn) {
        btn.classList.toggle('active');
    },

    getHabitDays() {
        return Array.from(document.querySelectorAll('.he-day-btn.active'))
            .map(b => parseInt(b.dataset.day)).sort((a,b) => a-b);
    },

    saveHabitEditor() {
        const name  = document.getElementById('he-name').value.trim();
        const icon  = document.getElementById('he-icon').value.trim() || '✨';
        const slots = Array.from(document.querySelectorAll('.he-slot-cb:checked')).map(cb => cb.value);
        const days  = this.getHabitDays();
        if (!name)         { this.showToast('Please enter a habit name'); return; }
        if (!slots.length) { this.showToast('Pick at least one time slot'); return; }
        if (!days.length)  { this.showToast('Pick at least one day'); return; }

        const habits = this.getHabits();
        if (this._editingHabitId) {
            const h = habits.find(x => x.id === this._editingHabitId);
            if (h) Object.assign(h, { name, icon, slots, days });
        } else {
            habits.push({ id: 'h_' + Date.now(), name, icon, slots, days, active: true });
        }
        this.saveHabits(habits);
        this.closeHabitEditor();
        this.renderHabits();
        this.showToast(this._editingHabitId ? 'Habit updated' : 'Habit added');
    },

    removeHabit(id) {
        if (!confirm('Remove this habit? It will disappear from journals, but past history is kept.')) return;
        const habits = this.getHabits();
        const h = habits.find(x => x.id === id);
        if (h) h.active = false;
        this.saveHabits(habits);
        this.renderHabits();
        this.showToast('Habit removed');
    },

});
