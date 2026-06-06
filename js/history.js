// js/history.js — history tab, month grid, day detail, week strip, photos

Object.assign(app, {
    /* ── V1.3 PHASE 6: WEEK STRIP ─────────────────────── */
    renderWeekStrip() {
        const strip = document.getElementById('weekStrip');
        if (!strip) return;
        const now   = new Date();
        const today = this.getTodayKey();
        const dow   = now.getDay(); // 0=Sun

        // Build the Sun–Sat week containing today
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(now);
            d.setDate(now.getDate() - dow + i);
            const dateStr = localDateKey(d);
            days.push({ date: dateStr, dayNum: d.getDate(), isCurrent: dateStr === today });
        }

        const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
        strip.innerHTML = days.map((day, i) => {
            const hasP = this.hasPhoto(day.date);
            const inner = hasP
                ? `<img src="" data-date="${day.date}" alt="">`
                : `<span class="week-day-num">${day.dayNum}</span>`;
            return `<div class="week-day${day.isCurrent ? ' current' : ''}" onclick="app.openHistoryOnDate('${day.date}')">
                <span class="week-day-label">${DAY_LABELS[i]}</span>
                <div class="week-day-circle">${inner}</div>
            </div>`;
        }).join('');

        // Load photos async
        strip.querySelectorAll('img[data-date]').forEach(img => {
            this.getPhoto(img.dataset.date).then(url => { if (url) img.src = url; });
        });
    },

    /* ── V1.3 PHASE 5: HISTORY ────────────────────────── */
    _historyYear:  null,
    _historyMonth: null,
    _historySelectedDate: null,

    initHistory() {
        const now = new Date();
        this._historyYear  = now.getFullYear();
        this._historyMonth = now.getMonth();
        this._historySelectedDate = this.getTodayKey();
    },

    renderHistory() {
        if (this._historyYear === null) this.initHistory();
        this._renderMonthGrid();
        this._renderDayDetail(this._historySelectedDate);
    },

    prevHistoryMonth() {
        if (this._historyMonth === 0) { this._historyYear--; this._historyMonth = 11; }
        else this._historyMonth--;
        this._renderMonthGrid();
    },

    nextHistoryMonth() {
        if (this._historyMonth === 11) { this._historyYear++; this._historyMonth = 0; }
        else this._historyMonth++;
        this._renderMonthGrid();
    },

    _renderMonthGrid() {
        const year  = this._historyYear;
        const month = this._historyMonth;
        const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const label = document.getElementById('history-month-label');
        if (label) label.textContent = `${MONTHS[month]} ${year}`;

        const firstDow   = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today      = this.getTodayKey();
        const entries    = this.getEntries();

        const DAY_HDRS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
        let html = DAY_HDRS.map(d => `<div class="month-day-header">${d}</div>`).join('');

        // Blank offset cells
        for (let i = 0; i < firstDow; i++) html += '<div class="month-day-cell empty"></div>';

        for (let d = 1; d <= daysInMonth; d++) {
            const date = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const isToday    = date === today;
            const isFuture   = date > today;
            const isSelected = date === this._historySelectedDate;
            const hasEntry   = !!(entries[date] && (entries[date].morning || entries[date].evening || entries[date].daytime));
            const hasP       = this.hasPhoto(date);

            let cls = 'month-day-cell';
            if (isToday)    cls += ' today';
            if (isSelected) cls += ' selected';
            if (hasEntry)   cls += ' has-entry';
            if (isFuture)   cls += ' future';

            const inner = hasP
                ? `<img src="" data-date="${date}" alt="photo">`
                : `<span class="month-day-num">${d}</span>`;
            html += `<div class="${cls}" data-date="${date}" onclick="app._selectHistoryDay('${date}')">${inner}</div>`;
        }

        const grid = document.getElementById('history-grid');
        if (grid) {
            grid.innerHTML = html;
            this._loadGridPhotos();
        }
    },

    _loadGridPhotos() {
        document.querySelectorAll('#history-grid img[data-date]').forEach(img => {
            this.getPhoto(img.dataset.date).then(url => { if (url) img.src = url; });
        });
    },

    _selectHistoryDay(date) {
        this._historySelectedDate = date;
        document.querySelectorAll('#history-grid .month-day-cell').forEach(c => {
            c.classList.toggle('selected', c.dataset.date === date);
        });
        this._renderDayDetail(date);
    },

    openHistoryOnDate(date) {
        if (this._historyYear === null) this.initHistory();
        const [y, m] = date.split('-').map(Number);
        this._historyYear  = y;
        this._historyMonth = m - 1;
        this._historySelectedDate = date;
        this.switchTab('history', document.getElementById('nav-history'));
    },

    _renderDayDetail(date) {
        const container = document.getElementById('history-detail');
        if (!container || !date) return;

        const entries = this.getEntries();
        const dayData = entries[date] || {};
        const config  = this.getConfig();
        const habits  = this.getHabits().filter(h => h.active);
        const dow     = new Date(date + 'T00:00:00').getDay();

        const [y, m, d] = date.split('-').map(Number);
        const dateLabel = new Date(y, m-1, d).toLocaleDateString('en-US', {
            weekday:'long', month:'long', day:'numeric', year:'numeric'
        });

        // Photo — 4:3 framed, tappable (src filled async below)
        const photoHtml = this.hasPhoto(date)
            ? `<div style="margin-bottom:14px"><img data-date="${date}" src="" alt="Day photo" class="detail-photo" onclick="app._openPhotoLightbox(this.src)"></div>`
            : '';

        // Build one collapsible section per journal slot
        const mkSection = (icon, label, type) => {
            const sdata   = type === 'daytime' ? (dayData.daytime || {}) : (dayData[type] || {});
            const hasData = type === 'daytime' ? !!(sdata.mood || sdata.note) : Object.keys(sdata).length > 0;
            const btn     = `<button class="cust-action-btn" onclick="app.openJournal('${type}','${date}')">${hasData ? 'Edit' : 'Fill in'}</button>`;

            let body = '';
            if (type === 'daytime') {
                if (sdata.mood) body += `<div style="font-size:26px;margin-bottom:6px">${sdata.mood}</div>`;
                if (sdata.note) body += `<div class="diary-readonly-field"><div class="diary-readonly-label">Note</div><div class="diary-readonly-value">${this._esc(sdata.note)}</div></div>`;
                const dtHabits = habits.filter(h => h.slots.includes('daytime') && h.days.includes(dow));
                if (dtHabits.length) {
                    const habitsData = dayData.habits || {};
                    body += `<div class="diary-readonly-field"><div class="diary-readonly-label">Habits</div>` +
                        dtHabits.map(h => {
                            const done = habitsData[h.id] || false;
                            return `<div class="hist-habit-row"><span style="color:${done?'var(--accent)':'var(--body-muted)'}">${done?'✓':'○'}</span><span style="color:${done?'var(--body-text)':'var(--body-muted)'}">${h.icon} ${h.name}</span></div>`;
                        }).join('') + `</div>`;
                }
            } else {
                (config[type] || []).forEach(w => {
                    const rendered = this._renderWidgetRO(w, sdata, dayData, habits, dow, type);
                    if (rendered) body += rendered;
                });
            }
            if (!body) body = `<p class="habit-empty" style="padding:2px 0">No entry yet.</p>`;

            return `<div style="margin-bottom:14px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <span style="font-family:'Baloo 2',sans-serif;font-size:14px;font-weight:600;color:var(--accent)">${icon} ${label}</span>
                    ${btn}
                </div>
                ${body}
            </div>`;
        };

        container.innerHTML = `<div class="day-detail-card">
            <div style="font-family:'Baloo 2',sans-serif;font-size:15px;font-weight:600;color:var(--heading-primary);margin-bottom:12px">${dateLabel}</div>
            ${photoHtml}
            ${mkSection('<i class="ph ph-sun-horizon"></i>','Morning','morning')}
            ${mkSection('<i class="ph ph-sun"></i>','Daytime','daytime')}
            ${mkSection('<i class="ph ph-moon-stars"></i>','Evening','evening')}
        </div>`;

        if (this.hasPhoto(date)) {
            this.getPhoto(date).then(url => {
                const img = container.querySelector('img[data-date]');
                if (img && url) img.src = url;
            });
        }
    },

    // Render a single widget's saved value as a compact read-only block
    _renderWidgetRO(w, sdata, dayData, habits, dow, journalType) {
        const val = sdata[w.id];
        switch (w.type) {
            case 'text':
            case 'maingoal':
                if (!val) return '';
                return `<div class="diary-readonly-field">
                    <div class="diary-readonly-label">${w.title}</div>
                    <div class="diary-readonly-value">${this._esc(String(val))}</div>
                </div>`;
            case 'sleep':
                if (!val || (!val.quality && !val.hours)) return '';
                return `<div class="diary-readonly-field">
                    <div class="diary-readonly-label">${w.title}</div>
                    <div class="diary-readonly-value">${[val.quality ? 'Quality ' + val.quality : '', val.hours ? val.hours + ' hrs' : ''].filter(Boolean).join(' · ')}</div>
                </div>`;
            case 'scale':
                if (!val) return '';
                return `<div class="diary-readonly-field">
                    <div class="diary-readonly-label">${w.title}</div>
                    <div class="diary-readonly-value">${val}${w.config.scaleMax ? ' / ' + w.config.scaleMax : ''}</div>
                </div>`;
            case 'number':
                if (val === '' || val == null) return '';
                return `<div class="diary-readonly-field">
                    <div class="diary-readonly-label">${w.title}</div>
                    <div class="diary-readonly-value">${val}</div>
                </div>`;
            case 'emoji':
                if (!val) return '';
                return `<div class="diary-readonly-field">
                    <div class="diary-readonly-label">${w.title}</div>
                    <div class="diary-readonly-value" style="font-size:24px">${val}</div>
                </div>`;
            case 'habits': {
                const scheduled = habits.filter(h => h.slots.includes(journalType) && h.days.includes(dow));
                if (!scheduled.length) return '';
                const habitsData = dayData.habits || {};
                return `<div class="diary-readonly-field">
                    <div class="diary-readonly-label">${w.title}</div>
                    ${scheduled.map(h => {
                        const done = habitsData[h.id] || false;
                        return `<div class="hist-habit-row"><span style="color:${done?'var(--accent)':'var(--body-muted)'}">${done?'✓':'○'}</span><span style="color:${done?'var(--body-text)':'var(--body-muted)'}">${h.icon} ${h.name}</span></div>`;
                    }).join('')}
                </div>`;
            }
            case 'goalreview': {
                if (!val || (!val.choice && !val.note)) return '';
                const parts = [];
                if (val.choice) parts.push('Worked toward it: ' + val.choice);
                if (val.note)   parts.push(this._esc(val.note));
                return `<div class="diary-readonly-field">
                    <div class="diary-readonly-label">${w.title}</div>
                    <div class="diary-readonly-value">${parts.join('<br>')}</div>
                </div>`;
            }
            case 'checklist':
            case 'schedule':
                if (!Array.isArray(val) || !val.length) return '';
                return `<div class="diary-readonly-field">
                    <div class="diary-readonly-label">${w.title}</div>
                    ${val.map(item => `<div class="hist-habit-row">
                        <span style="color:${item.done?'var(--accent)':'var(--body-muted)'}">${item.done?'✓':'○'}</span>
                        ${item.time ? `<span class="time-pill" style="font-size:10px">${this._esc(item.time)}</span>` : ''}
                        <span style="color:${item.done?'var(--body-muted)':'var(--body-text)'};${item.done?'text-decoration:line-through':''}">${this._esc(item.text)}</span>
                    </div>`).join('')}
                </div>`;
            default: return '';
        }
    },

    _openPhotoLightbox(src) {
        if (!src) return;
        const lb  = document.getElementById('photoLightbox');
        const img = document.getElementById('lightboxImg');
        if (!lb || !img) return;
        img.src = src;
        lb.style.display = 'flex';
    },

    /* ── V1.3 PHASE 4: PHOTO STORE (IndexedDB) ────────── */
    _photoDB: null,

    _openPhotoDB() {
        if (this._photoDB) return Promise.resolve(this._photoDB);
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('fulfillx', 1);
            req.onupgradeneeded = e => e.target.result.createObjectStore('photos');
            req.onsuccess = e => { this._photoDB = e.target.result; resolve(this._photoDB); };
            req.onerror  = e => reject(e.target.error);
        });
    },

    getPhoto(date) {
        return this._openPhotoDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction('photos', 'readonly');
            const req = tx.objectStore('photos').get(date);
            req.onsuccess = e => resolve(e.target.result || null);
            req.onerror   = e => reject(e.target.error);
        }));
    },

    setPhoto(date, fileInputOrBlob, rowId) {
        const file = fileInputOrBlob instanceof File ? fileInputOrBlob
            : (fileInputOrBlob.files && fileInputOrBlob.files[0]);
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const MAX = 1280;
                let { width: w, height: h } = img;
                if (w > MAX || h > MAX) {
                    if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                    else       { w = Math.round(w * MAX / h); h = MAX; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                this._openPhotoDB().then(db => {
                    const tx = db.transaction('photos', 'readwrite');
                    tx.objectStore('photos').put(dataUrl, date);
                    tx.oncomplete = () => {
                        this._updatePhotoIndex(date, true);
                        if (rowId) this._renderPhotoRow(rowId, date, dataUrl);
                        this.renderWeekStrip();
                    };
                });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        // Reset input so same file can be re-picked
        if (fileInputOrBlob.value !== undefined) fileInputOrBlob.value = '';
    },

    removePhoto(date, rowId) {
        this._openPhotoDB().then(db => {
            const tx = db.transaction('photos', 'readwrite');
            tx.objectStore('photos').delete(date);
            tx.oncomplete = () => {
                this._updatePhotoIndex(date, false);
                if (rowId) this._renderPhotoRow(rowId, date, null);
                this.renderWeekStrip();
            };
        });
    },

    hasPhoto(date) {
        const idx = JSON.parse(localStorage.getItem('fulfillx.photoIndex') || '[]');
        return idx.includes(date);
    },

    _updatePhotoIndex(date, add) {
        let idx = JSON.parse(localStorage.getItem('fulfillx.photoIndex') || '[]');
        if (add && !idx.includes(date)) idx.push(date);
        if (!add) idx = idx.filter(d => d !== date);
        localStorage.setItem('fulfillx.photoIndex', JSON.stringify(idx));
    },

    _renderPhotoRow(rowId, date, dataUrl) {
        const row = document.getElementById(rowId);
        if (!row) return;
        if (dataUrl) {
            row.innerHTML = `
                <img src="${dataUrl}" class="photo-thumb" alt="Day photo">
                <button class="photo-remove-btn" onclick="app.removePhoto('${date}','${rowId}')">Remove</button>`;
        } else {
            const inputId = rowId.replace('PhotoRow', 'PhotoInput');
            row.innerHTML = `
                <input type="file" id="${inputId}" accept="image/*" style="display:none"
                    onchange="app.setPhoto(app._journalDate||app.getTodayKey(),this,'${rowId}')">
                <button class="photo-pick-btn" onclick="document.getElementById('${inputId}').click()"><i class="ph ph-camera"></i> Add photo</button>`;
        }
    },

    _loadPhotoRow(rowId, date) {
        if (!this.hasPhoto(date)) return; // index says no photo — skip DB hit
        this.getPhoto(date).then(dataUrl => {
            if (dataUrl) this._renderPhotoRow(rowId, date, dataUrl);
        });
    },

});
