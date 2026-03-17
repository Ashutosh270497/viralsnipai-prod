# SnipRadar Browser Extension

This is a loadable unpacked Manifest V3 extension for `Browser Extension + Research Inbox`.

## What it does

- injects `SnipRadar` controls into tweets on `x.com` / `twitter.com`
- adds a floating `SnipRadar` launcher on profile pages
- saves tweets, threads, and profiles into SnipRadar Research Inbox
- can generate reply assists and remixes
- can add the author to tracked accounts

## Load locally

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select `apps/browser-extension`

## Configure

1. Open the extension popup
2. Set the SnipRadar app URL
3. Sign in to SnipRadar in the same browser session
4. Open the popup again and confirm session status

For local dev, use one of:

- `http://localhost:3000`
- `http://localhost:3001`
- `http://localhost:3200`

## Notes

- The extension reuses the existing authenticated SnipRadar web session
- Captures land in `/snipradar/inbox`
- If you change the app URL, refresh the popup session state before testing actions
