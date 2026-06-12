// js/backup.js — Backup & Restore (full-snapshot export / import)
// Self-contained. Extends the global `app` object like the other modules.
//
// DATA-SAFETY (see Backup spec §0):
//  • Export is strictly read-only — it never writes/clears/modifies storage.
//  • Import validates the ENTIRE backup before writing anything; malformed → abort.
//  • Import never silently clobbers: if this device already holds FulFillX data,
//    it asks for explicit confirmation before replacing.
//  • IndexedDB is restored into the EXISTING store (clear + put), never dropped.
//
// Discovered schema (matched exactly, not assumed):
//  • localStorage namespace prefix: "fulfillx." (every app key is prefixed).
//  • IndexedDB: db "fulfillx", version 1, object store "photos" with NO keyPath
//    (out-of-line keys; key = local date string e.g. "2026-06-12").
//    Stored value = a dataURL string ("data:image/jpeg;base64,…").

Object.assign(app, {
    BACKUP_FORMAT:  'fulfillx-backup',
    BACKUP_VERSION: 1,                 // bump if the on-disk format changes
    LS_PREFIX:      'fulfillx.',
    IDB_NAME:       'fulfillx',
    IDB_VERSION:    1,
    IDB_STORES:     ['photos'],

    // Indirection so every module re-reads imported state (spec §3.5).
    // Isolated in its own method purely so tests can stub it.
    _reloadApp() { location.reload(); },

    /* ── render hook (called from openSettings) ───────────── */
    renderBackup() {
        this._setBackupStatus('', null);
    },

    _setBackupStatus(msg, kind /* 'success' | 'error' | 'busy' | null */) {
        const el = document.getElementById('backupStatus');
        if (!el) return;
        el.textContent = msg || '';
        el.classList.remove('is-success', 'is-error', 'is-busy');
        if (kind) el.classList.add('is-' + kind);
    },

    /* ── shared: open the app's photo DB (mirrors history.js) ─ */
    _backupOpenDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.IDB_NAME, this.IDB_VERSION);
            // Create the store if this is a fresh install (matches history.js).
            req.onupgradeneeded = e => {
                const db = e.target.result;
                this.IDB_STORES.forEach(name => {
                    if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
                });
            };
            req.onsuccess = e => resolve(e.target.result);
            req.onerror   = e => reject(e.target.error);
        });
    },

    // Read every record (key + value) from one store.
    _backupReadStore(db, storeName) {
        return new Promise((resolve, reject) => {
            if (!db.objectStoreNames.contains(storeName)) return resolve([]);
            const records = [];
            const tx  = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).openCursor();
            req.onsuccess = e => {
                const cursor = e.target.result;
                if (cursor) {
                    records.push({ key: cursor.key, value: cursor.value });
                    cursor.continue();
                } else {
                    resolve(records);
                }
            };
            req.onerror = e => reject(e.target.error);
        });
    },

    /* ── EXPORT (read-only) ───────────────────────────────── */
    async exportBackup() {
        this._setBackupStatus('Preparing backup…', 'busy');
        try {
            // 1. All localStorage keys in the app namespace (by prefix, not a list).
            const ls = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.LS_PREFIX)) ls[key] = localStorage.getItem(key);
            }

            // 2. All IndexedDB records. Photos are stored as dataURL strings; split
            //    each into { base64, mime } so the format matches the spec and can
            //    be rebuilt byte-for-byte on import.
            const idb = {};
            const db  = await this._backupOpenDB();
            try {
                const dbOut = {};
                for (const storeName of this.IDB_STORES) {
                    const records = await this._backupReadStore(db, storeName);
                    dbOut[storeName] = records.map(({ key, value }) => {
                        const parsed = this._parseDataUrl(value);
                        return parsed
                            ? { key, image: { base64: parsed.base64, mime: parsed.mime } }
                            : { key, raw: value };   // fallback: preserve non-dataURL values
                    });
                }
                idb[this.IDB_NAME] = dbOut;
            } finally {
                db.close();
            }

            // 3. Assemble + download (local date, never UTC).
            const backup = {
                format:       this.BACKUP_FORMAT,
                version:      this.BACKUP_VERSION,
                appVersion:   (typeof window !== 'undefined' && window.APP_VERSION) || null,
                exportedAt:   new Date().toISOString(),
                localStorage: ls,
                indexedDB:    idb
            };

            const fileName = `fulfillx-backup-${localDateKey()}.json`;
            this._downloadJson(backup, fileName);
            this._setBackupStatus('Backup downloaded.', 'success');
        } catch (err) {
            console.error('[backup] export failed', err);
            this._setBackupStatus('Export failed. Nothing was changed.', 'error');
        }
    },

    _downloadJson(obj, fileName) {
        const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Revoke after the click has had a chance to start the download.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    // "data:image/jpeg;base64,XXXX" → { mime, base64 }, or null if not a dataURL.
    _parseDataUrl(value) {
        if (typeof value !== 'string') return null;
        const m = value.match(/^data:([^;,]*);base64,(.*)$/s);
        if (!m) return null;
        return { mime: m[1] || 'application/octet-stream', base64: m[2] };
    },

    /* ── IMPORT ───────────────────────────────────────────── */
    importBackup() {
        const input = document.getElementById('backupFileInput');
        if (!input) return;
        input.value = '';   // allow re-picking the same file
        input.click();
    },

    onBackupFileChosen(input) {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => this._processImport(reader.result);
        reader.onerror = () => this._setBackupStatus('Could not read that file.', 'error');
        reader.readAsText(file);
        input.value = '';
    },

    async _processImport(text) {
        // 1. Parse.
        let backup;
        try {
            backup = JSON.parse(text);
        } catch {
            this._setBackupStatus('That file isn’t valid JSON. No changes made.', 'error');
            return;
        }

        // 2. Validate the ENTIRE backup before touching storage.
        const v = this._validateBackup(backup);
        if (!v.ok) {
            this._setBackupStatus(v.message, 'error');
            return;
        }

        // 3. Existing-data check — never silently clobber.
        try {
            const hasData = await this._deviceHasData();
            if (hasData) {
                const ok = confirm(
                    'This will REPLACE all FulFillX data currently on this device ' +
                    '(entries, habits, settings, photos…) with the contents of this backup.\n\n' +
                    'This cannot be undone. Continue?'
                );
                if (!ok) {
                    this._setBackupStatus('Import cancelled. Nothing was changed.', null);
                    return;
                }
            }

            // 4. Restore (validated + confirmed). IDB first in one atomic
            //    transaction, then localStorage, then reload.
            this._setBackupStatus('Restoring backup…', 'busy');
            await this._restoreIndexedDB(backup.indexedDB);
            this._restoreLocalStorage(backup.localStorage);

            this._setBackupStatus('Backup restored. Reloading…', 'success');
            setTimeout(() => this._reloadApp(), 400);
        } catch (err) {
            console.error('[backup] import failed', err);
            this._setBackupStatus('Import failed. ' + (err && err.message ? err.message : ''), 'error');
        }
    },

    // Returns { ok, message }. Also pre-decodes nothing destructive — pure checks.
    _validateBackup(b) {
        if (!b || typeof b !== 'object' || Array.isArray(b))
            return { ok: false, message: 'Unrecognized file — not a FulFillX backup.' };
        if (b.format !== this.BACKUP_FORMAT)
            return { ok: false, message: 'This isn’t a FulFillX backup file. No changes made.' };
        if (typeof b.version !== 'number')
            return { ok: false, message: 'Backup is missing a version. No changes made.' };
        if (b.version > this.BACKUP_VERSION)
            return { ok: false, message: 'This backup was made by a newer version of FulFillX. Update the app first — no changes made.' };
        if (!b.localStorage || typeof b.localStorage !== 'object' || Array.isArray(b.localStorage))
            return { ok: false, message: 'Backup is missing its data section. No changes made.' };
        // localStorage values must all be strings (that's how the app stores them).
        for (const [k, val] of Object.entries(b.localStorage)) {
            if (typeof val !== 'string')
                return { ok: false, message: `Backup data is malformed (key "${k}"). No changes made.` };
        }
        // indexedDB is optional, but if present must be the expected shape and
        // every record must be reconstructable (validate fully, up front).
        if (b.indexedDB != null) {
            if (typeof b.indexedDB !== 'object' || Array.isArray(b.indexedDB))
                return { ok: false, message: 'Backup’s photo section is malformed. No changes made.' };
            for (const dbName of Object.keys(b.indexedDB)) {
                const stores = b.indexedDB[dbName];
                if (!stores || typeof stores !== 'object')
                    return { ok: false, message: 'Backup’s photo section is malformed. No changes made.' };
                for (const storeName of Object.keys(stores)) {
                    const recs = stores[storeName];
                    if (!Array.isArray(recs))
                        return { ok: false, message: 'Backup’s photo records are malformed. No changes made.' };
                    for (const r of recs) {
                        if (!r || typeof r !== 'object' || !('key' in r))
                            return { ok: false, message: 'A photo record in the backup is malformed. No changes made.' };
                        if ('image' in r) {
                            if (!r.image || typeof r.image.base64 !== 'string')
                                return { ok: false, message: 'A photo in the backup is malformed. No changes made.' };
                        } else if (!('raw' in r)) {
                            return { ok: false, message: 'A photo record in the backup is incomplete. No changes made.' };
                        }
                    }
                }
            }
        }
        return { ok: true };
    },

    // True if this device already holds any app localStorage key or IDB record.
    async _deviceHasData() {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.LS_PREFIX)) return true;
        }
        const db = await this._backupOpenDB();
        try {
            for (const storeName of this.IDB_STORES) {
                if (!db.objectStoreNames.contains(storeName)) continue;
                const count = await new Promise((resolve, reject) => {
                    const req = db.transaction(storeName, 'readonly').objectStore(storeName).count();
                    req.onsuccess = e => resolve(e.target.result);
                    req.onerror   = e => reject(e.target.error);
                });
                if (count > 0) return true;
            }
        } finally {
            db.close();
        }
        return false;
    },

    // Replace app localStorage: clear existing namespaced keys, then write backup.
    _restoreLocalStorage(ls) {
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.LS_PREFIX)) toRemove.push(key);
        }
        toRemove.forEach(k => localStorage.removeItem(k));
        for (const [k, val] of Object.entries(ls)) localStorage.setItem(k, val);
    },

    // Restore into the EXISTING store(s): clear + put each record in one atomic
    // transaction per store (no drop/recreate). Decodes base64 → dataURL string.
    async _restoreIndexedDB(idb) {
        if (!idb) return;
        const db = await this._backupOpenDB();
        try {
            for (const dbName of Object.keys(idb)) {
                // We only own the "fulfillx" database; ignore anything unexpected.
                if (dbName !== this.IDB_NAME) continue;
                const stores = idb[dbName];
                for (const storeName of Object.keys(stores)) {
                    if (!db.objectStoreNames.contains(storeName)) continue;
                    const records = stores[storeName];
                    await new Promise((resolve, reject) => {
                        const tx    = db.transaction(storeName, 'readwrite');
                        const store = tx.objectStore(storeName);
                        store.clear();
                        for (const r of records) {
                            const value = ('image' in r)
                                ? `data:${r.image.mime || 'image/jpeg'};base64,${r.image.base64}`
                                : r.raw;
                            store.put(value, r.key);   // out-of-line key
                        }
                        tx.oncomplete = () => resolve();
                        tx.onerror    = e => reject(e.target.error);
                        tx.onabort    = e => reject(e.target.error);
                    });
                }
            }
        } finally {
            db.close();
        }
    },
});
