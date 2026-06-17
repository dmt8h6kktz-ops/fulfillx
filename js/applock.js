// js/applock.js — App Lock (Build 2 of 3)
//
// WHAT THIS IS: a privacy GATE over the app UI. It is NOT encryption — the
// journals, habits, photos, and settings on this device are stored exactly as
// before, in plaintext. App Lock only hides the UI behind a PIN / Face ID so a
// casual snooper can't open the app. A determined attacker with device access
// can still read the raw storage. Never describe this as encrypting data.
//
// DATA SAFETY:
//  • Enabling/disabling the lock, setting/changing the PIN, enrolling Face ID,
//    and generating recovery codes touch ONLY the lock-state keys below. They
//    never read, modify, or delete any app data.
//  • PIN and recovery code are stored as salted SHA-256 hashes only — never
//    plaintext, never reversible.
//  • The ONLY path that clears app data is _lockResetApp(), the explicit
//    last-resort "Reset app", and only after a clear confirm.
//
// STATE KEYS (deliberately under the separate "applock." namespace, NOT the
// app's "fulfillx." namespace — so the backup system, which snapshots by the
// "fulfillx." prefix, never carries auth secrets into a portable backup file
// and a restored backup can never re-lock or lock-out the user):
//  • applock.enabled  → '1' when the lock is on (absent = off)
//  • applock.pin      → JSON { salt, hash }  (salted SHA-256 of salt+PIN)
//  • applock.recovery → JSON { salt, hash }  (salted SHA-256 of salt+code)
//  • applock.faceid   → '1' when Face ID unlock is enrolled
//  • applock.cred     → base64url WebAuthn credential id (not secret)

