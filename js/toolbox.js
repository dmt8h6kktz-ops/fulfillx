// js/toolbox.js — tool registry, diary engine, all tools, tool history

Object.assign(app, {
    renderToolbox() {
        const groups = [
            { key:'moment',  label:'In the moment' },
            { key:'reflect', label:'Reflect & journal' },
            { key:'know',    label:'Know yourself' }
        ];
        const grid = document.getElementById('toolbox-grid');
        let html = '';
        groups.forEach(g => {
            const tools = TOOL_REGISTRY.filter(t => t.group === g.key);
            if (!tools.length) return;
            html += `<div class="tool-group-heading">${g.label}</div>`;
            tools.forEach(t => {
                html += `<div class="tool-list-card" onclick="app.openTool('${t.id}')">
                    <div class="tool-list-card-row">
                        <span class="tool-list-icon"><i class="ph ${t.icon}"></i></span>
                        <div class="tool-list-body">
                            <div class="tool-list-name">${t.name}</div>
                            <div class="tool-list-purpose">${t.purpose}</div>
                            <div class="tool-list-credit">${t.credit}</div>
                        </div>
                        <button class="tool-info-btn" onclick="event.stopPropagation();app.openToolInfo('${t.id}')" aria-label="Info">i</button>
                    </div>
                </div>`;
            });
        });
        grid.innerHTML = html;
    },

    openToolInfo(toolId) {
        const t = TOOL_REGISTRY.find(x => x.id === toolId);
        if (!t) return;
        document.getElementById('toolInfoTitle').innerHTML   = `<i class="ph ${t.icon}" style="margin-right:6px"></i>${t.name}`;
        document.getElementById('toolInfoCredit').textContent  = t.credit;
        document.getElementById('toolInfoUse').textContent     = t.infoUse;
        document.getElementById('toolInfoExample').textContent = t.infoExample;
        document.getElementById('toolInfoOverlay').classList.add('active');
    },

    closeToolInfo() {
        document.getElementById('toolInfoOverlay').classList.remove('active');
    },

    openTool(toolId) {
        const t = TOOL_REGISTRY.find(x => x.id === toolId);
        if (!t) return;
        this._currentToolId = toolId;
        document.getElementById('toolScreenTitle').innerHTML = `<i class="ph ${t.icon}" style="margin-right:6px"></i>${t.name}`;
        this._renderToolScreen(t);
        document.getElementById('toolScreen').classList.add('active');
    },

    closeTool() {
        if (this._mdInProgress) {
            if (!confirm('Leave Mind Dump?\n\nYour current dump will be lost. Press Cancel to go back and tap Done when you\'re ready.')) return;
            if (this._dumpTimer) { clearInterval(this._dumpTimer); this._dumpTimer = null; }
            this._mdInProgress = false;
        }
        document.getElementById('toolScreen').classList.remove('active');
        this._currentToolId = null;
    },

    _renderToolScreen(tool) {
        const el = document.getElementById('toolScreenContent');
        if (!el) return;
        // Routes to the appropriate flow renderer; stubs filled in later phases
        switch (tool.type) {
            case 'diary':        return this._renderDiaryFlow(tool, el);
            case 'braindump':    return this._renderBraindump(tool, el);
            case 'minddump':     return this._renderMindDump(tool, el);
            case 'grounding':    return this._renderGrounding(tool, el);
            case 'statepractice':return this._renderNSReset(tool, el);
            case 'attachment':   return this._renderAttachment(tool, el);
            case 'ladder':       return this._renderObserver(tool, el);
            case 'bullseye':     return this._renderValues(tool, el);
            default:
                el.innerHTML = `<p class="habit-empty" style="text-align:center;padding:24px 0">${tool.icon}<br><br>${tool.name}<br><br>Coming soon</p>`;
        }
    },

    /* ── V1.4 PHASE 2: TOOL ENTRIES STORE ─────────────── */
    getToolEntries() {
        return JSON.parse(localStorage.getItem('fulfillx.toolEntries') || '{}');
    },
    saveToolEntries(entries) {
        localStorage.setItem('fulfillx.toolEntries', JSON.stringify(entries));
    },
    addToolEntry(toolId, data) {
        const entries = this.getToolEntries();
        if (!entries[toolId]) entries[toolId] = [];
        entries[toolId].unshift({ date: this.getTodayKey(), ts: Date.now(), data });
        this.saveToolEntries(entries);
    },
    logToolUsage(toolId) {
        const usage = JSON.parse(localStorage.getItem('fulfillx.toolUsage') || '{}');
        if (!usage[toolId]) usage[toolId] = [];
        const today = this.getTodayKey();
        if (!usage[toolId].includes(today)) usage[toolId].push(today);
        localStorage.setItem('fulfillx.toolUsage', JSON.stringify(usage));
    },

    /* ── V1.5: ONE-STEP-PER-SCREEN DIARY ENGINE ─────────── */
    _renderDiaryFlow(tool, el) {
        this._diaryState = this._diaryState || {};
        this._diaryState[tool.id] = { step: 0, data: {} };
        this._doDiaryStep(tool, el);
    },

    _doDiaryStep(tool, el) {
        const state  = this._diaryState[tool.id];
        const steps  = tool.config.steps || [];
        const idx    = state.step;
        if (idx >= steps.length) { this._renderDiaryReview(tool, el); return; }
        const s      = steps[idx];
        const total  = steps.length;
        const saved  = state.data[s.key] || '';
        const chips  = s.chipSource ? this._getDiaryChips(tool.id, s.key) : [];
        const chipHtml = chips.length ? `<div class="diary-chip-row">${chips.map(c =>
            `<button class="diary-chip" onclick="app._diaryChipPick('${c.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}',this)">${this._esc(c)}</button>`
        ).join('')}</div>` : '';
        const isFirst = idx === 0;
        el.innerHTML = `<div>
            <div class="diary-step-counter">Step ${idx + 1} of ${total}</div>
            <div class="diary-step">
                <div class="diary-step-label">${s.label}</div>
                <div style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-muted);margin-bottom:10px">${s.prompt}</div>
                ${chipHtml}
                <textarea class="diary-textarea" id="diaryStepInput" placeholder="${s.chipSource ? 'Or type a new one…' : 'Write here…'}">${this._esc(saved)}</textarea>
            </div>
            <div class="diary-nav-row">
                ${isFirst
                    ? `<button class="tool-history-btn" style="margin:0;flex:1" onclick="app._showToolHistory('${tool.id}')">📋 History</button>`
                    : `<button class="tool-history-btn" style="margin:0;flex:1" onclick="app._diaryBack('${tool.id}')">← Back</button>`}
                <button class="save-btn" style="margin:0;flex:2" onclick="app._diaryNext('${tool.id}','${s.key}')">Next →</button>
            </div>
        </div>`;
        if (!s.chipSource) setTimeout(() => document.getElementById('diaryStepInput')?.focus(), 80);
    },

    _diaryChipPick(label, btn) {
        const input = document.getElementById('diaryStepInput');
        if (input) input.value = label;
        btn.closest('.diary-chip-row')?.querySelectorAll('.diary-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    },

    _getDiaryChips(toolId, key) {
        const entries = this.getToolEntries()[toolId] || [];
        const seen = new Map();
        entries.forEach(e => {
            const v = (e.data?.[key] || '').trim().toLowerCase();
            if (v) seen.set(v, (seen.get(v) || 0) + 1);
        });
        return [...seen.entries()].sort((a,b) => b[1]-a[1]).map(([k]) => k);
    },

    _diaryNext(toolId, key) {
        const input = document.getElementById('diaryStepInput');
        const val   = input ? input.value : '';
        const state = this._diaryState[toolId];
        state.data[key] = val;
        state.step++;
        const tool = TOOL_REGISTRY.find(t => t.id === toolId);
        this._doDiaryStep(tool, document.getElementById('toolScreenContent'));
    },

    _diaryBack(toolId) {
        const state = this._diaryState[toolId];
        const tool  = TOOL_REGISTRY.find(t => t.id === toolId);
        const steps = tool.config.steps || [];
        const input = document.getElementById('diaryStepInput');
        if (input && state.step < steps.length) state.data[steps[state.step].key] = input.value;
        if (state.step > 0) state.step--;
        this._doDiaryStep(tool, document.getElementById('toolScreenContent'));
    },

    _renderDiaryReview(tool, el) {
        const state  = this._diaryState[tool.id];
        const steps  = tool.config.steps || [];
        const footer = tool.config.footer || '';
        const fields = steps.map(s => `<div class="diary-step" style="margin-bottom:10px">
            <div class="diary-step-label">${s.label}</div>
            <textarea class="diary-textarea" data-key="${s.key}" placeholder="Write here…">${this._esc(state.data[s.key] || '')}</textarea>
        </div>`).join('');
        el.innerHTML = `<div>
            <div style="font-family:'Baloo 2',sans-serif;font-size:17px;font-weight:700;color:var(--heading-primary);margin-bottom:4px">Review your entry</div>
            <div style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-muted);margin-bottom:14px">Edit anything before saving.</div>
            ${fields}
            ${footer ? `<div class="diary-footer-note">${footer}</div>` : ''}
            <div class="diary-nav-row">
                <button class="tool-history-btn" style="margin:0;flex:1" onclick="app._diaryBackFromReview('${tool.id}')">← Back</button>
                <button class="save-btn" style="margin:0;flex:2" onclick="app._saveDiaryFromReview('${tool.id}')">Save entry ✓</button>
            </div>
            <button class="tool-history-btn" onclick="app._showToolHistory('${tool.id}')">📋 Past entries</button>
        </div>`;
    },

    _diaryBackFromReview(toolId) {
        const state = this._diaryState[toolId];
        const tool  = TOOL_REGISTRY.find(t => t.id === toolId);
        const steps = tool.config.steps || [];
        document.querySelectorAll('#toolScreenContent .diary-textarea[data-key]').forEach(ta => {
            state.data[ta.dataset.key] = ta.value;
        });
        state.step = Math.max(0, steps.length - 1);
        this._doDiaryStep(tool, document.getElementById('toolScreenContent'));
    },

    _saveDiaryFromReview(toolId) {
        const state = this._diaryState[toolId];
        const tool  = TOOL_REGISTRY.find(t => t.id === toolId);
        const el    = document.getElementById('toolScreenContent');
        const data  = Object.assign({}, state.data);
        document.querySelectorAll('#toolScreenContent .diary-textarea[data-key]').forEach(ta => {
            data[ta.dataset.key] = ta.value.trim();
        });
        if (tool.config.draftMessage) {
            const o = data.observation||'…', f = data.feeling||'…', n = data.need||'…', r = data.request||'…';
            data._draft = `When ${o}, I feel ${f}. I need ${n}. Would you be willing to: ${r}?`;
        }
        this.addToolEntry(toolId, data);
        if (tool.config.draftMessage && data._draft) {
            this._renderNVCDraft(tool, el, data._draft);
        } else {
            this.showToast('Entry saved ✓');
            this._renderDiaryFlow(tool, el);
        }
    },

    _showToolHistory(toolId) {
        if (toolId === 'five_rs')  return this._showFiveRsHistory();
        if (toolId === 'elephant') return this._showElephantHistory();
        const tool = TOOL_REGISTRY.find(t => t.id === toolId);
        const el = document.getElementById('toolScreenContent');
        if (!el || !tool) return;
        const entries = (this.getToolEntries()[toolId] || []);
        const steps = tool.config.steps || [];
        // Skip chipSource step (step 0 label) for snippet display
        const snippetKey = steps.find(s => !s.chipSource)?.key || steps[0]?.key;
        let html = `<div>
            <button class="tool-history-btn" style="margin-bottom:12px" onclick="app._renderToolScreen(TOOL_REGISTRY.find(t=>t.id==='${toolId}'))">← Back to ${tool.name}</button>
            <div style="font-family:'Baloo 2',sans-serif;font-size:17px;font-weight:700;color:var(--heading-primary);margin-bottom:10px">Past entries</div>`;
        if (!entries.length) {
            html += `<div class="tool-history-empty">No entries yet. Complete the flow to save your first one.</div>`;
        } else {
            entries.forEach((entry, i) => {
                const snippet = snippetKey ? (entry.data[snippetKey] || '').slice(0, 80) : '';
                html += `<div class="tool-history-item" onclick="app._openDiaryEntry('${toolId}',${i})">
                    <div class="tool-history-date">${entry.date}</div>
                    ${snippet ? `<div class="tool-history-snippet">${this._esc(snippet)}${snippet.length >= 80 ? '…' : ''}</div>` : ''}
                </div>`;
            });
        }
        html += `</div>`;
        el.innerHTML = html;
    },

    /* ── V1.5: FIVE R'S FREQUENCY HISTORY ───────────────── */
    _showFiveRsHistory() {
        const el = document.getElementById('toolScreenContent');
        if (!el) return;
        const entries = this.getToolEntries()['five_rs'] || [];
        // Group by craving_label
        const freq = new Map();
        entries.forEach((e, i) => {
            const label = (e.data?.craving_label || '(unlabelled)').trim().toLowerCase();
            if (!freq.has(label)) freq.set(label, []);
            freq.get(label).push(i);
        });
        const sorted = [...freq.entries()].sort((a,b) => b[1].length - a[1].length);
        let html = `<div>
            <button class="tool-history-btn" style="margin-bottom:12px" onclick="app._renderToolScreen(TOOL_REGISTRY.find(t=>t.id==='five_rs'))">← Back to Cravings · The 5 R's</button>
            <div style="font-family:'Baloo 2',sans-serif;font-size:17px;font-weight:700;color:var(--heading-primary);margin-bottom:6px">Craving frequency</div>
            <div style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-muted);margin-bottom:12px">Tap a label to see those entries.</div>`;
        if (!sorted.length) {
            html += `<div class="tool-history-empty">No entries yet — complete a session to track your cravings.</div>`;
        } else {
            sorted.forEach(([label, idxs]) => {
                html += `<div class="tool-history-item" onclick="app._showFiveRsByLabel('${label.replace(/'/g,"\\'")}')">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <div style="font-family:'Baloo 2',sans-serif;font-size:14px;font-weight:600;color:var(--heading-primary);text-transform:capitalize">${this._esc(label)}</div>
                        <div style="font-family:'Baloo 2',sans-serif;font-size:13px;font-weight:700;color:var(--accent)">×${idxs.length}</div>
                    </div>
                </div>`;
            });
        }
        html += `</div>`;
        el.innerHTML = html;
    },

    _showFiveRsByLabel(label) {
        const el = document.getElementById('toolScreenContent');
        if (!el) return;
        const entries = (this.getToolEntries()['five_rs'] || [])
            .map((e, i) => ({ e, i }))
            .filter(({ e }) => (e.data?.craving_label || '(unlabelled)').trim().toLowerCase() === label);
        let html = `<div>
            <button class="tool-history-btn" style="margin-bottom:12px" onclick="app._showFiveRsHistory()">← Back to frequency</button>
            <div style="font-family:'Baloo 2',sans-serif;font-size:16px;font-weight:700;color:var(--heading-primary);text-transform:capitalize;margin-bottom:10px">${this._esc(label)} (${entries.length})</div>`;
        entries.forEach(({ e, i }) => {
            const snippet = (e.data?.relabel || '').slice(0, 80);
            html += `<div class="tool-history-item" onclick="app._openDiaryEntry('five_rs',${i})">
                <div class="tool-history-date">${e.date}</div>
                ${snippet ? `<div class="tool-history-snippet">${this._esc(snippet)}${snippet.length >= 80 ? '…' : ''}</div>` : ''}
            </div>`;
        });
        html += `</div>`;
        el.innerHTML = html;
    },

    /* ── V1.5: ELEPHANT TRIGGER HISTORY ─────────────────── */
    _showElephantHistory() {
        const el = document.getElementById('toolScreenContent');
        if (!el) return;
        const entries = this.getToolEntries()['elephant'] || [];
        const freq = new Map();
        entries.forEach((e, i) => {
            const trigger = (e.data?.trigger || '(unlabelled)').trim().toLowerCase();
            if (!freq.has(trigger)) freq.set(trigger, []);
            freq.get(trigger).push(i);
        });
        const sorted = [...freq.entries()].sort((a,b) => b[1].length - a[1].length);
        let html = `<div>
            <button class="tool-history-btn" style="margin-bottom:12px" onclick="app._renderToolScreen(TOOL_REGISTRY.find(t=>t.id==='elephant'))">← Back to Reactivity · Elephant & Rider</button>
            <div style="font-family:'Baloo 2',sans-serif;font-size:17px;font-weight:700;color:var(--heading-primary);margin-bottom:6px">Recurring triggers</div>
            <div style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-muted);margin-bottom:12px">Tap a trigger to see those entries.</div>`;
        if (!sorted.length) {
            html += `<div class="tool-history-empty">No entries yet — complete a session to surface patterns.</div>`;
        } else {
            sorted.forEach(([trigger, idxs]) => {
                html += `<div class="tool-history-item" onclick="app._showElephantByTrigger('${trigger.replace(/'/g,"\\'")}')">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <div style="font-family:'Baloo 2',sans-serif;font-size:14px;font-weight:600;color:var(--heading-primary)">${this._esc(trigger)}</div>
                        <div style="font-family:'Baloo 2',sans-serif;font-size:13px;font-weight:700;color:var(--accent)">×${idxs.length}</div>
                    </div>
                </div>`;
            });
        }
        html += `</div>`;
        el.innerHTML = html;
    },

    _showElephantByTrigger(trigger) {
        const el = document.getElementById('toolScreenContent');
        if (!el) return;
        const entries = (this.getToolEntries()['elephant'] || [])
            .map((e, i) => ({ e, i }))
            .filter(({ e }) => (e.data?.trigger || '(unlabelled)').trim().toLowerCase() === trigger);
        let html = `<div>
            <button class="tool-history-btn" style="margin-bottom:12px" onclick="app._showElephantHistory()">← Back to triggers</button>
            <div style="font-family:'Baloo 2',sans-serif;font-size:16px;font-weight:700;color:var(--heading-primary);margin-bottom:10px">${this._esc(trigger)} (${entries.length})</div>`;
        entries.forEach(({ e, i }) => {
            const snippet = (e.data?.what_happened || '').slice(0, 80);
            html += `<div class="tool-history-item" onclick="app._openDiaryEntry('elephant',${i})">
                <div class="tool-history-date">${e.date}</div>
                ${snippet ? `<div class="tool-history-snippet">${this._esc(snippet)}${snippet.length >= 80 ? '…' : ''}</div>` : ''}
            </div>`;
        });
        html += `</div>`;
        el.innerHTML = html;
    },

    _openDiaryEntry(toolId, idx) {
        const tool = TOOL_REGISTRY.find(t => t.id === toolId);
        const el = document.getElementById('toolScreenContent');
        if (!el || !tool) return;
        const entry = (this.getToolEntries()[toolId] || [])[idx];
        if (!entry) return;
        const steps = tool.config.steps || [];
        let html = `<div>
            <button class="tool-history-btn" style="margin-bottom:12px" onclick="app._showToolHistory('${toolId}')">← Back to history</button>
            <div style="font-family:'Baloo 2',sans-serif;font-size:15px;font-weight:600;color:var(--heading-primary);margin-bottom:14px">${entry.date}</div>`;
        steps.forEach(s => {
            const val = entry.data[s.key] || '';
            html += `<div class="diary-readonly-field">
                <div class="diary-readonly-label">${s.label}</div>
                <div class="diary-readonly-value">${val ? this._esc(val) : '<em style="opacity:.5">—</em>'}</div>
            </div>`;
        });
        if (tool.config.draftMessage && entry.data._draft) {
            html += `<div class="diary-readonly-field">
                <div class="diary-readonly-label">Draft message</div>
                <div class="diary-readonly-value">${this._esc(entry.data._draft)}</div>
            </div>`;
        }
        if (tool.config.footer) html += `<div class="diary-footer-note">${tool.config.footer}</div>`;
        html += `</div>`;
        el.innerHTML = html;
    },

    _renderNVCDraft(tool, el, draft) {
        el.innerHTML = `<div>
            <div style="font-family:'Baloo 2',sans-serif;font-size:17px;font-weight:700;color:var(--heading-primary);margin-bottom:6px">Your draft message</div>
            <div style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-muted);margin-bottom:12px">Based on your four answers — edit as needed before sending.</div>
            <div class="widget-box" style="margin-bottom:12px">
                <textarea class="diary-textarea" id="nvcDraftEdit" style="min-height:100px">${this._esc(draft)}</textarea>
            </div>
            <button class="save-btn" style="margin-top:0" onclick="app._copyNVCDraft()">Copy message</button>
            <button class="tool-history-btn" onclick="app._showToolHistory('nvc')">📋 Past entries</button>
            <button class="tool-history-btn" style="margin-top:6px" onclick="app._renderDiaryFlow(TOOL_REGISTRY.find(t=>t.id==='nvc'),document.getElementById('toolScreenContent'))">Start a new one</button>
        </div>`;
        this.showToast('Entry saved ✓');
    },

    _copyNVCDraft() {
        const ta = document.getElementById('nvcDraftEdit');
        if (!ta) return;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(ta.value).then(() => this.showToast('Copied!'));
        } else {
            ta.select();
            document.execCommand('copy');
            this.showToast('Copied!');
        }
    },

    // Stubs — replaced/filled in later phases
    /* ── V1.4 PHASE 4: MIND DUMP ──────────────────────── */
    /* ── V1.5: MIND DUMP REBUILD ─────────────────────────── */
    _renderMindDump(tool, el) {
        if (this._dumpTimer) { clearInterval(this._dumpTimer); this._dumpTimer = null; }
        this._mdInProgress = false;
        const rem = JSON.parse(localStorage.getItem('fulfillx.mindDumpReminder') || '{"enabled":false,"day":0,"time":"20:00"}');
        el.innerHTML = `<div>
            <div style="font-family:'Baloo 2',sans-serif;font-size:16px;font-weight:600;color:var(--heading-primary);margin-bottom:6px">Choose your dump time</div>
            <div style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-muted);margin-bottom:12px">Timer runs hidden — just write without watching the clock.</div>
            <div class="dump-dur-row">
                <button class="dump-dur-btn" data-min="2"  onclick="app._mdPickDur(2)">2 min</button>
                <button class="dump-dur-btn" data-min="5"  onclick="app._mdPickDur(5)">5 min</button>
                <button class="dump-dur-btn" data-min="10" onclick="app._mdPickDur(10)">10 min</button>
            </div>
            <button class="save-btn" id="mdStartBtn" style="display:none" onclick="app._mdStart()">Start →</button>
            <div class="dump-reminder-row">
                <label style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-text);display:flex;align-items:center;gap:8px;cursor:pointer">
                    <input type="checkbox" id="mdRemCheck" onchange="app._mdRemToggle(this.checked)" ${rem.enabled ? 'checked' : ''}> Weekly reminder
                </label>
                ${rem.enabled ? `<span style="font-family:'Fredoka',sans-serif;font-size:12px;color:var(--body-muted)">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][rem.day]} · ${rem.time}</span>` : ''}
            </div>
            ${rem.enabled ? `<div id="mdRemConfig" style="display:flex;gap:8px;margin-top:4px">
                <select id="mdRemDay" style="flex:1;padding:8px;border-radius:10px;border:1.5px solid var(--input-border);background:var(--input-bg);color:var(--input-text);font-family:'Fredoka',sans-serif;font-size:13px" onchange="app._mdRemSave()">
                    ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=>`<option value="${i}"${rem.day===i?' selected':''}>${d}</option>`).join('')}
                </select>
                <input type="time" id="mdRemTime" value="${rem.time}" style="flex:1;padding:8px;border-radius:10px;border:1.5px solid var(--input-border);background:var(--input-bg);color:var(--input-text);font-family:'Fredoka',sans-serif;font-size:13px" onchange="app._mdRemSave()">
            </div>` : `<div id="mdRemConfig" style="display:none"></div>`}
            <button class="tool-history-btn" onclick="app._showMindDumpHistory()">📋 Past entries</button>
        </div>`;
    },

    _mdPickDur(mins) {
        this._mdMins = mins;
        document.querySelectorAll('.dump-dur-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.min) === mins));
        const btn = document.getElementById('mdStartBtn');
        if (btn) btn.style.display = '';
    },

    _mdStart() {
        const mins = this._mdMins || 5;
        const el   = document.getElementById('toolScreenContent');
        if (!el) return;
        this._mdItems    = [];
        this._mdInProgress = true;
        el.innerHTML = `<div>
            <div style="font-family:'Baloo 2',sans-serif;font-size:16px;font-weight:600;color:var(--heading-primary);margin-bottom:4px">Dump it all out</div>
            <div style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-muted);margin-bottom:12px">Press Enter for the next line. Don't filter — let it all out.</div>
            <div class="widget-box" style="padding:10px 14px" id="mdItemsList">
                <div class="dump-item-row"><span class="dump-num">1.</span><input class="dump-item-input" type="text" id="mdItem0" placeholder="What's on your mind?" autofocus onkeydown="app._mdItemKey(event,0)"></div>
            </div>
            <button class="dump-done-btn" id="mdDoneBtn" style="display:block" onclick="app._mdCrossOut()">Done →</button>
        </div>`;
        setTimeout(() => document.getElementById('mdItem0')?.focus(), 80);
        let secs = mins * 60;
        this._dumpTimer = setInterval(() => {
            secs--;
            if (secs <= 0) {
                clearInterval(this._dumpTimer); this._dumpTimer = null;
                this.showToast("Time's up — tap Done when you're ready");
            }
        }, 1000);
    },

    _mdItemKey(event, idx) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const list = document.getElementById('mdItemsList');
        if (!list) return;
        const newIdx = list.children.length;
        const div = document.createElement('div');
        div.className = 'dump-item-row';
        div.innerHTML = `<span class="dump-num">${newIdx + 1}.</span><input class="dump-item-input" type="text" id="mdItem${newIdx}" placeholder="…" onkeydown="app._mdItemKey(event,${newIdx})">`;
        list.appendChild(div);
        setTimeout(() => document.getElementById(`mdItem${newIdx}`)?.focus(), 30);
    },

    _mdCrossOut() {
        if (this._dumpTimer) { clearInterval(this._dumpTimer); this._dumpTimer = null; }
        this._mdInProgress = false;
        const list = document.getElementById('mdItemsList');
        if (!list) return;
        const items = [...list.querySelectorAll('.dump-item-input')].map(i => i.value.trim()).filter(Boolean);
        this._mdRawItems = items;
        this._mdCrossed = new Array(items.length).fill(false);
        const el = document.getElementById('toolScreenContent');
        if (!el) return;
        const rows = items.map((text, i) => `<div class="dump-line" id="mdCrossRow${i}" onclick="app._mdToggleCross(${i})" style="cursor:pointer;padding:10px 4px">
            <span class="dump-line-text" id="mdCrossText${i}">${this._esc(text)}</span>
        </div>`).join('');
        el.innerHTML = `<div>
            <div style="font-family:'Baloo 2',sans-serif;font-size:16px;font-weight:600;color:var(--heading-primary);margin-bottom:4px">Cross out what doesn't matter</div>
            <div style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-muted);margin-bottom:12px">Tap any item to strike it out.</div>
            <div class="widget-box" style="padding:8px 14px">${rows}</div>
            <button class="save-btn" style="margin-top:12px" onclick="app._mdActionPlan()">Next — Action Plan →</button>
        </div>`;
    },

    _mdToggleCross(idx) {
        this._mdCrossed[idx] = !this._mdCrossed[idx];
        const span = document.getElementById('mdCrossText' + idx);
        if (span) span.classList.toggle('crossed', this._mdCrossed[idx]);
    },

    _mdActionPlan() {
        const remaining = (this._mdRawItems || []).filter((_, i) => !this._mdCrossed[i]);
        const el = document.getElementById('toolScreenContent');
        if (!el) return;
        if (!remaining.length) {
            this.addToolEntry('mind_dump', { items: this._mdRawItems || [], crossed: this._mdCrossed || [], actions: {} });
            this.showToast('Saved ✓');
            this._renderMindDump(TOOL_REGISTRY.find(t => t.id === 'mind_dump'), el);
            return;
        }
        const rows = remaining.map((text, i) => `<div style="margin-bottom:12px">
            <div style="font-family:'Baloo 2',sans-serif;font-size:13px;font-weight:600;color:var(--heading-primary);margin-bottom:4px">${i+1}. ${this._esc(text)}</div>
            <input type="text" class="dump-action-field" id="mdAction${i}" placeholder="What do you need to do?">
        </div>`).join('');
        el.innerHTML = `<div>
            <div style="font-family:'Baloo 2',sans-serif;font-size:16px;font-weight:600;color:var(--heading-primary);margin-bottom:4px">Action Plan</div>
            <div style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-muted);margin-bottom:12px">For each remaining item, note what's needed to move it forward.</div>
            ${rows}
            <button class="save-btn" style="margin-top:4px" onclick="app._mdSave()">Save entry ✓</button>
            <button class="tool-history-btn" onclick="app._showMindDumpHistory()">📋 Past entries</button>
        </div>`;
        this._mdRemaining = remaining;
    },

    _mdSave() {
        const remaining = this._mdRemaining || [];
        const actions = {};
        remaining.forEach((text, i) => {
            actions[i] = { item: text, action: document.getElementById('mdAction' + i)?.value.trim() || '' };
        });
        this.addToolEntry('mind_dump', { items: this._mdRawItems || [], crossed: this._mdCrossed || [], actions });
        this.showToast('Entry saved ✓');
        this._renderMindDump(TOOL_REGISTRY.find(t => t.id === 'mind_dump'), document.getElementById('toolScreenContent'));
    },

    _mdRemToggle(enabled) {
        const rem = JSON.parse(localStorage.getItem('fulfillx.mindDumpReminder') || '{"enabled":false,"day":0,"time":"20:00"}');
        rem.enabled = enabled;
        localStorage.setItem('fulfillx.mindDumpReminder', JSON.stringify(rem));
        if (enabled) this._requestNotificationPermission();
        this._renderMindDump(TOOL_REGISTRY.find(t => t.id === 'mind_dump'), document.getElementById('toolScreenContent'));
    },

    _mdRemSave() {
        const day  = parseInt(document.getElementById('mdRemDay')?.value ?? 0);
        const time = document.getElementById('mdRemTime')?.value || '20:00';
        const rem  = JSON.parse(localStorage.getItem('fulfillx.mindDumpReminder') || '{"enabled":true,"day":0,"time":"20:00"}');
        rem.day  = day;
        rem.time = time;
        localStorage.setItem('fulfillx.mindDumpReminder', JSON.stringify(rem));
    },

    _showMindDumpHistory() {
        const el = document.getElementById('toolScreenContent');
        if (!el) return;
        const entries = this.getToolEntries()['mind_dump'] || [];
        let html = `<div>
            <button class="tool-history-btn" style="margin-bottom:12px" onclick="app._renderMindDump(TOOL_REGISTRY.find(t=>t.id==='mind_dump'),document.getElementById('toolScreenContent'))">← Back to Overwhelm · Mind Dump</button>
            <div style="font-family:'Baloo 2',sans-serif;font-size:17px;font-weight:700;color:var(--heading-primary);margin-bottom:10px">Past entries</div>`;
        if (!entries.length) {
            html += `<div class="tool-history-empty">No entries yet — complete a session to save your first one.</div>`;
        } else {
            entries.forEach((entry, i) => {
                const items = entry.data?.items || [];
                const crossed = entry.data?.crossed || [];
                const remaining = items.filter((_, idx) => !crossed[idx]);
                const snippet  = remaining.slice(0,3).join(' · ') || (items[0] || '');
                html += `<div class="tool-history-item" onclick="app._openMindDumpEntry(${i})">
                    <div class="tool-history-date">${entry.date}</div>
                    ${snippet ? `<div class="tool-history-snippet">${this._esc(snippet.slice(0,100))}${snippet.length>100?'…':''}</div>` : ''}
                </div>`;
            });
        }
        html += `</div>`;
        el.innerHTML = html;
    },

    _openMindDumpEntry(idx) {
        const el    = document.getElementById('toolScreenContent');
        const entry = (this.getToolEntries()['mind_dump'] || [])[idx];
        if (!el || !entry) return;
        const items   = entry.data?.items   || [];
        const crossed = entry.data?.crossed  || [];
        const actions = entry.data?.actions  || {};
        let html = `<div>
            <button class="tool-history-btn" style="margin-bottom:12px" onclick="app._showMindDumpHistory()">← Back to history</button>
            <div style="font-family:'Baloo 2',sans-serif;font-size:15px;font-weight:600;color:var(--heading-primary);margin-bottom:14px">${entry.date}</div>`;
        items.forEach((item, i) => {
            const act = typeof actions[i] === 'object' ? actions[i].action : (actions[i] || '');
            html += `<div class="diary-readonly-field">
                <div class="diary-readonly-label" style="${crossed[i]?'text-decoration:line-through;opacity:.5':''}">Item ${i+1}</div>
                <div class="diary-readonly-value" style="${crossed[i]?'text-decoration:line-through;opacity:.5':''}">
                    ${this._esc(item)}
                    ${act ? `<div style="margin-top:4px;font-style:italic;opacity:.8">→ ${this._esc(act)}</div>` : ''}
                </div>
            </div>`;
        });
        html += `</div>`;
        el.innerHTML = html;
    },

    /* ── V1.4 PHASE 4: 5-4-3-2-1 GROUNDING ───────────── */
    _renderGrounding(tool, el) {
        this._groundStep = 0;
        this._groundData = {};
        this._doGroundStep(el);
    },

    _doGroundStep(el) {
        if (!el) el = document.getElementById('toolScreenContent');
        const SENSES = [
            { count:5, sense:'things you can SEE',  key:'see',   icon:'👁️' },
            { count:4, sense:'things you can HEAR', key:'hear',  icon:'👂' },
            { count:3, sense:'things you can TOUCH',key:'touch', icon:'✋' },
            { count:2, sense:'things you can SMELL',key:'smell', icon:'👃' },
            { count:1, sense:'thing you can TASTE', key:'taste', icon:'👅' }
        ];
        const step = this._groundStep;
        if (step >= SENSES.length) {
            this.logToolUsage('grounding');
            el.innerHTML = `<div style="text-align:center;padding:20px 0">
                <div style="font-size:48px;margin-bottom:12px">🌿</div>
                <div style="font-family:'Baloo 2',sans-serif;font-size:22px;font-weight:700;color:var(--heading-primary);margin-bottom:8px">You're grounded.</div>
                <div style="font-family:'Fredoka',sans-serif;font-size:14px;color:var(--body-muted);margin-bottom:24px">Take a breath. You're here.</div>
                <button class="save-btn" onclick="app._renderGrounding(TOOL_REGISTRY.find(t=>t.id==='grounding'),document.getElementById('toolScreenContent'))">Go again</button>
            </div>`;
            return;
        }
        const s = SENSES[step];
        let inputRows = '';
        for (let i = 0; i < s.count; i++) {
            inputRows += `<div class="ground-input-row">
                <span class="ground-input-num">${i+1}</span>
                <input type="text" class="todo-add-input" id="ground_${s.key}_${i}" placeholder="…">
            </div>`;
        }
        el.innerHTML = `<div>
            <div class="ground-sense">
                <div class="ground-sense-count">${s.count}</div>
                <div class="ground-sense-label">${s.icon} ${s.sense}</div>
                <div class="ground-sense-instruction">Name ${s.count} ${s.count === 1 ? 'thing' : 'things'} right now.</div>
                <div class="ground-inputs">${inputRows}</div>
            </div>
            <button class="save-btn" onclick="app._groundNext('${s.key}',${s.count})">Next →</button>
        </div>`;
    },

    _groundNext(key, count) {
        const vals = [];
        for (let i = 0; i < count; i++) vals.push(document.getElementById(`ground_${key}_${i}`)?.value.trim() || '');
        this._groundData[key] = vals;
        this._groundStep++;
        this._doGroundStep(document.getElementById('toolScreenContent'));
    },
    /* ── V1.4 PHASE 5: NERVOUS-SYSTEM RESET ───────────── */
    _renderNSReset(tool, el) {
        el.innerHTML = `<div>
            <div style="font-family:'Baloo 2',sans-serif;font-size:16px;font-weight:600;color:var(--heading-primary);margin-bottom:6px">Where are you right now?</div>
            <div style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-muted);margin-bottom:12px">No wrong state — just an honest check-in.</div>
            <div class="state-option" onclick="app._nsBreath(this,'ventral')">
                <div class="state-option-name">Safe &amp; connected</div>
                <div class="state-option-desc">Calm, open, present — you feel OK</div>
            </div>
            <div class="state-option" onclick="app._nsBreath(this,'sympathetic')">
                <div class="state-option-name">Fight-or-flight</div>
                <div class="state-option-desc">Wired, anxious, tense, racing thoughts</div>
            </div>
            <div class="state-option" onclick="app._nsBreath(this,'dorsal')">
                <div class="state-option-name">Shut down</div>
                <div class="state-option-desc">Flat, numb, disconnected, depleted</div>
            </div>
        </div>`;
    },

    _nsBreath(btn, state) {
        document.querySelectorAll('.state-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const el = document.getElementById('toolScreenContent');
        if (!el) return;
        const STATE_LABELS = { ventral:'Safe & connected', sympathetic:'Fight-or-flight', dorsal:'Shut down' };
        const label = STATE_LABELS[state] || state;
        el.innerHTML = `<div>
            <div style="font-family:'Baloo 2',sans-serif;font-size:15px;font-weight:600;color:var(--heading-primary);margin-bottom:4px">You said: ${label}</div>
            <div style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-muted);margin-bottom:14px">Let's take three physiological sighs. Follow the circle.</div>
            <div class="breath-circle-wrap">
                <div class="breath-circle" id="breathCircle">Ready</div>
                <div class="breath-instruction" id="breathInstr">Tap to begin</div>
                <div class="breath-sublabel" id="breathSub">Two short nasal inhales · then a long mouth exhale</div>
            </div>
            <button class="save-btn" id="breathStartBtn" onclick="app._nsStartBreath('${state}')">Begin</button>
            <div id="breathDoneArea" style="display:none;margin-top:12px">
                <div style="text-align:center;font-family:'Baloo 2',sans-serif;font-size:16px;font-weight:600;color:var(--heading-primary);margin-bottom:12px">How do you feel now?</div>
                <div class="state-option" onclick="app._nsComplete('${state}','better')"><div class="state-option-name">Better — calmer</div></div>
                <div class="state-option" onclick="app._nsComplete('${state}','same')"><div class="state-option-name">About the same</div></div>
                <div class="state-option" onclick="app._nsComplete('${state}','more')"><div class="state-option-name">Need more</div></div>
            </div>
        </div>`;
    },

    _nsStartBreath(state) {
        document.getElementById('breathStartBtn').style.display = 'none';
        const circle  = document.getElementById('breathCircle');
        const instr   = document.getElementById('breathInstr');
        const sub     = document.getElementById('breathSub');
        const ROUNDS  = 3;
        let round = 0;
        const phases = [
            { label:'Inhale 1',   sub:'Short sniff through nose',  scale:1.2, dur:700 },
            { label:'Inhale 2',   sub:'Second short sniff',        scale:1.35,dur:700 },
            { label:'Exhale…',    sub:'Long breath out through mouth', scale:.9, dur:3000 }
        ];
        let phaseIdx = 0;
        const tick = () => {
            if (round >= ROUNDS) {
                circle.textContent = '✓';
                circle.style.transform = 'scale(1)';
                instr.textContent = '3 rounds complete';
                sub.textContent = '';
                document.getElementById('breathDoneArea').style.display = '';
                return;
            }
            const p = phases[phaseIdx];
            circle.textContent = p.label;
            instr.textContent  = p.label;
            sub.textContent    = p.sub;
            circle.style.transform = `scale(${p.scale})`;
            phaseIdx++;
            if (phaseIdx >= phases.length) { phaseIdx = 0; round++; }
            setTimeout(tick, p.dur);
        };
        tick();
    },

    _nsComplete(state, outcome) {
        this.logToolUsage('ns_reset');
        this.showToast('Done ✓');
        this._renderNSReset(TOOL_REGISTRY.find(t => t.id === 'ns_reset'), document.getElementById('toolScreenContent'));
    },

    /* ── V1.4 PHASE 5: ATTACHMENT ──────────────────────── */
    _renderAttachment(tool, el) {
        const saved = localStorage.getItem('fulfillx.attachmentStyle');
        if (!saved) {
            this._renderAttachmentFirstRun(el);
        } else {
            this._renderAttachmentReflection(el, saved);
        }
    },

    _renderAttachmentFirstRun(el) {
        const STYLES = [
            { id:'secure',   name:'Secure',   desc:"You're generally comfortable with closeness and can express needs. You trust relationships without much anxiety or avoidance." },
            { id:'anxious',  name:'Anxious',  desc:'You tend to worry about whether others care, crave closeness but fear it slipping away, and can become preoccupied when something feels off.' },
            { id:'avoidant', name:'Avoidant', desc:"You value independence and can find closeness uncomfortable. You may pull back or go quiet when things get emotionally intense." }
        ];
        el.innerHTML = `<div>
            <div style="font-family:'Baloo 2',sans-serif;font-size:16px;font-weight:600;color:var(--heading-primary);margin-bottom:4px">Identify your style</div>
            <div style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-muted);margin-bottom:14px;line-height:1.5">This is a pattern, not a verdict — most people are a mix. Pick the one that fits most of the time.</div>
            ${STYLES.map(s => `<div class="attach-style-card" onclick="app._setAttachmentStyle('${s.id}')">
                <div class="attach-style-name">${s.name}</div>
                <div class="attach-style-desc">${s.desc}</div>
            </div>`).join('')}
            <div style="font-family:'Fredoka',sans-serif;font-size:12px;color:var(--body-muted);margin-top:10px;font-style:italic">You can change this any time in the tool.</div>
        </div>`;
    },

    _setAttachmentStyle(style) {
        localStorage.setItem('fulfillx.attachmentStyle', style);
        this.showToast('Style saved');
        this._renderAttachmentReflection(document.getElementById('toolScreenContent'), style);
    },

    _renderAttachmentReflection(el, style) {
        const STYLE_TIPS = {
            secure:   "You tend to feel secure — check if this is the situation speaking or an old pattern.",
            anxious:  "Your anxious system may be activating — notice the spike before you act on it.",
            avoidant: "Your avoidant system may be pulling you to withdraw — pause before you go silent."
        };
        const tip = STYLE_TIPS[style] || '';
        const styleName = style.charAt(0).toUpperCase() + style.slice(1);
        this._attachChoice = null;
        el.innerHTML = `<div>
            <div style="font-family:'Fredoka',sans-serif;font-size:12px;color:var(--body-muted);margin-bottom:14px">Style: <strong>${styleName}</strong> · <button style="background:none;border:none;color:var(--accent);font-family:'Fredoka',sans-serif;font-size:12px;cursor:pointer;padding:0" onclick="app._renderAttachmentFirstRun(document.getElementById('toolScreenContent'))">Change</button></div>
            ${tip ? `<div style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-muted);font-style:italic;margin-bottom:14px;padding:8px 12px;background:var(--accent-soft);border-radius:10px">${tip}</div>` : ''}
            <div class="diary-step">
                <div class="diary-step-label">What just happened?</div>
                <textarea class="diary-textarea" id="attachQ1" placeholder="Write here…"></textarea>
            </div>
            <div class="diary-step">
                <div class="diary-step-label">What are you feeling or fearing?</div>
                <textarea class="diary-textarea" id="attachQ2" placeholder="Write here…"></textarea>
            </div>
            <div class="diary-step">
                <div class="diary-step-label">Is this the situation, or my pattern?</div>
                <div class="attach-choice-row">
                    <button class="attach-choice-btn" id="attachChoiceSit" onclick="app._attachChoose('situation')">The situation</button>
                    <button class="attach-choice-btn" id="attachChoicePat" onclick="app._attachChoose('my pattern')">My pattern</button>
                </div>
            </div>
            <div class="diary-step">
                <div class="diary-step-label">What would secure do here?</div>
                <textarea class="diary-textarea" id="attachQ4" placeholder="Write here…"></textarea>
            </div>
            <button class="save-btn" style="margin-top:8px" onclick="app._saveAttachment()">Save reflection ✓</button>
            <button class="tool-history-btn" onclick="app._showToolHistory('attachment')">📋 Past reflections</button>
        </div>`;
    },

    _attachChoose(choice) {
        this._attachChoice = choice;
        document.getElementById('attachChoiceSit')?.classList.toggle('active', choice === 'situation');
        document.getElementById('attachChoicePat')?.classList.toggle('active', choice === 'my pattern');
    },

    _saveAttachment() {
        const data = {
            what:     document.getElementById('attachQ1')?.value.trim() || '',
            feeling:  document.getElementById('attachQ2')?.value.trim() || '',
            choice:   this._attachChoice || '',
            secure:   document.getElementById('attachQ4')?.value.trim() || '',
            style:    localStorage.getItem('fulfillx.attachmentStyle') || ''
        };
        this.addToolEntry('attachment', data);
        this.showToast('Reflection saved ✓');
        this._renderAttachment(TOOL_REGISTRY.find(t => t.id === 'attachment'), document.getElementById('toolScreenContent'));
    },
    /* ── V1.4 PHASE 6: OBSERVER (ladder) ──────────────── */
    _renderObserver(tool, el) {
        el.innerHTML = `<div>
            <div style="font-family:'Baloo 2',sans-serif;font-size:16px;font-weight:600;color:var(--heading-primary);margin-bottom:6px">What thought has you hooked?</div>
            <div style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-muted);margin-bottom:10px">Write it raw — exactly as it shows up.</div>
            <div class="diary-step" style="margin-bottom:14px">
                <textarea id="observerRawThought" placeholder="e.g. I always mess things up" class="diary-textarea"></textarea>
            </div>
            <button class="save-btn" onclick="app._observerBuildLadder()">Unhook it →</button>
            <button class="tool-history-btn" onclick="app._showToolHistory('observer')">📋 Past thoughts</button>
        </div>`;
    },

    _observerBuildLadder() {
        const raw = document.getElementById('observerRawThought')?.value.trim();
        if (!raw) { this.showToast('Enter the thought first'); return; }
        const el = document.getElementById('toolScreenContent');
        const r1 = this._esc(raw);
        const r2 = `I'm having the thought that ${r1}`;
        const r3 = `I notice I'm having the thought that ${r1}`;
        el.innerHTML = `<div>
            <div style="font-family:'Baloo 2',sans-serif;font-size:16px;font-weight:600;color:var(--heading-primary);margin-bottom:12px">The unhooking ladder</div>
            <div class="ladder-rung">
                <div class="ladder-rung-num">Fused (hooked)</div>
                <div class="ladder-rung-text">"${r1}"</div>
            </div>
            <div style="text-align:center;color:var(--body-muted);font-size:18px;padding:2px 0">↓</div>
            <div class="ladder-rung">
                <div class="ladder-rung-num">Step back</div>
                <div class="ladder-rung-text">"${r2}"</div>
            </div>
            <div style="text-align:center;color:var(--body-muted);font-size:18px;padding:2px 0">↓</div>
            <div class="ladder-rung active">
                <div class="ladder-rung-num">Defused (watching)</div>
                <div class="ladder-rung-active-text ladder-rung-text">"${r3}"</div>
            </div>
            <div class="ladder-sky">You are the sky. Thoughts are just the weather passing through.</div>
            <button class="save-btn" onclick="app._saveObserver('${this._esc(raw).replace(/'/g,"\\'")}')">Save this one ✓</button>
            <button class="tool-history-btn" onclick="app._showToolHistory('observer')">📋 Past thoughts</button>
        </div>`;
    },

    _saveObserver(rawThought) {
        this.addToolEntry('observer', { thought: rawThought });
        this.showToast('Saved ✓');
        this._renderObserver(TOOL_REGISTRY.find(t => t.id === 'observer'), document.getElementById('toolScreenContent'));
    },

    /* ── V1.4 PHASE 6: VALUES (bullseye) ──────────────── */
    _getValues() {
        const def = { work:[], leisure:[], relationships:[], growth:[] };
        return JSON.parse(localStorage.getItem('fulfillx.values') || JSON.stringify(def));
    },
    _saveValuesStore(v) {
        localStorage.setItem('fulfillx.values', JSON.stringify(v));
    },

    _renderValues(tool, el) {
        const vals = this._getValues();
        const DOMAINS = [
            { key:'work',          label:'Work / Education' },
            { key:'leisure',       label:'Leisure' },
            { key:'relationships', label:'Relationships' },
            { key:'growth',        label:'Personal Growth / Health' }
        ];
        let domainHtml = DOMAINS.map(d => {
            const tags = (vals[d.key] || []).map((v, i) =>
                `<span class="values-tag">${this._esc(v)}<span class="values-tag-del" onclick="app._removeValue('${d.key}',${i})">×</span></span>`
            ).join('');
            return `<div class="values-domain">
                <div class="values-domain-label">${d.label}</div>
                <div class="values-tag-row" id="valTags_${d.key}">${tags || '<span style="font-family:Fredoka,sans-serif;font-size:12px;color:var(--body-muted);font-style:italic">None yet</span>'}</div>
                <div class="values-add-row">
                    <input type="text" class="todo-add-input" id="valInput_${d.key}" placeholder="Add a value…"
                        onkeydown="if(event.key==='Enter')app._addValue('${d.key}')">
                    <button class="todo-add-btn" onclick="app._addValue('${d.key}')">+</button>
                </div>
            </div>`;
        }).join('');

        // Bull's Eye sliders
        const snap = this._getValues();
        const beHtml = DOMAINS.map(d => {
            const existing = (this.getToolEntries()['values'] || [])[0]?.data?.alignment?.[d.key] ?? 5;
            return `<div class="be-slider-row">
                <span class="be-slider-label">${d.label}</span>
                <input type="range" class="be-slider" id="be_${d.key}" min="1" max="10" value="${existing}">
            </div>`;
        }).join('');

        el.innerHTML = `<div>
            <div style="font-family:'Baloo 2',sans-serif;font-size:16px;font-weight:600;color:var(--heading-primary);margin-bottom:6px">Your living values</div>
            <div style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-muted);margin-bottom:12px">Values are directions, not destinations — add, edit, live them.</div>
            ${domainHtml}
            <div style="font-family:'Baloo 2',sans-serif;font-size:16px;font-weight:600;color:var(--heading-primary);margin:16px 0 8px">Bull's Eye — how close are you?</div>
            <div style="font-family:'Fredoka',sans-serif;font-size:13px;color:var(--body-muted);margin-bottom:12px">10 = living fully by this · 1 = far from it right now</div>
            <div class="widget-box" style="margin-bottom:12px">${beHtml}</div>
            <button class="save-btn" onclick="app._saveBullseye()">Save snapshot ✓</button>
            <button class="tool-history-btn" onclick="app._showValuesHistory()">📋 Past snapshots</button>
        </div>`;
    },

    _addValue(domain) {
        const input = document.getElementById('valInput_' + domain);
        const text = input ? input.value.trim() : '';
        if (!text) return;
        const vals = this._getValues();
        if (!vals[domain]) vals[domain] = [];
        vals[domain].push(text);
        this._saveValuesStore(vals);
        if (input) input.value = '';
        this._renderValues(TOOL_REGISTRY.find(t => t.id === 'values'), document.getElementById('toolScreenContent'));
    },

    _removeValue(domain, idx) {
        const vals = this._getValues();
        if (vals[domain]) vals[domain].splice(idx, 1);
        this._saveValuesStore(vals);
        this._renderValues(TOOL_REGISTRY.find(t => t.id === 'values'), document.getElementById('toolScreenContent'));
    },

    _saveBullseye() {
        const DOMAINS = ['work','leisure','relationships','growth'];
        const alignment = {};
        DOMAINS.forEach(d => {
            const el = document.getElementById('be_' + d);
            alignment[d] = el ? parseInt(el.value) : 5;
        });
        const vals = this._getValues();
        this.addToolEntry('values', { alignment, values: JSON.parse(JSON.stringify(vals)) });
        this.showToast('Snapshot saved ✓');
    },

    _showValuesHistory() {
        const el = document.getElementById('toolScreenContent');
        if (!el) return;
        const entries = this.getToolEntries()['values'] || [];
        const DOMAINS = [
            { key:'work', label:'Work' }, { key:'leisure', label:'Leisure' },
            { key:'relationships', label:'Relationships' }, { key:'growth', label:'Growth' }
        ];
        let html = `<div>
            <button class="tool-history-btn" style="margin-bottom:12px" onclick="app._renderValues(TOOL_REGISTRY.find(t=>t.id==='values'),document.getElementById('toolScreenContent'))">← Back to Direction · Values</button>
            <div style="font-family:'Baloo 2',sans-serif;font-size:17px;font-weight:700;color:var(--heading-primary);margin-bottom:10px">Past snapshots</div>`;
        if (!entries.length) {
            html += `<div class="tool-history-empty">No snapshots yet. Save a Bull's Eye to start your history.</div>`;
        } else {
            entries.forEach((entry, i) => {
                const align = entry.data.alignment || {};
                const scores = DOMAINS.map(d => `${d.label}: ${align[d.key] ?? '—'}`).join(' · ');
                html += `<div class="tool-history-item">
                    <div class="tool-history-date">${entry.date}</div>
                    <div class="tool-history-snippet">${scores}</div>
                </div>`;
            });
        }
        html += `</div>`;
        el.innerHTML = html;
    },

});
