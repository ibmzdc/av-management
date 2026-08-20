# AV Management Tool — Developer Notes

Quick-reference for anyone (human or AI) picking up this project.

---

## What this is

A two-page AV management tool for the IBM Z Design Council (ZDC) conference.
- **`app/admin.html`** — AV lead only. Edit sessions, AV requirements, file statuses.
- **`app/dashboard.html`** — Read-only vendor view. Auto-refreshes every 60 s.
- **`data/av-data.json`** — Live session data. Saved via GitHub Contents API.
- **`app/av-config.js`** — Reference copy of config constants. **Not loaded by HTML files** (blocked on `file://`). Edit here first, then sync to both HTML files manually.

Runs as plain HTML from `file://` or GitHub Pages — no build step, no framework.

---

## Critical gotchas

### 1. No nested template literals in `renderAVReqs()`
Using backtick strings inside a template literal causes a **silent JS parse error** that kills the entire page with no console output. `renderAVReqs()` must use plain string concatenation (`+`). This has broken the page twice — do not "clean it up" with template literals.

### 2. No `:has()` CSS selector
Not supported in Firefox / older Safari. Use `getElementById` or class toggling instead.

### 3. Config must be inlined in both HTML files
`av-config.js` cannot be loaded via `<script src>` on `file://`. The four constants below are copy-pasted into the first `<script>` block of each HTML file:
- `AV_GROUPS`
- `AV_CONFIG`
- `ROOM_SETUP_PRESETS`
- `STAGE_SETUP_PRESETS`

**Three-file rule:** any change to these constants must be made in all three places:
1. `app/av-config.js` (reference)
2. `app/admin.html` (inline `<script>`)
3. `app/dashboard.html` (inline `<script>`)

### 4. `EMBEDDED_DATA` fallback
Both HTML files inline `EMBEDDED_DATA` (a snapshot of `av-data.json`) as a fallback for `file://` use. When saving sessions via the GitHub API, the HTML files are **not** automatically updated — `EMBEDDED_DATA` will drift from live data. That is expected and acceptable.

### 5. Legacy root fields
When saving a session, these legacy root-level fields are mirrored from `s.av.*` for backward compatibility with old session data:
- `s.roomSetup` ← `s.av.roomSetup`
- `s.stageSetup` ← `s.av.stageSetup`
- `s.podium` ← `s.av.podium`
- `s.specialReqs` ← `s.av.specialReqs`

---

## Git workflow

**The git repo root is `av-management/`**, one level below the workspace root (`ZDC 2016 Fall v2/`).

Always use `cwd: "av-management"` for all git commands. The remote frequently has ahead commits (data file updated by a separate process), so always:

```bash
git pull --rebase && git push
```

Never just `git push` without pulling first.

---

## Room / Stage Setup picker format

Room Setup and Stage Setup values are serialised as a pipe-delimited string:

```
presetKey|opt1,opt2,capacity:N|free text note
```

Example: `ballroom|schoolroom,capacity:240,aisles|Extra chairs at the back`

The dashboard has a `decodePickerValue()` function that renders this as human-readable text.

---

## Key functions — admin.html

| Function | Purpose |
|---|---|
| `renderAVReqs()` | Renders read-only AV summary chips on session cards |
| `buildModalAVSections()` | Builds the edit modal AV form from `AV_GROUPS` + `AV_CONFIG` |
| `collectAVReqs()` | Reads the modal form and returns an `av` object |
| `renderSetupPicker()` | Renders the Room/Stage Setup picker UI |
| `rsSelectPreset()` | Handles preset button clicks in the picker |
| `roomSetupValue()` / `stageSetupValue()` | Read picker state → serialised string |
| `collectFormState()` | Collects entire modal form into a session object |

## Key functions — dashboard.html

| Function | Purpose |
|---|---|
| `buildSessionBlock()` | Renders a full session card |
| `buildAVChips()` | Renders AV requirement chips |
| `decodePickerValue()` | Converts serialised picker string to human-readable text |
| `buildFilesSection()` | Renders the files card |

---

## Current state / next work items

- Dashboard is "too busy" — user wants to clean it up. Options discussed:
  - Collapsed-by-default with click-to-expand
  - Condense AV group cards to read-only chip/pill format
- Dead code in dashboard to clean up: `.sub-panel`, `togglePanel()`, `.row-btn`, `.files-col` CSS/JS

---

## Backup tags

- `backup-pre-av-config` — state on GitHub before the AV_CONFIG refactor
