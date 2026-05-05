# SnipRadar Browser Extension Execution Plan

Date: 2026-03-07
Based on: `docs/extension_improvement.md`

## Goal

Close the highest-value usability and parity gaps in the SnipRadar browser extension without breaking the current `Research Inbox`, `Reply assist`, `Remix`, and `Track author` flows.

## Source Of Truth

This execution plan translates `docs/extension_improvement.md` into repo-specific implementation steps.

It is adjusted to match the current codebase, especially:

- `apps/browser-extension/content-script.js`
- `apps/browser-extension/popup.html`
- `apps/browser-extension/popup.js`
- `apps/browser-extension/service-worker.js`
- `apps/web/app/api/snipradar/inbox/route.ts`
- `apps/web/app/api/snipradar/drafts/route.ts`

## Current Repo Constraints

1. The extension is a local MV3 extension, not yet Chrome Web Store distributed.
2. The session model is cookie-based via `credentials: "include"` and should remain that way.
3. `POST /api/snipradar/drafts` currently generates AI drafts; it does not accept arbitrary manual draft text from the popup.
4. Inbox capture metadata is already `Json?`, so thread posts and engagement metrics can be added without a Prisma schema change.

## Recommended Implementation Order

### Phase 1: P0 UX fixes

Status: implemented

#### 1. Inline result overlay for reply/remix

Why first:

- current clipboard-only flow is the most obvious UX gap
- it affects the core extension actions users try first

Implementation:

- add a result overlay rendered from `content-script.js`
- show editable textarea, char counter, close action, copy action
- add `Post as reply` that focuses the X composer and injects the current text

Files:

- `apps/browser-extension/content-script.js`
- `apps/browser-extension/content-script.css`

Acceptance criteria:

- reply/remix no longer only copy silently to clipboard
- user can edit generated text before posting
- overlay positions correctly on feed and thread pages

#### 2. Remove exposed app URL config from main popup

Why first:

- the popup currently looks like a developer tool
- this is low effort and immediately improves trust

Implementation:

- set production default URL in `service-worker.js`
- remove visible URL controls from the main popup
- keep a hidden developer override behind `Shift+D`

Files:

- `apps/browser-extension/service-worker.js`
- `apps/browser-extension/popup.html`
- `apps/browser-extension/popup.js`
- `apps/browser-extension/popup.css`

Acceptance criteria:

- normal users only see session, inbox preview, and extension actions
- local developers can still override the base URL intentionally

#### 3. Add saved-state feedback on tweets

Why first:

- duplicate capture ambiguity makes the extension feel unfinished

Implementation:

- mark saved tweet elements with `data-snipradar-saved="true"`
- switch button state to `Saved`
- cache saved tweet IDs in `chrome.storage.session`

Files:

- `apps/browser-extension/content-script.js`
- `apps/browser-extension/content-script.css`

Acceptance criteria:

- saved tweets render a distinct state
- duplicate clicks do not feel identical to first-save clicks

#### 4. Replace the blank notification icon

Why first:

- notifications currently look broken
- this is low-risk and production polish

Implementation:

- add real extension icons
- wire icon declarations into the manifest
- use the packaged icon in notifications

Files:

- `apps/browser-extension/icons/*`
- `apps/browser-extension/manifest.json`
- `apps/browser-extension/service-worker.js`

Acceptance criteria:

- Chrome notifications show a real SnipRadar icon

### Phase 2: P1 parity features

Status: next

#### 5. Capture engagement metrics from the DOM

Implementation:

- scrape likes, reposts, replies, and views in `buildTweetCapture`
- store them in `metadata.engagement`
- display them in Inbox cards

Files:

- `apps/browser-extension/content-script.js`
- `apps/web/app/api/snipradar/inbox/route.ts`
- `apps/web/app/(workspace)/snipradar/inbox/page.tsx`

Acceptance criteria:

- new captures include DOM engagement data when present
- inbox cards show metrics gracefully when metrics exist

#### 6. Full thread capture

Implementation:

- add `buildThreadCapture()`
- attach `Save thread` on thread pages
- store ordered posts in `metadata.posts`

