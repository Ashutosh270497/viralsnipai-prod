# Browser Extension Improvement Plan

**Extension:** SnipRadar for X
**Date:** 2026-03-07
**Scope:** Gap analysis vs SuperX, Tweet Hunter, Typefully, Hypefury + prioritized implementation roadmap

---

## Current State Summary

The extension is a Manifest V3 Chrome-only extension for x.com / twitter.com.

### What exists today

**Content script (injected into X)**
- "SnipRadar" toggle button appended to every tweet article
- Floating launcher on profile pages
- 4 actions per tweet: Save to inbox, Reply assist, Generate remix, Track author
- Toast notifications for action feedback
- MutationObserver to handle X's SPA navigation

**Popup**
- Session status (user name + connected X username)
- Manual base URL config field (developer detail, visible to all users)
- Last 5 captures preview
- "Open Inbox" and "Open Login" buttons

**Backend API endpoints**
- `GET /api/snipradar/extension/session` — auth check
- `POST /api/snipradar/extension/reply` — AI reply generation (style-profile aware, rate-limited)
- `POST /api/snipradar/extension/remix` — AI remix generation (rate-limited)
- `POST /api/snipradar/extension/track` — add author to tracked accounts, syncs to relationship graph
- `POST /api/snipradar/inbox` — save capture to research inbox

**Key files**
- `apps/browser-extension/manifest.json`
- `apps/browser-extension/content-script.js`
- `apps/browser-extension/content-script.css`
- `apps/browser-extension/popup.html`
- `apps/browser-extension/popup.js`
- `apps/browser-extension/service-worker.js`
- `apps/web/app/api/snipradar/extension/session/route.ts`
- `apps/web/app/api/snipradar/extension/reply/route.ts`
- `apps/web/app/api/snipradar/extension/remix/route.ts`
- `apps/web/app/api/snipradar/extension/track/route.ts`

---

## Competitor Feature Matrix

| Feature | Ours | SuperX | Tweet Hunter | Typefully | Hypefury |
|---|---|---|---|---|---|
| Save tweet to inbox | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reply assist | ✅ clipboard only | ✅ inline editor | ✅ inline editor | ✅ inline editor | ✅ |
| Track account | ✅ | ✅ | ✅ | — | — |
| Inline remix | ✅ clipboard only | ✅ | ✅ | — | — |
| Compose from popup | ❌ | ✅ | ✅ | ✅ | ✅ |
| Full thread capture | ❌ | ✅ | ✅ | — | — |
| Capture engagement metrics | ❌ | ✅ | ✅ | — | — |
| Visual "already saved" state | ❌ | ✅ | ✅ | — | — |
| Keyboard shortcut | ❌ | ✅ | — | ✅ | — |
| Right-click context menu | ❌ | ✅ | — | — | — |
| Virality score shown inline | ❌ | ✅ | ✅ | — | — |
| Edit generated content inline | ❌ | ✅ | ✅ | ✅ | — |
| One-click post from X | ❌ | ✅ | — | ✅ | — |
| Extension badge counter | ❌ | ✅ | — | — | — |
| Firefox support | ❌ | ✅ | ✅ | ✅ | — |
| Auth flow inside extension | ❌ | ✅ | ✅ | ✅ | ✅ |
| Manual URL config exposed to user | ❌ bad UX | — | — | — | — |
| Real notification icon | ❌ 1×1 px | ✅ | ✅ | ✅ | ✅ |

---

## Gap Details

### Gap 1 — Reply and Remix output is clipboard-only, not editable inline

**Current behaviour**
Click "Reply assist" → wait for API → result silently copied to clipboard → toast "Reply copied".
User must manually switch to X's reply box, paste, then edit.

**Competitor behaviour**
SuperX and Tweet Hunter inject a floating overlay panel directly below the tweet with an editable textarea pre-filled with the generated content. User edits inline, then clicks "Copy" or "Post". The entire flow happens without leaving the tweet.

