// js/journals.js — journal widget engine, render/save/load, customization editor

Object.assign(app, {
    /* ── WIDGET ENGINE ────────────────────────────────── */
    renderJournal(type) {
        const config = this.getConfig();
        const widgets = config[type] || [];
        const container = document.getElementById(type + 'Widgets');
        if (!container) return;
        container.innerHTML = '';
        widgets.forEach(w => container.appendChild(this.buildWidget(w, type)));
    },

    buildWidget(w, journalType) {
        const box = document.createElement('div');
        box.className = 'widget-box';
        const title = `<div class="widget-title">${w.title}</div>`;
        const prompt = w.config.prompt ? `<div class="widget-prompt">${w.config.prompt}</div>` : '';

        switch (w.type) {
            case 'text':
                box.innerHTML = `${title}${prompt}<textarea id="w-${w.id}" placeholder="Write here..."></textarea>`;
                break;

            case 'maingoal':
                box.innerHTML = `${title}${prompt}<input type="text" id="w-${w.id}" class="hours-input" placeholder="My main goal today is...">`;
                break;

            case 'sleep': {
                const max = w.config.scaleMax || 5;
                const btns = Array.from({length: max}, (_, i) => i + 1).map(n =>
                    `<button class="scale-btn" onclick="app.selectScale(this,'w-${w.id}-q')">${n}</button>`
                ).join('');
                box.innerHTML = `${title}<div class="sleep-scale" id="w-${w.id}-q">${btns}</div>
                    <input type="number" id="w-${w.id}-h" placeholder="${w.config.numberLabel || 'Hours'}" class="hours-input" style="margin-top:8px" step="0.5" min="0" max="24">`;
                break;
            }

            case 'scale': {
                const max = w.config.scaleMax || 5;
                const btns = Array.from({length: max}, (_, i) => i + 1).map(n =>
                    `<button class="scale-btn" onclick="app.selectScale(this,'w-${w.id}')">${n}</button>`
                ).join('');
                box.innerHTML = `${title}${prompt}<div class="sleep-scale" id="w-${w.id}">${btns}</div>`;
                break;
            }

            case 'number':
                box.innerHTML = `${title}<input type="number" id="w-${w.id}" class="hours-input" placeholder="${w.config.label || ''}">`;
                break;

            case 'habits': {
                const journalDate = this._journalDate || this.getTodayKey();
                const journalDow  = new Date(journalDate + 'T00:00:00').getDay();
                const scheduled = this.getHabits().filter(
                    h => h.active && h.slots.includes(journalType) && h.days.includes(journalDow)
                );
                if (!scheduled.length) {
                    box.innerHTML = `${title}<p class="habit-empty">No habits scheduled — add some in the Habits tab.</p>`;
                } else {
                    const checks = scheduled.map(h => {
                        const iid = 'w-' + w.id + '-' + h.id;
                        return `<div class="habit-check"><input type="checkbox" id="${iid}" onchange="app.syncHabit('${h.id}',this.checked)"><label for="${iid}">${h.icon} ${h.name}</label></div>`;
                    }).join('');
                    box.innerHTML = `${title}${checks}`;
                }
                break;
            }

            case 'emoji': {
                const emojis = w.config.emojis || ['😔','😐','😊','😄'];
                const btns = emojis.map(e =>
                    `<button class="emoji-btn" onclick="app.selectEmoji(this,'w-${w.id}')">${e}</button>`
                ).join('');
                box.innerHTML = `${title}<div class="emoji-scale" id="w-${w.id}">${btns}</div>`;
                break;
            }

            case 'goalreview':
                box.innerHTML = `${title}
                    <div class="goal-review-goal" id="w-${w.id}-goaltext"></div>
                    <div class="widget-prompt goal-review-q" id="w-${w.id}-q">Did you work toward it?</div>
                    <div class="goal-review-btns" id="w-${w.id}-btns">
                        <button class="goal-review-btn" id="w-${w.id}-yes"    onclick="app.selectGoalReview('yes','${w.id}')">Yes</button>
                        <button class="goal-review-btn" id="w-${w.id}-partly" onclick="app.selectGoalReview('partly','${w.id}')">Partly</button>
                        <button class="goal-review-btn" id="w-${w.id}-no"     onclick="app.selectGoalReview('no','${w.id}')">No</button>
                    </div>
                    <textarea id="w-${w.id}-note" placeholder="Any notes..." style="margin-top:10px"></textarea>`;
                break;

            case 'checklist':
                this._widgetItems[w.id] = [];
                box.innerHTML = `${title}<div id="w-${w.id}-list"></div>
                    <div class="todo-add-row">
                        <input type="text" class="todo-add-input" id="w-${w.id}-addinput" placeholder="Add a task..."
                            onkeydown="if(event.key==='Enter')app._todoAdd('${w.id}','checklist')">
                        <button class="todo-add-btn" onclick="app._todoAdd('${w.id}','checklist')">+</button>
                    </div>`;
                break;

            case 'schedule':
                this._widgetItems[w.id] = [];
                box.innerHTML = `${title}<div id="w-${w.id}-list"></div>
                    <div class="todo-add-row">
                        <input type="text" class="todo-add-input" id="w-${w.id}-addinput" placeholder="Add item..."
                            onkeydown="if(event.key==='Enter')app._todoAdd('${w.id}','schedule')">
                        <input type="time" class="todo-add-time" id="w-${w.id}-addtime">
                        <button class="todo-add-btn" onclick="app._todoAdd('${w.id}','schedule')">+</button>
                    </div>`;
                break;

            default:
                box.innerHTML = `${title}<p class="widget-prompt">Unknown widget type: ${w.type}</p>`;
        }
        return box;
    },

    selectScale(btn, containerId) {
        document.querySelectorAll('#' + containerId + ' .scale-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    },

    selectEmoji(btn, containerId) {
        document.querySelectorAll('#' + containerId + ' .emoji-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    },

    syncHabit(habitId, checked) {
        const today = this._journalDate || this.getTodayKey();
        const entries = this.getEntries();
        if (!entries[today]) entries[today] = {};
        if (!entries[today].habits) entries[today].habits = {};
        entries[today].habits[habitId] = checked;
        this.saveEntries(entries);
        this.updateCompletionBadges();
    },

    renderDaytimeHabits(habitsData) {
        const container = document.getElementById('daytimeHabitsContainer');
        const box = document.getElementById('daytimeHabitsBox');
        if (!container) return;
        const todayDow = new Date().getDay();
        const scheduled = this.getHabits().filter(h => h.active && h.slots.includes('daytime') && h.days.includes(todayDow));
        if (!scheduled.length) {
            container.innerHTML = '<p class="habit-empty">No habits scheduled — add some in the Habits tab.</p>';
            if (box) box.style.display = '';
        } else {
            container.innerHTML = scheduled.map(h =>
                `<div class="habit-check"><input type="checkbox" id="daytime-h-${h.id}" ${habitsData[h.id] ? 'checked' : ''} onchange="app.syncHabit('${h.id}',this.checked)"><label for="daytime-h-${h.id}">${h.icon} ${h.name}</label></div>`
            ).join('');
            if (box) box.style.display = '';
        }
    },

    readWidgetValue(w) {
        switch (w.type) {
            case 'text':
            case 'maingoal':
                return document.getElementById('w-' + w.id)?.value || '';
            case 'sleep':
                return {
                    quality: document.querySelector('#w-' + w.id + '-q .scale-btn.active')?.textContent || '',
                    hours:   document.getElementById('w-' + w.id + '-h')?.value || ''
                };
            case 'scale':
                return document.querySelector('#w-' + w.id + ' .scale-btn.active')?.textContent || '';
            case 'number':
                return document.getElementById('w-' + w.id)?.value || '';
            case 'habits':
                return null; // handled via syncHabit / saveJournal special-case
            case 'emoji':
                return document.querySelector('#w-' + w.id + ' .emoji-btn.active')?.textContent || '';
            case 'goalreview':
                return { choice: this.goalReviewChoice || '', note: document.getElementById('w-' + w.id + '-note')?.value || '' };
            case 'checklist':
            case 'schedule':
                return this._widgetItems[w.id] ? [...this._widgetItems[w.id]] : [];
            default: return '';
        }
    },

    restoreWidgetValue(w, value) {
        if (value === undefined || value === null) {
            if (w.type === 'checklist' || w.type === 'schedule') {
                this._widgetItems[w.id] = [];
                this._renderTodoList(w.id, w.type);
            }
            return;
        }
        switch (w.type) {
            case 'text':
            case 'maingoal': {
                const el = document.getElementById('w-' + w.id);
                if (el) el.value = value;
                break;
            }
            case 'sleep': {
                document.querySelectorAll('#w-' + w.id + '-q .scale-btn').forEach(b =>
                    b.classList.toggle('active', b.textContent === String(value.quality)));
                const h = document.getElementById('w-' + w.id + '-h');
                if (h) h.value = value.hours || '';
                break;
            }
            case 'scale':
                document.querySelectorAll('#w-' + w.id + ' .scale-btn').forEach(b =>
                    b.classList.toggle('active', b.textContent === String(value)));
                break;
            case 'number': {
                const el = document.getElementById('w-' + w.id);
                if (el) el.value = value;
                break;
            }
            case 'habits':
                // Restored in loadJournalData from entries[date].habits
                break;
            case 'emoji':
                document.querySelectorAll('#w-' + w.id + ' .emoji-btn').forEach(b =>
                    b.classList.toggle('active', b.textContent === value));
                break;
            case 'checklist':
            case 'schedule':
                this._widgetItems[w.id] = Array.isArray(value) ? value : [];
                this._renderTodoList(w.id, w.type);
                break;
        }
    },


    openJournal(type, date) {
        this.currentJournal = type;
        this._journalDate = date || this.getTodayKey();
        this.goalReviewChoice = null;
        document.getElementById(type + 'Detail').classList.add('active');
        if (type === 'morning' || type === 'evening') {
            this.renderJournal(type);
            this._loadPhotoRow(type + 'PhotoRow', this._journalDate);
        }
        this.loadJournalData(type);
    },

    closeJournal() {
        document.querySelectorAll('.journal-detail').forEach(d => d.classList.remove('active'));
        this.currentJournal = null;
    },

    getTodayKey() {
        return localDateKey();
    },

    saveJournal(type) {
        const today = this._journalDate || this.getTodayKey();
        const entries = this.getEntries();
        if (!entries[today]) entries[today] = {};

        if (type === 'morning' || type === 'evening') {
            const config = this.getConfig();
            const data = {};
            const todayDow = new Date(today + 'T00:00:00').getDay();
            if (!entries[today].habits) entries[today].habits = {};
            (config[type] || []).forEach(w => {
                if (w.type === 'habits') {
                    // Merge any rendered habit checkboxes into shared entries[date].habits
                    const scheduled = this.getHabits().filter(
                        h => h.active && h.slots.includes(type) && h.days.includes(todayDow)
                    );
                    scheduled.forEach(h => {
                        const cb = document.getElementById('w-' + w.id + '-' + h.id);
                        if (cb) entries[today].habits[h.id] = cb.checked;
                    });
                } else {
                    const val = this.readWidgetValue(w);
                    if (val !== null) data[w.id] = val;
                }
            });
            entries[today][type] = data;
        } else if (type === 'daytime') {
            entries[today].daytime = {
                mood: document.querySelector('#daytimeMood .emoji-btn.active')?.dataset.mood || '',
                note: document.getElementById('daytimeNote').value
            };
            // Merge daytime habit checkboxes into shared entries[date].habits
            if (!entries[today].habits) entries[today].habits = {};
            const todayDow = new Date().getDay(); // daytime always uses real today
            this.getHabits().filter(h => h.active && h.slots.includes('daytime') && h.days.includes(todayDow))
                .forEach(h => {
                    const cb = document.getElementById('daytime-h-' + h.id);
                    if (cb) entries[today].habits[h.id] = cb.checked;
                });
        }

        this.saveEntries(entries);
        this.showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} saved! ✓`);
        this.updateCompletionBadges();
        this.updateTodoFab();
        if (this._historySelectedDate === today) this._renderDayDetail(today);
        this.closeJournal();
    },

    loadJournalData(type) {
        const today = this._journalDate || this.getTodayKey();
        const entries = this.getEntries();
        const todayData = entries[today] || {};

        if (type === 'morning' || type === 'evening') {
            const config = this.getConfig();
            const data = todayData[type] || {};
            const habitsData = todayData.habits || {};
            const todayDow = new Date(today + 'T00:00:00').getDay();
            (config[type] || []).forEach(w => {
                if (w.type === 'goalreview') {
                    const goal = todayData.morning?.maingoal || '';
                    this.goalReviewChoice = data[w.id]?.choice || null;
                    this.populateGoalReview(goal, w.id);
                    const noteEl = document.getElementById('w-' + w.id + '-note');
                    if (noteEl) noteEl.value = data[w.id]?.note || '';
                    ['yes','partly','no'].forEach(k => {
                        const btn = document.getElementById('w-' + w.id + '-' + k);
                        if (btn) btn.classList.toggle('active', k === this.goalReviewChoice);
                    });
                } else if (w.type === 'habits') {
                    const scheduled = this.getHabits().filter(
                        h => h.active && h.slots.includes(type) && h.days.includes(todayDow)
                    );
                    scheduled.forEach(h => {
                        const cb = document.getElementById('w-' + w.id + '-' + h.id);
                        if (cb) cb.checked = habitsData[h.id] || false;
                    });
                } else {
                    this.restoreWidgetValue(w, data[w.id]);
                }
            });
        } else if (type === 'daytime') {
            const data = todayData.daytime || {};
            document.getElementById('daytimeNote').value = data.note || '';
            document.querySelectorAll('#daytimeMood .emoji-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.mood === data.mood));
            this.renderDaytimeHabits(todayData.habits || {});
        }
    },

    populateGoalReview(goalText, widgetId) {
        const elGoal = document.getElementById('w-' + widgetId + '-goaltext');
        const elQ    = document.getElementById('w-' + widgetId + '-q');
        const elBtns = document.getElementById('w-' + widgetId + '-btns');
        if (!elGoal) return;
        if (goalText) {
            elGoal.textContent = goalText;
            elGoal.style.fontStyle = '';
            if (elQ)    elQ.style.display = '';
            if (elBtns) elBtns.style.display = '';
        } else {
            elGoal.textContent = 'No morning goal set — open Morning to add one.';
            elGoal.style.fontStyle = 'italic';
            if (elQ)    elQ.style.display = 'none';
            if (elBtns) elBtns.style.display = 'none';
        }
    },

    selectGoalReview(choice, widgetId) {
        this.goalReviewChoice = choice;
        ['yes','partly','no'].forEach(k => {
            const btn = document.getElementById('w-' + widgetId + '-' + k);
            if (btn) btn.classList.toggle('active', k === choice);
        });
    },

    updateCompletionBadges() {
        const today = this.getTodayKey();
        const todayData = this.getEntries()[today] || {};

        ['morning', 'evening'].forEach(type => {
            const box = document.getElementById('box-' + type);
            if (!box) return;
            const existing = box.querySelector('.completion-check');
            const done = todayData[type] && Object.keys(todayData[type]).length > 0;
            if (done) {
                box.classList.add('completed');
                if (!existing) {
                    const check = document.createElement('div');
                    check.className = 'completion-check';
                    check.textContent = '✓';
                    box.appendChild(check);
                }
            } else {
                box.classList.remove('completed');
                if (existing) existing.remove();
            }
        });

        const pill = document.getElementById('box-daytime');
        if (pill) pill.classList.toggle('completed', !!todayData.daytime);
    },

    renderEmojiScale() {
        const container = document.getElementById('daytimeMood');
        // data-mood stores the legacy emoji value so existing saved moods load correctly
        const MOODS = [
            { val:'😔', icon:'ph-smiley-sad' },
            { val:'😐', icon:'ph-smiley-meh' },
            { val:'😊', icon:'ph-smiley'     },
            { val:'😄', icon:'ph-smiley-wink' }
        ];
        MOODS.forEach(({ val, icon }) => {
            const btn = document.createElement('button');
            btn.className = 'emoji-btn';
            btn.dataset.mood = val;
            btn.innerHTML = `<i class="ph ${icon}"></i>`;
            btn.onclick = function() {
                document.querySelectorAll('#daytimeMood .emoji-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            };
            container.appendChild(btn);
        });
    },


    /* ── PHASE 6: CUSTOMIZATION EDITOR ──────────────────── */
    renderCustomizationEditor() {
        this.renderCustJournalList('morning');
        this.renderCustJournalList('evening');
    },

    renderCustJournalList(journal) {
        const config = this.getConfig();
        const widgets = config[journal] || [];
        const container = document.getElementById('cust-' + journal + '-list');
        if (!container) return;
        container.innerHTML = '';
        widgets.forEach((w, idx) => {
            const row = document.createElement('div');
            row.className = 'cust-widget-row';
            row.innerHTML = `
                <div class="cust-widget-reorder">
                    <button class="cust-reorder-btn" ${idx === 0 ? 'disabled' : ''} onclick="app.moveWidget('${journal}','${w.id}',-1)" title="Move up">↑</button>
                    <button class="cust-reorder-btn" ${idx === widgets.length - 1 ? 'disabled' : ''} onclick="app.moveWidget('${journal}','${w.id}',1)" title="Move down">↓</button>
                </div>
                <div class="cust-widget-info">
                    <span class="cust-widget-type">${w.type}</span>
                    <span class="cust-widget-title">${w.title}</span>
                </div>
                <div class="cust-widget-actions">
                    <button class="cust-action-btn" onclick="app.editWidget('${journal}','${w.id}')">Edit</button>
                    <button class="cust-action-btn del" onclick="app.removeWidget('${journal}','${w.id}')">✕</button>
                </div>`;
            container.appendChild(row);
        });
    },

    moveWidget(journal, id, dir) {
        const config = this.getConfig();
        const arr = config[journal];
        const idx = arr.findIndex(w => w.id === id);
        if (idx < 0) return;
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= arr.length) return;
        [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
        this.saveConfig(config);
        this.renderCustJournalList(journal);
    },

    removeWidget(journal, id) {
        const config = this.getConfig();
        config[journal] = config[journal].filter(w => w.id !== id);
        this.saveConfig(config);
        this.renderCustJournalList(journal);
    },

    resetJournal(journal) {
        const config = this.getConfig();
        config[journal] = JSON.parse(JSON.stringify(DEFAULT_CONFIG[journal]));
        this.saveConfig(config);
        this.renderCustJournalList(journal);
        this.showToast(`${journal.charAt(0).toUpperCase() + journal.slice(1)} reset to defaults`);
    },

    showAddWidget(journal) {
        this._editingJournal = journal;
        this._editingWidgetId = null;
        document.getElementById('we-heading').textContent = 'Add Widget';
        document.getElementById('we-type').value = 'text';
        document.getElementById('we-title').value = '';
        document.getElementById('we-prompt').value = '';
        document.getElementById('we-items').value = '';
        const smElNew = document.getElementById('we-scalemax');
        if (smElNew) smElNew.value = '5';
        this.onWeTypeChange();
        document.getElementById('widgetEditor').classList.add('active');
    },

    editWidget(journal, id) {
        const config = this.getConfig();
        const w = config[journal]?.find(x => x.id === id);
        if (!w) return;
        this._editingJournal = journal;
        this._editingWidgetId = id;
        document.getElementById('we-heading').textContent = 'Edit Widget';
        document.getElementById('we-type').value = w.type;
        document.getElementById('we-title').value = w.title;
        document.getElementById('we-prompt').value = w.config.prompt || '';
        document.getElementById('we-items').value = (w.config.items || []).join(', ');
        const smEl = document.getElementById('we-scalemax');
        if (smEl) smEl.value = String(w.config.scaleMax || 5);
        this.onWeTypeChange();
        document.getElementById('widgetEditor').classList.add('active');
    },

    onWeTypeChange() {
        const type = document.getElementById('we-type').value;
        const hasPrompt = ['text','maingoal','scale'].includes(type);
        const hasItems  = type === 'habits';
        const hasScale  = type === 'scale';
        document.getElementById('we-prompt-row').style.display = hasPrompt ? '' : 'none';
        document.getElementById('we-items-row').style.display  = hasItems  ? '' : 'none';
        document.getElementById('we-scale-row').style.display  = hasScale  ? '' : 'none';
    },

    saveWidgetEditor() {
        const type   = document.getElementById('we-type').value;
        const title  = document.getElementById('we-title').value.trim();
        const prompt = document.getElementById('we-prompt').value.trim();
        const items  = document.getElementById('we-items').value.split(',').map(s => s.trim()).filter(Boolean);
        if (!title) { this.showToast('Please enter a title'); return; }

        const config = this.getConfig();
        const journal = this._editingJournal;
        const editId  = this._editingWidgetId;

        const cfg = {};
        if (prompt) cfg.prompt = prompt;
        if (items.length) cfg.items = items;
        if (type === 'sleep') { cfg.scaleMax = 5; cfg.numberLabel = 'Hours slept'; }
        if (type === 'scale') { cfg.scaleMax = parseInt(document.getElementById('we-scalemax')?.value || '5'); }

        if (editId) {
            const w = config[journal].find(x => x.id === editId);
            if (w) { w.title = title; w.type = type; w.config = cfg; }
        } else {
            const newId = type + '-' + Date.now();
            config[journal].push({ id: newId, type, title, config: cfg });
        }

        this.saveConfig(config);
        this.renderCustJournalList(journal);
        this.closeWidgetEditor();
    },

    closeWidgetEditor() {
        document.getElementById('widgetEditor').classList.remove('active');
    },

});
