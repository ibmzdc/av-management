# AV Management System

> Lightweight, browser-based AV file tracking and dashboard system for live events.
> Built with static HTML, GitHub Pages, and IBM Box. Zero servers · Zero frameworks · Zero cost.

---

## Live URLs — ZDC 2026 Fall

| Resource | URL |
|---|---|
| **Dashboard** (AV team) | https://ibmzdc.github.io/av-management/app/dashboard.html |
| **Admin page** | https://ibmzdc.github.io/av-management/app/admin.html |
| **Admin guide** | https://ibmzdc.github.io/av-management/docs/admin-guide.html |
| **AV team guide** | https://ibmzdc.github.io/av-management/docs/av-team-guide.html |
| **Project specification** | https://ibmzdc.github.io/av-management/docs/project-spec.html |
| **Raw data file** | https://raw.githubusercontent.com/ibmzdc/av-management/main/data/av-data.json |

---

## Table of Contents

1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Repository Structure](#2-repository-structure)
3. [Data Model](#3-data-model--av-datajson)
4. [How Each Page Works](#4-how-each-page-works)
5. [GitHub Pages Setup](#5-github-pages-setup)
6. [Authentication — GitHub Token](#6-authentication--github-token)
7. [IBM Box Integration](#7-ibm-box-integration)
8. [Re-onboarding for a New Event](#8-re-onboarding-for-a-new-event)
9. [Customisation Reference](#9-customisation-reference)
10. [Design System & CSS Tokens](#10-design-system--css-tokens)
11. [Known Limitations](#11-known-limitations)

---

## 1. System Overview & Architecture

### What it does

The AV Management System gives an event AV lead a single place to track presentation and video files across all event days. The vendor AV team gets a live, read-only dashboard showing which files are approved, updated, or on hold — with direct download links, AV production requirements per session, and a change log feed.

All data lives in a single JSON file committed to a GitHub repository. The admin edits data through a browser-based form and saves it via the GitHub Contents API — no server, no command line, no file drag required.

### Architecture

```
Admin page (app/admin.html)
  └─ GitHub Contents API PUT
        └─ data/av-data.json  ←  single source of truth
              └─ raw.githubusercontent.com fetch
                    └─ Dashboard (app/dashboard.html)
```

- **Admin saves** → GitHub Contents API `PUT` commits `av-data.json` to the repo
- **GitHub Pages** serves the static files over HTTPS
- **Dashboard loads** → `fetch()` pulls `av-data.json` from `raw.githubusercontent.com`
- **Download links** point to IBM Box shared files — Box controls who can actually download
- **Latency**: ~30–60 seconds from admin save to live dashboard update

### Technology stack

| Layer | Technology | Why |
|---|---|---|
| Hosting | GitHub Pages | Free, HTTPS, no server config, auto-deploys on push |
| Data storage | JSON file in GitHub repo | Version controlled, readable, editable via API from any browser |
| Save mechanism | GitHub Contents API (PUT) | Works in any browser including Safari; no file system access needed |
| File hosting | IBM Box | Existing enterprise storage; access controlled per file share |
| Frontend | Vanilla HTML + CSS + JS | No build step, no dependencies, no framework |
| Auth | GitHub Personal Access Token | Stored in `localStorage`; admin-only; vendor has no token |

---

## 2. Repository Structure

```
repo-root/
├── index.html               ← redirects to app/dashboard.html
├── app/
│   ├── dashboard.html       ← AV team read-only view
│   └── admin.html           ← Admin edit & save UI
├── docs/
│   ├── admin-guide.html     ← Admin how-to guide
│   ├── av-team-guide.html   ← AV vendor team guide
│   └── project-spec.html    ← Full project specification
└── data/
    └── av-data.json         ← Single source of truth (do not move)
```

Box Drive workspace (local sync):

```
ZDC [Year] [Season]/         ← Box Drive root for this event
├── av-management/           ← local clone of this GitHub repo
├── Data/                    ← agenda XLSX, floor plans, master JSON
├── Box Links/               ← event branding images
└── files/                   ← presentation .pptx / video .mp4 files
```

---

## 3. Data Model — `av-data.json`

### Top-level

```json
{
  "lastRefresh": "October 19, 2026 · 9:00 AM",
  "days": [ ...array of day objects... ]
}
```

| Field | Type | Description |
|---|---|---|
| `lastRefresh` | string | Human-readable timestamp shown in the dashboard header |
| `days` | array | Ordered array of event day objects |

### Day object

```json
{
  "id": "day-1",
  "label": "Day 1 · October 19",
  "files": [ ...session file objects... ],
  "changeLog": [ ...change log entries... ]
}
```

### Session file object

```json
{
  "sessionTime": "08:30",
  "sessionTitle": "Welcome & Opening Remarks",
  "fileName": "Day1-Opening Remarks.pptx",
  "type": "Presentation",
  "status": "ready",
  "freshness": "new",
  "updatedAt": "8:45 AM",
  "updatedNote": "Final version from presenter",
  "notes": ["Do not project until status is Ready"],
  "downloadUrl": "https://ibm.box.com/shared/static/xxxxx.pptx",
  "avDetails": {
    "microphones": "2 handheld, 1 lav",
    "stageSetup": "Podium",
    "confidenceMonitor": "Yes, downstage center",
    "clicker": "Yes",
    "timer": "30",
    "specialNotes": ""
  }
}
```

| Field | Values | Description |
|---|---|---|
| `status` | `ready` · `updated` · `hold` | Core status driving badge colour and download link |
| `freshness` | `new` · `changed` · _(omit)_ | Highlights row. Clear once acknowledged. |
| `type` | `Presentation` · `Video` | Used for the Videos stat counter |
| `downloadUrl` | URL string | Box direct download link. Use `#` as placeholder. |

### Change log entry

```json
{ "time": "9:20 AM", "title": "Deck updated", "description": "Replace the preloaded copy." }
```

---

## 4. How Each Page Works

### `app/dashboard.html`

- Fetches `data/av-data.json` from `raw.githubusercontent.com` on load with cache-busting (`?t=Date.now()`)
- Retries automatically every 10 seconds on failure
- Renders filterable/sortable session table, summary stats, change log timeline, expandable AV detail rows
- No authentication, no write access

**Key constant to update per event:**
```js
const DATA_URL = 'https://raw.githubusercontent.com/[ORG]/[REPO]/main/data/av-data.json';
```

### `app/admin.html`

- On load: calls GitHub Contents API `GET` with the stored token → receives file content (base64) and current SHA
- Decodes base64 via `Uint8Array` + `TextDecoder('utf-8')` (handles multi-byte characters correctly)
- All edits held in memory until **💾 Save to GitHub** is clicked
- Save: calls `PUT /repos/[org]/[repo]/contents/data/av-data.json` with updated content, commit message, and current SHA
- Token read from: `window.location.hash` on first visit (then saved to `localStorage`), or `localStorage` on all subsequent visits

**Key constants to update per event:**
```js
const REPO      = '[ORG]/[REPO]';
const BRANCH    = 'main';
const FILE_PATH = 'data/av-data.json';
const API_URL   = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
```

### `index.html`

Single `<meta http-equiv="refresh">` redirect to `app/dashboard.html`. Must stay at the repo root — not inside `app/`.

### `docs/` guides

Static HTML, no JavaScript. Update text content only when re-deploying for a new event.

---

## 5. GitHub Pages Setup

**Requirements:**
- Repository must be **public** for free GitHub Pages. Private repos require GitHub Team ($4/user/month).
- Pages source: branch `main`, path `/` (root)

**Enable via API:**
```bash
curl -X POST \
  -H "Authorization: token YOUR_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/[ORG]/[REPO]/pages \
  -d '{"source":{"branch":"main","path":"/"}}'
```

**Enable via GitHub UI:**
Repository → **Settings** → **Pages** → Source: Deploy from branch → Branch: `main` → Folder: `/ (root)` → Save.

**Resulting URL pattern:**
```
https://[ORG].github.io/[REPO]/app/dashboard.html
https://[ORG].github.io/[REPO]/app/admin.html
https://[ORG].github.io/[REPO]/docs/admin-guide.html
https://[ORG].github.io/[REPO]/docs/av-team-guide.html
```

---

## 6. Authentication — GitHub Token

**Token requirements:**
- Type: Personal Access Token (classic)
- Required scope: `repo`
- Must belong to an account with **write access** to the repository

**Storage:**
- Never hardcoded in any file (repo is public)
- Stored in `localStorage` under key `gh_token` on the GitHub Pages origin
- Cleared via the **Clear** button in the token panel, or by clearing browser data

**First-time setup — hash fragment method:**
```
https://[ORG].github.io/[REPO]/app/admin.html#YOUR_TOKEN
```
Open this URL once. The page extracts the token, saves it to `localStorage`, and strips it from the address bar automatically.

> ⚠️ Do not share this URL. Revoke and regenerate the token after the event.

---

## 7. IBM Box Integration

Box is used exclusively for **file storage and access control**. The AV system stores Box shared links as strings inside `av-data.json`.

**Convert a Box shared link to a direct download link:**
```
Preview:  https://ibm.box.com/s/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Direct:   https://ibm.box.com/shared/static/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.pptx
```
Replace `/s/` with `/shared/static/` and append the file extension.

**Access control:**
- Dashboard and JSON are public — session metadata is visible to anyone
- Box file access is controlled separately by Box sharing settings
- Share files with the AV vendor team's Box accounts directly, not as "Anyone with the link"
- Upload all event media files to the `files/` folder in Box Drive

---

## 8. Re-onboarding for a New Event

### Checklist

- [ ] Create a new GitHub repository under the event organisation (set to **public**)
- [ ] Copy all files from the previous event's `av-management/` folder
- [ ] Update constants in `app/dashboard.html` and `app/admin.html` (see Section 4)
- [ ] Update page `<title>` tags and `<h1>` headings in all files
- [ ] Reset `data/av-data.json` — clear all days/sessions, update `lastRefresh`
- [ ] Enable GitHub Pages on the new repo (see Section 5)
- [ ] Generate a new GitHub token and seed it via the hash fragment method (see Section 6)
- [ ] Create a new Box Drive folder for the event with a `files/` subfolder
- [ ] Share the new dashboard URL and AV team guide URL with the vendor team

> ✅ Full setup takes approximately 15 minutes.

### What to update in each file

| File | What to change |
|---|---|
| `app/dashboard.html` | `DATA_URL` constant · `<title>` · `<h1>` event name |
| `app/admin.html` | `REPO` · `API_URL` · `<title>` · `<h1>` event name |
| `docs/admin-guide.html` | `<title>` · cover heading · any event-specific text |
| `docs/av-team-guide.html` | `<title>` · cover heading · dashboard URL in the URL block |
| `data/av-data.json` | Clear all days/files · update `lastRefresh` · add new event days |
| `index.html` | No change needed — redirect is generic |

---

## 9. Customisation Reference

### Adding a new status type

1. Add a CSS rule in `app/dashboard.html`: `.badge-[name] { color: ...; background: ...; }`
2. Add the value to `statusLabels` and `statusClasses` objects in the dashboard script
3. Add the option to `<select id="m-status">` in `app/admin.html`
4. Add the filter option to `<select id="status">` in `app/dashboard.html`

### Adding a new session field

1. Add the field to the JSON (edit a session in admin to populate it)
2. Add an input to the modal in `app/admin.html`
3. Read and write the field in `openModal()` and `saveModal()`
4. Render it in `renderFileRows()` in `app/dashboard.html`

### Adding auto-refresh to the dashboard

Insert at the bottom of the dashboard script:
```js
setInterval(initialize, 60000); // refresh every 60 seconds
```

---

## 10. Design System & CSS Tokens

All pages share the same CSS custom properties defined in `:root`:

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#f4f6f8` | Page background |
| `--surface` | `#ffffff` | Card / panel background |
| `--surface-alt` | `#f7f8fa` | Table header, input background |
| `--border` | `#d0d7de` | All borders |
| `--text` | `#1f2328` | Primary text |
| `--muted` | `#57606a` | Secondary / label text |
| `--accent` | `#3b82d4` | Links, primary buttons, Updated badge |
| `--success` | `#1a7f37` | Ready badge, ok messages |
| `--warning` | `#9a6700` | On hold badge, warning messages |
| `--danger` | `#cf222e` | Error messages, delete buttons |

---

## 11. Known Limitations

| Limitation | Impact | Workaround |
|---|---|---|
| Dashboard data is public | Session metadata visible to anyone with the URL | Box controls actual file downloads. Upgrade to GitHub Team for a private repo. |
| ~30–60s publish delay | Dashboard lags behind admin saves | Vendor must refresh browser. Add `setInterval(initialize, 60000)` for auto-refresh. |
| Single admin user | Concurrent edits cause SHA mismatch on second save | Designed for one admin. Second save shows error; reload and re-apply. |
| No edit history UI | Admin cannot browse previous data versions | Full history in GitHub commit log at `github.com/[org]/[repo]/commits/main` |
| Token in localStorage | Extractable via browser DevTools | Use minimal scope token. Revoke and regenerate after the event. |
| No offline support | Dashboard requires internet to fetch data | Falls back to retry loop on failure. |

---

*AV Management System · ZDC 2026 Fall · ibmzdc/av-management*