**What to build**
After the API returns, instead of `navigator.clipboard.writeText`, render an overlay panel inside the content script containing:
- Editable `<textarea>` pre-filled with the generated reply or remix
- "Copy" button
- "Post as reply" button (opens X native compose or clicks native Reply)
- Character counter (X is 280 chars)
- Close button

**Files to change**
- `apps/browser-extension/content-script.js` — add `buildResultOverlay(text, options)` function
- `apps/browser-extension/content-script.css` — overlay panel styles

---

### Gap 2 — Popup exposes the app URL config to real users

**Current behaviour**
The popup's first section is a URL input field labelled "SnipRadar app URL" with placeholder `http://localhost:3000`. Every user sees this, including production users who have no reason to change it.

**What to build**
- Hard-code the production URL as the default in `service-worker.js`: `const DEFAULT_BASE_URL = "https://viralsnipai.com"`
- Remove the URL input and Save URL button from `popup.html` / `popup.js` entirely
- Move the URL override into a hidden developer settings section, accessible only via a keyboard shortcut in the popup (e.g., `Shift+D` reveals it)

**Files to change**
- `apps/browser-extension/service-worker.js` — change `DEFAULT_BASE_URL`
- `apps/browser-extension/popup.html` — remove URL panel, add developer toggle
- `apps/browser-extension/popup.js` — remove save URL handler, add developer toggle logic

---

### Gap 3 — No "already saved" visual state on tweet buttons

**Current behaviour**
After saving a tweet, the green "SnipRadar" toggle button remains identical. The user has no indication that this tweet is already in their inbox. Duplicate saves are possible.

**What to build**
- After a successful save, set a `data-snipradar-saved="true"` attribute on the article element
- Change the toggle button label to "Saved ✓" and apply a muted grey style
- On `injectTweetMenus`, check for this attribute and skip re-binding already-saved tweets
- Optionally store saved tweet IDs in `chrome.storage.session` so state persists across feed scrolls

**Files to change**
- `apps/browser-extension/content-script.js` — update `executeAction` save handler and `injectTweetMenus`
- `apps/browser-extension/content-script.css` — add `.snipradar-toggle--saved` style (grey, no shadow)

---

### Gap 4 — Thread capture only picks up the first tweet

**Current behaviour**
`buildTweetCapture` takes a single `article` element. When navigating to a thread URL (`/username/status/123`), only the first article is captured. The rest of the thread is ignored.

**Competitor behaviour**
SuperX and Tweet Hunter detect when the page is a thread (pathname matches `/status/`), collect all `article[data-testid="tweet"]` elements in DOM order, and assemble them into a single structured document with numbered posts and metadata per post.

**What to build**
Add a `buildThreadCapture()` function that:
1. Detects thread pages: `location.pathname.includes("/status/")`
2. Collects all `article[data-testid="tweet"]` in the page
3. Joins the text as an ordered array: `[{ index, text, authorUsername, tweetId }, ...]`
4. Sends a single inbox item with `itemType: "thread"` and `metadata.posts` containing the array

Add a "Save thread" button to the top-most tweet's menu when on a thread page.

**Files to change**
- `apps/browser-extension/content-script.js` — add `buildThreadCapture()`, update `injectTweetMenus`
- `apps/web/app/api/snipradar/inbox/route.ts` — ensure `metadata.posts` is stored in the `XResearchInboxItem`

---

### Gap 5 — Engagement metrics not captured from DOM

**Current behaviour**
`buildTweetCapture` extracts only: tweet text, status URL, tweet ID, author username, author display name.

**What is available in DOM**
X renders like count, retweet count, reply count, and view count as `aria-label` attributes on the action bar buttons inside each article.

**What to build**
Extend `buildTweetCapture` to also scrape:
- `likeCount` — from `[data-testid="like"] span` aria-label or inner text
- `retweetCount` — from `[data-testid="retweet"] span`
- `replyCount` — from `[data-testid="reply"] span`
- `viewCount` — from the analytics icon span when present

Store these in `metadata.engagement` on the captured inbox item. Display them in the Research Inbox UI.

