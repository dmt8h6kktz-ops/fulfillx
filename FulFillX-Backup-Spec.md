# FulFillX — Backup & Restore (Export / Import) Spec

A complete-snapshot export and import, so a user can move their *entire* app state between devices (Mac -> iPhone) and keep a real backup. The export is a faithful clone of everything: entries, habits, Toolbox config, journal/prompt customizations, settings, theme, Main Goal, focus areas, and photos — not a cherry-picked subset.

---

## 0. DATA-SAFETY INVARIANTS (read first)

1. **Export is strictly read-only.** It reads storage and produces a download. It never writes, clears, or modifies anything.
2. **Import validates before it writes.** Parse and validate the *entire* backup first. If anything is malformed, abort with zero changes.
3. **Import never silently clobbers.** If the target device already has FulFillX data, show an explicit confirm ("this replaces current data on this device") and only proceed on a clear yes. On a truly empty install, restore directly.
4. **Capture by namespace, not by a hand-picked list.** Export every key under the app's storage namespace + all IndexedDB records, so no customization is ever left behind.
5. **Discover the real schema — don't assume.** Read the code for the actual localStorage key prefix(es), the IndexedDB database name/version/stores/keyPaths, and the exact format photos are stored in. Match them precisely on both export and import.
6. **Don't destructively rebuild IndexedDB.** Restore by writing records into the existing store structure; don't drop/recreate in a way that could orphan data.

---

## 1. Overview + placement

A **Backup & Restore** section in the **Settings** screen with two actions: **Export backup** and **Import backup**. Reuses existing settings UI patterns + design-system tokens (both themes), real Phosphor icons (e.g. export `download-simple`, import `upload-simple`).

The feature must be added to the single shared codebase, so it works identically in the local `file://` app (where existing data lives, to export it) and the hosted version (to import on iPhone).

---

## 2. Export

On **Export backup**:

1. Collect **all** localStorage entries whose key belongs to the app's namespace. Determine the real prefix from the code (e.g. `fulfillx.`). If any app keys are *not* prefixed, identify and include them too — the goal is a complete capture. Values are strings; store them as-is.
2. Read **all IndexedDB records** from the app's database/store(s) (photos, plus any other IndexedDB-held data). For each record, serialize it; convert any Blob/File/ArrayBuffer image payload to a **base64** string (record its MIME type so it can be rebuilt).
3. Assemble the backup object (§4) and trigger a download named `fulfillx-backup-<local-YYYY-MM-DD>.json` (use the app's existing local-date convention, never UTC).
4. Show a brief inline success state (e.g. "Backup downloaded").

Export must not alter any stored data.

---

## 3. Import

On **Import backup**:

1. Open a file picker (`.json`). On file chosen, read + `JSON.parse`.
2. **Validate**: confirm `format === "fulfillx-backup"` and the expected top-level shape. If invalid/unrecognized, show an error and make **no** changes.
3. **Existing-data check**: if the target already has any app localStorage keys or IndexedDB records, show a confirm dialog making clear the current data on *this device* will be replaced. Cancel = no changes. On an empty install, skip straight to restore.
4. **Restore** (only after validation/confirm):
   - Write every localStorage key/value from the backup.
   - Restore IndexedDB: open the app DB at the correct version, and for each store `put` each record, decoding base64 image payloads back into the Blob/ArrayBuffer form the app expects (using the saved MIME type).
5. **Reload** the app (`location.reload()`) so every module re-reads state and the UI reflects the imported data.
6. Show success, or a clear failure message if anything threw (and ensure a failed import doesn't leave a half-written mess — validate fully up front).

---

## 4. Backup file format

```json
{
  "format": "fulfillx-backup",
  "version": 1,
  "appVersion": "<current app version if available>",
  "exportedAt": "<ISO timestamp>",
  "localStorage": { "fulfillx.habits": "…", "fulfillx.toolboxConfig": "…", "…": "…" },
  "indexedDB": {
    "<dbName>": {
      "<storeName>": [
        { "<keyPath/id>": "…", "…": "…", "image": { "base64": "…", "mime": "image/jpeg" } }
      ]
    }
  }
}
```

Exact field names for IndexedDB records follow the real schema. Include enough to reconstruct each record faithfully. Keep `version` so future formats can be detected.

---

## 5. UI

- Settings → "Backup & Restore" block, short helper text: export saves a file with everything; import restores it on this device.
- **Export backup** button → downloads the file.
- **Import backup** button → file picker → validate → (confirm if existing data) → restore → reload.
- Inline status line for success/error. Design-system styling, both themes, Phosphor icons. No raw color literals.

---

## 6. Edge cases

- Invalid / non-FulFillX / corrupted JSON -> error, no changes.
- Backup `version` newer than the app understands -> warn; don't half-apply.
- No photos / empty stores -> still exports/imports cleanly.
- Large photo sets -> base64 inflates size ~33%; acceptable for personal use, but the export shouldn't hang the UI (do the work without freezing; a brief "preparing…" state is fine).
- Date keys in restored data must remain the original local-date keys (don't rewrite them).

---

## 7. Migration flow (Mac -> iPhone) — for reference

1. Update both the local app and the hosted version with this feature.
2. On the Mac `file://` app (where current data lives): Settings -> Export -> get the JSON.
3. AirDrop the JSON to the iPhone.
4. On iPhone, open the hosted app; if onboarding shows, **Skip** to reach the app, go to Settings -> Import -> pick the file.
5. App reloads with the full Mac state. From here, treat the iPhone/hosted version as the source of truth; the `file://` copy becomes a frozen backup.

---

## 8. Out of scope (optional, later)

- An "Import existing backup" entry point on the onboarding welcome screen (nice for device migration, but not required — Settings import covers it).
- Cloud/auto backup or cross-device sync (that's a backend project).
- Selective/partial restore. This feature is whole-snapshot only.

---

## 9. Verification checklist

- **Export (Mac local app):** downloads a JSON. Open it and confirm it contains your habits, Toolbox config (order/hidden), journal/prompt customizations, settings, theme, Main Goal, focus areas, entries/history, AND base64 photo data.
- **Import (empty install — copied folder or hosted on a fresh device):** restores everything; photos render; Toolbox arrangement, prompt tweaks, theme, and habits all match the source. Reload still shows the data.
- **Import into an install that already has data:** confirm dialog appears; Cancel changes nothing; Confirm replaces with the backup.
- **Invalid file:** graceful error, no data touched.
- **Round-trip:** export -> import on empty -> state is identical to the original.
- Export never modifies the source data (re-check your Mac data is untouched after exporting).

---

## 10. Build notes

- New module `js/backup.js` for export/import logic + a Settings UI section + styles in `styles.css`. One hook to render the Settings block. Keep edits targeted; don't refactor unrelated systems.
- Read the real localStorage namespace and IndexedDB schema from the code; match exactly.
- Both themes via existing tokens; real Phosphor icons; no raw color literals.
- Commit at the end as one savepoint.