Files:

- `apps/browser-extension/content-script.js`
- `apps/web/app/api/snipradar/inbox/route.ts`

Acceptance criteria:

- thread pages save multi-post structure, not only the first article

#### 7. Extension badge counter

Implementation:

- expose a count-only inbox response mode
- refresh badge in popup and service worker

Files:

- `apps/browser-extension/service-worker.js`
- `apps/browser-extension/popup.js`
- `apps/web/app/api/snipradar/inbox/route.ts`

Repo-specific note:

- current inbox route returns items plus counts; add an explicit lightweight mode such as `?countsOnly=true` or `?limit=0` with count support

Acceptance criteria:

- unread/new inbox count appears on the extension badge

#### 8. Keyboard shortcuts

Implementation:

- add manifest commands
- handle popup open and save-focused-tweet flow

Files:

- `apps/browser-extension/manifest.json`
- `apps/browser-extension/service-worker.js`
- `apps/browser-extension/content-script.js`

Acceptance criteria:

- users can open the extension and save the focused tweet via keyboard

### Phase 3: P2 productivity upgrades

Status: pending

#### 9. Quick Draft in popup

Implementation:

- add popup textarea with char counter
- add `Save as draft`
- optionally add `Schedule for best time`

Files:

- `apps/browser-extension/popup.html`
- `apps/browser-extension/popup.js`
- `apps/browser-extension/popup.css`

Backend requirement:

- do not reuse the current `POST /api/snipradar/drafts` route as-is
- add either:
  - `POST /api/snipradar/drafts/manual`, or
  - extend `POST /api/snipradar/drafts` to support a distinct manual-create mode

Recommended approach:

- create `POST /api/snipradar/drafts/manual`
- keep the existing AI draft-generation route untouched to avoid regression

Acceptance criteria:

- popup can save a manual draft without opening the app
- manual draft creation does not interfere with AI draft generation

#### 10. In-extension auth popup flow

Implementation:

- replace full-tab login with a popup auth window
- detect auth success and refresh extension session

Files:

- `apps/browser-extension/popup.js`
- `apps/browser-extension/service-worker.js`
- `apps/web/app/signin/page.tsx`

Acceptance criteria:

- if signed out, user can authenticate and return to X without manual tab cleanup

### Phase 4: P3 distribution expansion

Status: pending

#### 11. Firefox support

Implementation:

- add `webextension-polyfill`
- migrate direct `chrome.*` usage to browser-compatible APIs
- validate manifest compatibility

Files:

- all files in `apps/browser-extension/`

Acceptance criteria:

- extension loads in Firefox Developer Edition with the same core actions

#### 12. Chrome Web Store packaging

Implementation:

- finalize icons, descriptions, screenshots, versioning, permissions review
- package and submit

Files:

- `apps/browser-extension/manifest.json`
- store collateral outside repo or under docs/assets if needed

Acceptance criteria:

- extension is ready for non-developer installation

## Validation Plan

For every phase:

- `node --check apps/browser-extension/content-script.js`
- `node --check apps/browser-extension/popup.js`
- `node --check apps/browser-extension/service-worker.js`
- `pnpm --filter web exec tsc -p tsconfig.snipradar.json --noEmit`

Add focused tests where backend changes are introduced:

- inbox route tests for `metadata.engagement`
- inbox route tests for `metadata.posts`
- manual draft route tests for popup compose

Manual smoke checklist:

1. Load unpacked extension
2. Verify session status in popup
3. Save tweet
4. Save thread
5. Generate reply and edit inline
6. Generate remix and edit inline
7. Track author
8. Confirm inbox badge updates
9. Confirm new capture shows in `/snipradar/inbox`

## Rollout Notes

- P0 and P1 can ship without Prisma changes
- P2 quick compose should be isolated behind a new manual-draft endpoint
- Firefox and Web Store work should happen only after Chrome UX is stable

## Recommended Next Build

Start with Phase 1 in this exact order:

1. Inline result overlay
2. Popup cleanup
3. Saved-state feedback
4. Notification icon

That gives the largest visible improvement with the least backend risk.