**Files to change**
- `apps/browser-extension/content-script.js` — extend `buildTweetCapture`
- `apps/web/app/api/snipradar/inbox/route.ts` — pass through `metadata.engagement`
- `apps/web/app/(workspace)/snipradar/inbox/page.tsx` — display engagement counts on inbox cards

---

### Gap 6 — No Quick Compose in popup

**Current behaviour**
Popup is read-only: session status and recent captures. No way to write or queue a post without opening the full app.

**Competitor behaviour**
Typefully, Tweet Hunter, and Hypefury all have a textarea in the popup with "Save as draft" and optionally "Schedule". This makes the popup a daily productivity tool, not just a monitoring widget.

**What to build**
Add a "Quick Draft" section to the popup:
- `<textarea>` with 280-char counter
- "Save as draft" button → `POST /api/snipradar/drafts` with `{ content, source: "extension_popup" }`
- Optional: "Schedule for best time" toggle

**Files to change**
- `apps/browser-extension/popup.html` — add quick-draft section
- `apps/browser-extension/popup.js` — add draft save handler
- `apps/browser-extension/popup.css` — textarea and counter styles
- `apps/web/app/api/snipradar/drafts/route.ts` — already exists, verify it accepts `source` field

---

### Gap 7 — Extension badge does not update

**Current behaviour**
The extension toolbar icon shows no badge. Users have no ambient signal to open the extension.

**What to build**
- On each popup open, fetch unread inbox count from `GET /api/snipradar/inbox?status=new&limit=0`
- Set `chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" })`
- Set `chrome.action.setBadgeBackgroundColor({ color: "#10b981" })`
- Poll every 30 minutes from service worker to keep badge fresh in the background

**Files to change**
- `apps/browser-extension/service-worker.js` — add badge polling logic
- `apps/browser-extension/popup.js` — trigger badge refresh on open
- `apps/web/app/api/snipradar/inbox/route.ts` — ensure `?status=new` filter works with count-only mode

---

### Gap 8 — No keyboard shortcut

**Current behaviour**
No keyboard shortcut is defined. Users must click the toolbar icon to open the popup.

**What to build**
Add to `manifest.json`:
```json
"commands": {
  "_execute_action": {
    "suggested_key": { "default": "Alt+S" },
    "description": "Open SnipRadar"
  },
  "save-focused-tweet": {
    "suggested_key": { "default": "Alt+Shift+S" },
    "description": "Save focused tweet to SnipRadar inbox"
  }
}
```
Handle `save-focused-tweet` in `content-script.js` by finding the currently hovered or focused `article` and triggering the save action.

**Files to change**
- `apps/browser-extension/manifest.json` — add `commands`
- `apps/browser-extension/content-script.js` — add `chrome.runtime.onMessage` handler for `save-focused-tweet`
- `apps/browser-extension/service-worker.js` — forward `chrome.commands` to content script

---

### Gap 9 — Notification icon is a 1×1 blank pixel

**Current behaviour**
`service-worker.js` `notify()` uses a hardcoded base64 1×1 PNG as the icon. Chrome displays a blank icon for all extension notifications.

**What to build**
- Add a proper icon file: `apps/browser-extension/icons/icon-128.png` (128×128 SnipRadar logo)
- Update `manifest.json` to declare `"icons": { "128": "icons/icon-128.png" }`
- Update `notify()` to use `iconUrl: chrome.runtime.getURL("icons/icon-128.png")`

**Files to change**
- `apps/browser-extension/manifest.json` — add icons declaration
- `apps/browser-extension/service-worker.js` — fix `iconUrl` in `notify()`
- Add `apps/browser-extension/icons/icon-128.png` (and 16, 32, 48 sizes for toolbar)

---

### Gap 10 — Auth requires leaving X (opens new tab)

**Current behaviour**
If the session check fails, the only option is "Open login" which creates a new tab to `/signin`. This breaks the user's browsing flow.

**What to build**
Use `chrome.windows.create` to open a small popup window (not a new tab) pointing to `/signin?extension=true`. After login, the app can `postMessage` or redirect to a special callback URL that the extension detects via `chrome.tabs.onUpdated`, then closes the window and refreshes the session.