Object.assign(app, {
    LOCK_PREFIX: 'applock.',

    /* ── launch gate (OUTERMOST) ─────────────────────────────
       Called from DOMContentLoaded BEFORE normal init. If armed, show the lock
       screen and block; init() only runs after a successful unlock. */
    boot() {
        if (this.lockArmed()) {
            this._openPinPad('unlock', { showForgot: true, showFace: true, autoFace: true });
        } else {
            document.documentElement.classList.remove('applock-armed');
            this._booted = true;
            this.init();
        }
    },

    lockArmed() {
        return localStorage.getItem('applock.enabled') === '1'
            && localStorage.getItem('applock.pin') !== null;
    },

    /* ── crypto helpers (hash-only; no plaintext ever stored) ─ */
    _randSalt() {
        const a = new Uint8Array(16);
        crypto.getRandomValues(a);
        return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async _hash(value, saltHex) {
        const data = new TextEncoder().encode(saltHex + value);
        const buf  = await crypto.subtle.digest('SHA-256', data);
        return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async _setHashedSecret(key, value) {
        const salt = this._randSalt();
        const hash = await this._hash(value, salt);
        localStorage.setItem(key, JSON.stringify({ salt, hash }));
    },

    async _verifyHashedSecret(key, value) {
        try {
            const o = JSON.parse(localStorage.getItem(key));
            if (!o || !o.salt || !o.hash) return false;
            const h = await this._hash(value, o.salt);
            // length-independent compare is overkill for a local gate; plain === is fine.
            return h === o.hash;
        } catch (_) { return false; }
    },

    _genRecovery() {
        const ch = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I/L)
        const seg = () => {
            const a = new Uint8Array(4);
            crypto.getRandomValues(a);
            return [...a].map(x => ch[x % ch.length]).join('');
        };
        return `FULF-${seg()}-${seg()}`;
    },

    /* ── PIN pad overlay (shared by unlock / set / confirm / verify) ── */
    _openPinPad(mode, opts) {
        this._lockMode = mode;
        this._lockOpts = opts || {};
        this._pinBuffer = '';
        if (mode === 'setNew') this._pinPending = null;

        const ov = document.getElementById('appLock');
        if (!ov) return;
        ov.classList.add('active');
        ov.setAttribute('aria-hidden', 'false');

        const titleDefault = mode === 'setNew' ? 'Create a PIN'
            : mode === 'verify' ? 'Enter your PIN'
            : 'Enter your PIN';
        this._setPadTitle(this._lockOpts.title || titleDefault);
        this._setLockError('');
        this._renderDots();

        // Forgot link only makes sense on the launch-unlock screen.
        const forgot = document.getElementById('lockForgot');
        if (forgot) forgot.hidden = !this._lockOpts.showForgot;

        // Face ID button: only if requested, enrolled, and WebAuthn usable.
        const faceBtn = document.getElementById('lockFaceBtn');
        const faceOk  = this._lockOpts.showFace
            && localStorage.getItem('applock.faceid') === '1'
            && this._webauthnAvailable();
        if (faceBtn) faceBtn.hidden = !faceOk;

        if (faceOk && this._lockOpts.autoFace) {
            setTimeout(() => this.lockTryFaceID(), 350);
        }
    },

    _closePinPad() {
        const ov = document.getElementById('appLock');
        if (ov) { ov.classList.remove('active'); ov.setAttribute('aria-hidden', 'true'); }
        this._pinBuffer = '';
    },

    _setPadTitle(t) {
        const el = document.getElementById('lockTitle');
        if (el) el.textContent = t;
    },

    _setLockError(msg) {
        const el = document.getElementById('lockError');
        if (el) el.textContent = msg || '';
    },

    _renderDots() {
        const dots = document.querySelectorAll('#lockDots .lock-dot');
        const n = (this._pinBuffer || '').length;
        dots.forEach((d, i) => d.classList.toggle('filled', i < n));
    },

    _shakeDots() {
        const wrap = document.getElementById('lockDots');
        this._pinBuffer = '';
        this._renderDots();
        if (!wrap) return;
        wrap.classList.remove('shake');
        void wrap.offsetWidth; // reflow so the animation can re-trigger
        wrap.classList.add('shake');
    },

    lockPadPress(d) {
        if (!this._lockMode) return;
        if ((this._pinBuffer || '').length >= 4) return;
        this._pinBuffer = (this._pinBuffer || '') + String(d);
        this._setLockError('');
        this._renderDots();
        if (this._pinBuffer.length === 4) {
            // brief paint of the 4th dot before resolving
            setTimeout(() => this._pinComplete(), 120);
        }
    },

    lockPadDelete() {
        if (!this._pinBuffer) return;
        this._pinBuffer = this._pinBuffer.slice(0, -1);
        this._renderDots();
    },

    async _pinComplete() {
        const pin  = this._pinBuffer;
        const mode = this._lockMode;
        const opts = this._lockOpts || {};

        if (mode === 'unlock') {
            if (await this._verifyHashedSecret('applock.pin', pin)) this._unlockSuccess();
            else this._shakeDots();
            return;
        }
        if (mode === 'verify') {
            if (await this._verifyHashedSecret('applock.pin', pin)) {
                this._pinBuffer = '';
                if (opts.onVerified) opts.onVerified();
            } else { this._shakeDots(); }
            return;
        }
        if (mode === 'setNew') {
            this._pinPending = pin;
            this._pinBuffer = '';
            this._renderDots();
            this._setPadTitle('Confirm your PIN');
            this._lockMode = 'confirm';
            return;
        }
        if (mode === 'confirm') {
            if (pin === this._pinPending) {
                const cb = opts.onSet;
                this._pinPending = null;
                if (cb) cb(pin);
            } else {
                this._pinPending = null;
                this._lockMode = 'setNew';
                this._setPadTitle(opts.title || 'Create a PIN');
                this._setLockError("PINs didn't match — try again");
                this._shakeDots();
            }
            return;
        }
    },

    _unlockSuccess() {
        this._closePinPad();
        document.documentElement.classList.remove('applock-armed');
        if (!this._booted) { this._booted = true; this.init(); }
    },

    /* ── WebAuthn / Face ID (local gate; no server verification) ──
       A platform authenticator assertion is sufficient proof for a local
       privacy gate. PIN is always the fallback. */
    _webauthnAvailable() {
        return !!(window.PublicKeyCredential && window.isSecureContext && navigator.credentials);
    },

    async _platformAuthAvailable() {
        if (!this._webauthnAvailable()) return false;
        try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
        catch (_) { return false; }
    },

    _b64url(buf) {
        const bytes = new Uint8Array(buf);
        let s = '';
        for (const b of bytes) s += String.fromCharCode(b);
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },

    _fromB64url(str) {
        let s = str.replace(/-/g, '+').replace(/_/g, '/');
        const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
        const bin = atob(s + pad);
        const a = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
        return a.buffer;
    },

    async lockEnrollFaceID() {
        if (!(await this._platformAuthAvailable())) return false;
        try {
            const cred = await navigator.credentials.create({ publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                rp:   { name: 'FulFillX' },                 // rp.id defaults to current origin
                user: { id: crypto.getRandomValues(new Uint8Array(16)),
                        name: 'fulfillx-local', displayName: 'FulFillX' },
                pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
                authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
                timeout: 60000,
                attestation: 'none'
            }});
            localStorage.setItem('applock.cred', this._b64url(cred.rawId));
            localStorage.setItem('applock.faceid', '1');
            return true;
        } catch (_) {
            // Standalone iOS PWAs have had WebAuthn quirks — fail gracefully to PIN.
            return false;
        }
    },

    async lockTryFaceID() {
        const id = localStorage.getItem('applock.cred');
        if (!id || !this._webauthnAvailable()) return false;
        try {
            await navigator.credentials.get({ publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                allowCredentials: [{ type: 'public-key', id: this._fromB64url(id) }],
                userVerification: 'required',
                timeout: 60000
            }});
            this._unlockSuccess();
            return true;
        } catch (_) {
            // Dismissed/failed → user falls back to the PIN pad. No error thrown.
            return false;
        }
    },

    /* ── Settings → Security ─────────────────────────────────── */
    async renderSecurity() {
        const on = localStorage.getItem('applock.enabled') === '1';
        const lockSw = document.getElementById('sec-switch-lock');
        if (lockSw) { lockSw.classList.toggle('on', on); lockSw.setAttribute('aria-checked', String(on)); }

        const faceRow = document.getElementById('sec-row-face');
        const avail   = await this._platformAuthAvailable();
        if (faceRow) faceRow.hidden = !(avail && on); // hidden where WebAuthn unavailable
        const faceSw = document.getElementById('sec-switch-face');
        const faceOn = localStorage.getItem('applock.faceid') === '1';
        if (faceSw) { faceSw.classList.toggle('on', faceOn); faceSw.setAttribute('aria-checked', String(faceOn)); }

        const change = document.getElementById('sec-change-pin');
        if (change) change.hidden = !on;
    },

    lockToggle() {
        if (localStorage.getItem('applock.enabled') === '1') this._disableLock();
        else this._enableLock();
    },

    _enableLock() {
        this._openPinPad('setNew', {
            title: 'Create a PIN', showForgot: false, showFace: false,
            onSet: async (pin) => {
                await this._setHashedSecret('applock.pin', pin);
                localStorage.setItem('applock.enabled', '1');
                const code = this._genRecovery();
                await this._setHashedSecret('applock.recovery', code);
                this._closePinPad();
                this._showRecovery(code); // → backup nudge → renderSecurity
            }
        });
    },

    _disableLock() {
        if (!confirm('Turn off App Lock?\n\nYour journals, habits, and other data are not affected.')) return;
        // Clears ONLY lock-state keys — never app data.
        ['applock.enabled', 'applock.pin', 'applock.recovery', 'applock.faceid', 'applock.cred']
            .forEach(k => localStorage.removeItem(k));
        this.renderSecurity();
        this.showToast('App Lock turned off');
    },

    async lockToggleFaceID() {
        if (localStorage.getItem('applock.faceid') === '1') {
            localStorage.removeItem('applock.faceid');
            localStorage.removeItem('applock.cred');
            this.renderSecurity();
            return;
        }
        const ok = await this.lockEnrollFaceID();
        this.showToast(ok ? 'Face ID unlock enabled' : 'Couldn’t set up Face ID — PIN still works');
        this.renderSecurity();
    },

    lockChangePin() {
        this._openPinPad('verify', {
            title: 'Enter current PIN', showForgot: false,
            showFace: localStorage.getItem('applock.faceid') === '1',
            onVerified: () => {
                this._openPinPad('setNew', {
                    title: 'Set a new PIN', showForgot: false, showFace: false,
                    onSet: async (pin) => {
                        await this._setHashedSecret('applock.pin', pin);
                        this._closePinPad();
                        this.showToast('PIN updated');
                    }
                });
            }
        });
    },

    /* ── Forgot PIN → recovery code → new PIN (data intact) ─── */
    lockForgotPin() {
        this._closePinPad();
        const el = document.getElementById('recoveryEntry');
        const inp = document.getElementById('recoveryInput');
        if (inp) inp.value = '';
        this._setText('recoveryError', '');
        if (el) { el.classList.add('active'); el.setAttribute('aria-hidden', 'false'); }
    },

    _recoveryCancel() {
        const el = document.getElementById('recoveryEntry');
        if (el) { el.classList.remove('active'); el.setAttribute('aria-hidden', 'true'); }
        // Back to the launch unlock screen if still armed.
        if (this.lockArmed() && !this._booted) {
            this._openPinPad('unlock', { showForgot: true, showFace: true, autoFace: false });
        }
    },

    async _recoverySubmit() {
        const inp = document.getElementById('recoveryInput');
        const code = (inp ? inp.value : '').trim().toUpperCase();
        if (!code) return;
        if (await this._verifyHashedSecret('applock.recovery', code)) {
            const el = document.getElementById('recoveryEntry');
            if (el) { el.classList.remove('active'); el.setAttribute('aria-hidden', 'true'); }
            // Let them set a brand-new PIN. App data is never touched here.
            this._openPinPad('setNew', {
                title: 'Set a new PIN', showForgot: false, showFace: false,
                onSet: async (pin) => {
                    await this._setHashedSecret('applock.pin', pin);
                    this.showToast('PIN reset — your data is intact');
                    if (!this._booted) this._unlockSuccess();
                    else this._closePinPad();
                }
            });
        } else {
            this._setText('recoveryError', "That code didn’t match. Check it and try again.");
        }
    },

    /* ── Reset app — the ONLY path that clears app data ──────── */
    async _lockResetApp() {
        const msg = 'Reset FulFillX?\n\nThis erases ALL FulFillX data on this device — journals, habits, photos, and settings — and cannot be undone. This is the only way in if you’ve lost both your PIN and recovery code.';
        if (!confirm(msg)) return;

        // 1. Clear the app's localStorage namespace AND the lock namespace.
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith('fulfillx.') || k.startsWith(this.LOCK_PREFIX))) toRemove.push(k);
        }
        toRemove.forEach(k => localStorage.removeItem(k));

        // 2. Drop the app's IndexedDB (db "fulfillx", store "photos").
        const dbName = this.IDB_NAME || 'fulfillx';
        try {
            await new Promise((resolve) => {
                const req = indexedDB.deleteDatabase(dbName);
                req.onsuccess = req.onerror = req.onblocked = () => resolve();
            });
        } catch (_) { /* fresh start proceeds regardless */ }

        // 3. Fresh start.
        location.reload();
    },

    /* ── Recovery-code reveal (shown once) + backup nudge ────── */
    _showRecovery(code) {
        this._setText('recoveryCodeText', code);
        const el = document.getElementById('recoveryShow');
        if (el) { el.classList.add('active'); el.setAttribute('aria-hidden', 'false'); }
    },

    _recoverySaved() {
        const el = document.getElementById('recoveryShow');
        if (el) { el.classList.remove('active'); el.setAttribute('aria-hidden', 'true'); }
        const nudge = document.getElementById('lockBackupNudge');
        if (nudge) { nudge.classList.add('active'); nudge.setAttribute('aria-hidden', 'false'); }
        this.renderSecurity();
    },

    _nudgeExport() {
        this._closeNudge();
        if (typeof this.exportBackup === 'function') this.exportBackup();
    },

    _nudgeLater() { this._closeNudge(); },

    _closeNudge() {
        const nudge = document.getElementById('lockBackupNudge');
        if (nudge) { nudge.classList.remove('active'); nudge.setAttribute('aria-hidden', 'true'); }
        this.renderSecurity();
    },

    _setText(id, t) {
        const el = document.getElementById(id);
        if (el) el.textContent = t || '';
    },
});
