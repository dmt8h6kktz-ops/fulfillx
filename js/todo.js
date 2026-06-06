// js/todo.js — to-do widgets, FAB sheet, schedule reminders

Object.assign(app, {
    /* ── V1.3 PHASE 3: REMINDERS ──────────────────────── */
    _reminderToggle(widgetId, idx, enabled) {
        const items = this._widgetItems[widgetId];
        if (!items || idx >= items.length) return;
        if (!items[idx].reminder) items[idx].reminder = { enabled: false, lead: 'attime' };
        items[idx].reminder.enabled = enabled;
        if (enabled) this._requestNotificationPermission();
        this._renderTodoList(widgetId, 'schedule');
    },

    _reminderLead(widgetId, idx, lead) {
        const items = this._widgetItems[widgetId];
        if (!items || idx >= items.length) return;
        if (!items[idx].reminder) items[idx].reminder = { enabled: true, lead: 'attime' };
        items[idx].reminder.lead = lead;
    },

    _requestNotificationPermission() {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    },

    _startReminderPoller() {
        // Fires every 30 s while app is open; shows Web Notification or toast.
        // NATIVE HOOK: When Capacitor is added, replace this interval with
        // LocalNotifications.schedule() calls reading each item's reminder intent.
        this._firedReminders = this._firedReminders || new Set();
        setInterval(() => {
            const today = this.getTodayKey();
            const entries = this.getEntries();
            const config  = this.getConfig();
            const now = new Date();
            const hhmm = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

            ['morning','evening'].forEach(journal => {
                (config[journal] || []).forEach(w => {
                    if (w.type !== 'schedule') return;
                    const arr = entries[today]?.[journal]?.[w.id];
                    if (!Array.isArray(arr)) return;
                    arr.forEach((item, idx) => {
                        if (!item.time || !item.reminder?.enabled || item.done) return;
                        const fireTime = this._computeFireTime(item.time, item.reminder.lead);
                        const key = `${w.id}-${idx}-${fireTime}`;
                        if (this._firedReminders.has(key)) return;
                        if (hhmm >= fireTime && hhmm <= fireTime.replace(/(\d{2}):(\d{2})/, (_, h, m) => {
                            const tot = parseInt(h)*60+parseInt(m)+1;
                            return String(Math.floor(tot/60)).padStart(2,'0')+':'+String(tot%60).padStart(2,'0');
                        })) {
                            this._firedReminders.add(key);
                            this._fireReminder(item);
                        }
                    });
                });
            });
        }, 30000);
    },

    _computeFireTime(timeStr, lead) {
        const [h, m] = timeStr.split(':').map(Number);
        let mins = h * 60 + m;
        if (lead === '15min')  mins -= 15;
        else if (lead === '1hour') mins -= 60;
        if (mins < 0) mins = 0;
        return String(Math.floor(mins/60)).padStart(2,'0') + ':' + String(mins%60).padStart(2,'0');
    },

    _fireReminder(item) {
        const msg = `Reminder: ${item.text}`;
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('FulFillX', { body: msg, icon: '' });
        } else {
            this.showToast('🔔 ' + msg);
        }
    },

    /* ── V1.3 PHASE 2: FAB + TO-DO SHEET ─────────────── */
    _getTodayTodoItems() {
        const today = this.getTodayKey();
        const entries = this.getEntries();
        const config  = this.getConfig();
        const items = [];
        ['morning', 'evening'].forEach(journal => {
            (config[journal] || []).forEach(w => {
                if (w.type !== 'checklist' && w.type !== 'schedule') return;
                const saved = entries[today]?.[journal]?.[w.id];
                if (Array.isArray(saved)) {
                    saved.forEach((item, idx) => items.push({ item, widgetId: w.id, journal, idx, type: w.type }));
                }
            });
        });
        return items;
    },

    updateTodoFab() {
        const fab = document.getElementById('todoFab');
        if (!fab) return;
        const allItems = this._getTodayTodoItems();
        const hasAny = allItems.length > 0;
        fab.classList.toggle('visible', hasAny);
        const undone = allItems.filter(x => !x.item.done).length;
        const badge = document.getElementById('todoFabBadge');
        if (badge) {
            badge.textContent = undone;
            badge.style.display = undone > 0 ? 'flex' : 'none';
        }
    },

    openTodoSheet() {
        this.renderTodoSheet();
        document.getElementById('todoSheet').classList.add('active');
    },

    closeTodoSheet() {
        document.getElementById('todoSheet').classList.remove('active');
    },

    renderTodoSheet() {
        const allItems = this._getTodayTodoItems();
        const total = allItems.length;
        const done  = allItems.filter(x => x.item.done).length;

        const progress = document.getElementById('todoSheetProgress');
        if (progress) progress.textContent = total ? `${done} of ${total} done` : 'No tasks for today';

        const container = document.getElementById('todoSheetItems');
        if (!container) return;
        if (!total) { container.innerHTML = ''; return; }

        const timed   = allItems.filter(x => x.item.time).sort((a, b) => a.item.time.localeCompare(b.item.time));
        const anytime = allItems.filter(x => !x.item.time);

        let html = '';
        [...timed, ...anytime].forEach(({ item, widgetId, journal, idx, type }) => {
            const timePill = item.time ? `<span class="time-pill">${this._esc(item.time)}</span>` : '';
            html += `<div class="todo-item">
                <button class="todo-check${item.done ? ' done' : ''}"
                    onclick="app._sheetToggle('${widgetId}','${journal}',${idx},'${type}')">${item.done ? '✓' : ''}</button>
                ${timePill}
                <span class="todo-text${item.done ? ' done' : ''}">${this._esc(item.text)}</span>
            </div>`;
        });
        container.innerHTML = html;
    },

    _sheetToggle(widgetId, journal, idx, type) {
        const today = this.getTodayKey();
        const entries = this.getEntries();
        const arr = entries[today]?.[journal]?.[widgetId];
        if (!Array.isArray(arr) || idx >= arr.length) return;
        arr[idx].done = !arr[idx].done;
        this.saveEntries(entries);
        // Sync in-memory items if journal is open
        if (this._widgetItems[widgetId]) {
            this._widgetItems[widgetId] = arr;
            this._renderTodoList(widgetId, type);
        }
        this.renderTodoSheet();
        this.updateTodoFab();
    },

    todoSheetAdd() {
        const input = document.getElementById('todoSheetAddInput');
        const text = input ? input.value.trim() : '';
        if (!text) return;

        // Find the first checklist widget in morning (default) or evening
        const config = this.getConfig();
        let targetJournal = null, targetWidgetId = null;
        for (const journal of ['morning', 'evening']) {
            const w = (config[journal] || []).find(x => x.type === 'checklist' || x.type === 'schedule');
            if (w) { targetJournal = journal; targetWidgetId = w.id; break; }
        }
        if (!targetJournal) { this.showToast('Add a checklist widget to Morning first'); return; }

        const today = this.getTodayKey();
        const entries = this.getEntries();
        if (!entries[today]) entries[today] = {};
        if (!entries[today][targetJournal]) entries[today][targetJournal] = {};
        if (!Array.isArray(entries[today][targetJournal][targetWidgetId])) {
            entries[today][targetJournal][targetWidgetId] = [];
        }
        entries[today][targetJournal][targetWidgetId].push({ text, done: false });
        this.saveEntries(entries);
        // Sync in-memory widget if open
        if (this._widgetItems[targetWidgetId]) {
            this._widgetItems[targetWidgetId] = entries[today][targetJournal][targetWidgetId];
            this._renderTodoList(targetWidgetId, 'checklist');
        }
        if (input) input.value = '';
        this.renderTodoSheet();
        this.updateTodoFab();
    },

    /* ── V1.3 PHASE 1: TODO WIDGET HELPERS ───────────── */
    _renderTodoList(widgetId, widgetType) {
        const container = document.getElementById('w-' + widgetId + '-list');
        if (!container) return;
        const items = this._widgetItems[widgetId] || [];

        if (widgetType === 'checklist') {
            if (!items.length) {
                container.innerHTML = '<p class="habit-empty" style="padding:4px 0">No tasks yet — add one below.</p>';
                return;
            }
            container.innerHTML = items.map((item, i) =>
                `<div class="todo-item">
                    <button class="todo-check${item.done ? ' done' : ''}" onclick="app._todoToggle('${widgetId}','checklist',${i})">${item.done ? '✓' : ''}</button>
                    <span class="todo-text${item.done ? ' done' : ''}">${this._esc(item.text)}</span>
                </div>`
            ).join('');
        } else {
            const timed   = items.filter(x => x.time).slice().sort((a, b) => a.time.localeCompare(b.time));
            const anytime = items.filter(x => !x.time);
            if (!timed.length && !anytime.length) {
                container.innerHTML = '<p class="habit-empty" style="padding:4px 0">No items yet — add one below.</p>';
                return;
            }
            let html = '';
            timed.forEach(item => {
                const i = items.indexOf(item);
                const rem = item.reminder || { enabled: false, lead: 'attime' };
                const reminderHtml = `<div class="reminder-row">
                    <label class="reminder-toggle">
                        <input type="checkbox" ${rem.enabled ? 'checked' : ''}
                            onchange="app._reminderToggle('${widgetId}',${i},this.checked)"> Remind me
                    </label>
                    ${rem.enabled ? `<select class="reminder-lead" onchange="app._reminderLead('${widgetId}',${i},this.value)">
                        <option value="attime"  ${rem.lead==='attime'  ? 'selected' : ''}>At time</option>
                        <option value="15min"   ${rem.lead==='15min'   ? 'selected' : ''}>15 min before</option>
                        <option value="1hour"   ${rem.lead==='1hour'   ? 'selected' : ''}>1 hour before</option>
                    </select>` : ''}
                </div>`;
                html += `<div class="todo-item">
                    <button class="todo-check${item.done ? ' done' : ''}" onclick="app._todoToggle('${widgetId}','schedule',${i})">${item.done ? '✓' : ''}</button>
                    <span class="time-pill">${this._esc(item.time)}</span>
                    <span class="todo-text${item.done ? ' done' : ''}">${this._esc(item.text)}</span>
                </div>${reminderHtml}`;
            });
            if (anytime.length) {
                if (timed.length) html += `<div class="todo-group-heading">Anytime</div>`;
                anytime.forEach(item => {
                    const i = items.indexOf(item);
                    html += `<div class="todo-item">
                        <button class="todo-check${item.done ? ' done' : ''}" onclick="app._todoToggle('${widgetId}','schedule',${i})">${item.done ? '✓' : ''}</button>
                        <span class="todo-text${item.done ? ' done' : ''}">${this._esc(item.text)}</span>
                    </div>`;
                });
            }
            container.innerHTML = html;
        }
    },

    _todoToggle(widgetId, widgetType, idx) {
        const items = this._widgetItems[widgetId];
        if (!items || idx >= items.length) return;
        items[idx].done = !items[idx].done;
        this._renderTodoList(widgetId, widgetType);
        this.updateTodoFab();
    },

    _todoAdd(widgetId, widgetType) {
        const input = document.getElementById('w-' + widgetId + '-addinput');
        const text = input ? input.value.trim() : '';
        if (!text) return;
        if (!this._widgetItems[widgetId]) this._widgetItems[widgetId] = [];
        if (widgetType === 'checklist') {
            this._widgetItems[widgetId].push({ text, done: false });
        } else {
            const timeEl = document.getElementById('w-' + widgetId + '-addtime');
            const time = timeEl ? (timeEl.value || null) : null;
            this._widgetItems[widgetId].push({ text, time, done: false, reminder: { enabled: false, lead: 'attime' } });
            if (timeEl) timeEl.value = '';
        }
        if (input) input.value = '';
        this._renderTodoList(widgetId, widgetType);
    },

});