Backend addition: `GET /signin?extension=true` can redirect to a lightweight auth-success page that `postMessage`s to the extension.

**Files to change**
- `apps/browser-extension/popup.js` — replace `open-login` handler with `chrome.windows.create` popup
- `apps/browser-extension/service-worker.js` — add `chrome.tabs.onUpdated` listener for auth callback
- `apps/web/app/signin/page.tsx` — detect `?extension=true` and post message on success

---

### Gap 11 — Chrome only, no Firefox

**Current behaviour**
Manifest V3 is declared but only Chrome is supported. Firefox supports MV3 since version 109.

**What to build**
- Audit `chrome.*` API calls and add `browser.*` polyfill for Firefox compatibility
- Replace all `chrome.storage`, `chrome.runtime`, `chrome.tabs`, `chrome.notifications` with the [`webextension-polyfill`](https://github.com/mozilla/webextension-polyfill) library
- Test on Firefox Developer Edition
- Update README with Firefox load instructions

**Files to change**
- All files in `apps/browser-extension/` — replace `chrome.*` with `browser.*` via polyfill
- `apps/browser-extension/manifest.json` — verify `browser_specific_settings` for Firefox if needed

---

## Prioritised Implementation Order

### Phase 1 — P0: Visible UX regressions (ship first, highest ROI per hour)

| # | Gap | Effort | Impact |
|---|---|---|---|
| 1 | Inline result overlay for reply/remix | 2–3 days | Critical — core UX broken without this |
| 2 | Remove manual URL config from popup | 1 hour | Users see a broken-looking popup today |
| 3 | "Already saved" visual state on tweet buttons | Half day | Prevents duplicate saves, feels polished |
| 4 | Real notification icon (replace 1×1 px) | 1 hour | Notifications are broken without this |

### Phase 2 — P1: Feature parity gaps (closes distance vs SuperX / Tweet Hunter)

| # | Gap | Effort | Impact |
|---|---|---|---|
| 5 | Capture engagement metrics from DOM | 1 day | Qualifies viral content at capture time |
| 6 | Full thread capture | 1–2 days | Most high-value X content is threads |
| 7 | Extension badge counter | Half day | Daily habit — users see unread count |
| 8 | Keyboard shortcut (Alt+S / Alt+Shift+S) | Half day | Power-user feature, easy to add |

### Phase 3 — P2: Productivity features (increases daily active use)

| # | Gap | Effort | Impact |
|---|---|---|---|
| 9 | Quick Compose in popup | 2 days | Makes popup a daily writing tool |
| 10 | In-extension auth flow (popup window) | 2 days | Removes onboarding friction |

### Phase 4 — P3: Distribution expansion

| # | Gap | Effort | Impact |
|---|---|---|---|
| 11 | Firefox manifest support + polyfill | 1–2 days | Broader install base |
| 12 | Chrome Web Store submission | 1 day ops | Required for non-developer installs |

---

## Notes for Implementation

**Session auth pattern**
The extension reuses the existing NextAuth cookie session via `credentials: "include"` on all `apiFetch` calls. This means the user must be signed into SnipRadar in the same browser profile. This is the correct approach and should not change. The auth flow improvement (Gap 10) handles the case where they are not yet signed in.

**DOM selectors are fragile**
All `data-testid` selectors in `content-script.js` rely on X's internal test IDs. These can change without notice. Consider adding a lightweight smoke test script that validates selectors still work (similar to `scripts/snipradar-smoke.js` in the web app).

**Rate limiting already in place**
The reply and remix API endpoints already have rate limiting via `consumeSnipRadarRateLimit`. New endpoints (quick compose, badge count) should also use this pattern.

**Style profile awareness**
The reply generator already reads `xStyleProfile` for the user. Ensure the Quick Compose textarea in the popup also notes to the user that their style profile will be applied if they use AI assistance.

**Do not break existing captures**
When adding `metadata.engagement` and `metadata.posts` to captures, ensure the Prisma schema for `XResearchInboxItem.metadata` is `Json?` (already the case) and that the Inbox UI degrades gracefully when these fields are absent on older captures.
