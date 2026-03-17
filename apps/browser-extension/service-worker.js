const DEFAULT_BASE_URL = "https://viralsnipai.com";
const BASE_URL_CANDIDATES = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3200",
  DEFAULT_BASE_URL,
];

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).trim().replace(/\/$/, "");
}

async function getStoredBaseUrl() {
  const { baseUrl } = await chrome.storage.sync.get({ baseUrl: DEFAULT_BASE_URL });
  return normalizeBaseUrl(baseUrl || DEFAULT_BASE_URL);
}

async function getBaseUrl() {
  return getStoredBaseUrl();
}

async function setBaseUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl || DEFAULT_BASE_URL);
  await chrome.storage.sync.set({ baseUrl: normalized });
  return normalized;
}

async function resetBaseUrl() {
  await chrome.storage.sync.set({ baseUrl: DEFAULT_BASE_URL });
  return DEFAULT_BASE_URL;
}

async function performFetch(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data && data.error ? data.error : `Request failed (${response.status})`);
  }

  return { data, baseUrl };
}

async function discoverWorkingBaseUrl(excludeBaseUrl) {
  const storedBaseUrl = await getStoredBaseUrl();
  const candidates = Array.from(
    new Set([storedBaseUrl, ...BASE_URL_CANDIDATES].map(normalizeBaseUrl))
  ).filter((baseUrl) => baseUrl !== excludeBaseUrl);

  for (const baseUrl of candidates) {
    try {
      const response = await fetch(`${baseUrl}/api/snipradar/extension/session`, {
        method: "GET",
        credentials: "include",
      });
      if (response.status === 200 || response.status === 401) {
        await chrome.storage.sync.set({ baseUrl });
        return baseUrl;
      }
    } catch (_error) {
      // Try the next candidate.
    }
  }

  return null;
}

async function apiFetch(path, options = {}, retryOnAlternateBase = true) {
  const baseUrl = await getBaseUrl();

  try {
    return await performFetch(baseUrl, path, options);
  } catch (error) {
    const isMethodMismatch =
      error instanceof Error &&
      /Request failed \((404|405)\)/.test(error.message);
    if (!retryOnAlternateBase || !isMethodMismatch) {
      throw error;
    }

    const alternateBaseUrl = await discoverWorkingBaseUrl(baseUrl);
    if (!alternateBaseUrl) {
      throw error;
    }

    return performFetch(alternateBaseUrl, path, options);
  }
}

function notify(message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
    title: "SnipRadar",
    message,
  });
}

async function openIntentPopup(url) {
  const popup = await chrome.windows.create({
    url,
    type: "popup",
    width: 550,
    height: 420,
    focused: true,
  });

  return {
    id: popup.id ?? null,
    tabs: popup.tabs?.map((tab) => ({
      id: tab.id ?? null,
      url: tab.url ?? null,
    })) ?? [],
  };
}

async function injectReplyIntoActiveComposer(tabId, text) {
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [text],
    func: async (generatedText) => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      const isVisible = (node) => {
        if (!(node instanceof Element)) return false;
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        );
      };

      const composerSelectors = [
        '[data-testid="reply-tweet-modal"] [data-testid="tweetTextarea_0"] [contenteditable="true"]',
        '[data-testid="reply-tweet-modal"] [data-testid="tweetTextarea_0"]',
        'div[role="dialog"] [data-testid="tweetTextarea_0"] [contenteditable="true"]',
        'div[role="dialog"] [data-testid="tweetTextarea_0"]',
        '[data-testid="tweetTextarea_0"] [contenteditable="true"]',
        '[data-testid="tweetTextarea_0"]',
        'div[role="dialog"] div[role="textbox"][contenteditable="true"]',
        'div[role="dialog"] div[contenteditable="true"]',
        'div[contenteditable="true"][data-testid]',
        'div[role="textbox"][contenteditable="true"]',
      ];

      const resolveComposer = (node) => {
        if (!(node instanceof Element)) return null;
        if (node.matches('[contenteditable="true"]')) return node;
        return (
          node.querySelector('div[role="textbox"][contenteditable="true"]') ||
          node.querySelector('[contenteditable="true"]')
        );
      };

      const findComposer = () => {
        for (const selector of composerSelectors) {
          const node = document.querySelector(selector);
          const composer = resolveComposer(node);
          if (composer && isVisible(composer)) {
            return composer;
          }
        }
        return null;
      };

      const readComposerText = (node) =>
        (node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();

      const clearComposer = (node) => {
        if (!(node instanceof Element)) return;
        node.focus();
        node.textContent = "";
        try {
          node.dispatchEvent(
            new InputEvent("beforeinput", {
              bubbles: true,
              cancelable: true,
              inputType: "deleteContentBackward",
              data: null,
            })
          );
        } catch (_error) {}
        node.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            inputType: "deleteContentBackward",
            data: null,
          })
        );
        node.dispatchEvent(new Event("change", { bubbles: true }));
      };

      const injectReplyText = (node, text) => {
        if (!(node instanceof Element)) return false;

        node.focus();
        clearComposer(node);

        try {
          const dataTransfer = new DataTransfer();
          dataTransfer.setData("text/plain", text);
          node.dispatchEvent(
            new ClipboardEvent("paste", {
              clipboardData: dataTransfer,
              bubbles: true,
              cancelable: true,
            })
          );
        } catch (_error) {}

        if (!readComposerText(node)) {
          try {
            node.dispatchEvent(
              new InputEvent("beforeinput", {
                bubbles: true,
                cancelable: true,
                inputType: "insertText",
                data: text,
              })
            );
          } catch (_error) {}
        }

        if (!readComposerText(node)) {
          node.textContent = text;
        }

        if (!readComposerText(node)) {
          try {
            document.execCommand("insertText", false, text);
          } catch (_error) {}
        }

        node.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: text,
          })
        );
        node.dispatchEvent(new Event("change", { bubbles: true }));

        return readComposerText(node).length > 0;
      };

      const findPostButton = () => {
        const selectors = [
          '[data-testid="reply-tweet-modal"] [data-testid="tweetButton"]',
          'div[role="dialog"] [data-testid="tweetButton"]',
          '[data-testid="tweetButtonInline"]',
          '[data-testid="tweetButton"]',
        ];
        for (const selector of selectors) {
          const button = document.querySelector(selector);
          if (!(button instanceof HTMLButtonElement) || !isVisible(button)) continue;
          return button;
        }
        return null;
      };

      let composer = null;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        composer = findComposer();
        if (composer) break;
        await sleep(120);
      }

      if (!composer) {
        return { ok: false, error: "Could not find the active X reply composer." };
      }

      injectReplyText(composer, generatedText);

      for (let attempt = 0; attempt < 20; attempt += 1) {
        composer = findComposer();
        if (composer && readComposerText(composer)) break;
        injectReplyText(composer, generatedText);
        await sleep(100);
      }

      composer = findComposer();
      const composerText = composer ? readComposerText(composer) : "";
      if (!composerText) {
        return { ok: false, error: "Reply text did not stick in the X composer." };
      }

      let postButton = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        postButton = findPostButton();
        if (
          postButton &&
          !postButton.disabled &&
          postButton.getAttribute("aria-disabled") !== "true"
        ) {
          break;
        }
        await sleep(120);
      }

      if (
        !postButton ||
        postButton.disabled ||
        postButton.getAttribute("aria-disabled") === "true"
      ) {
        return { ok: false, error: "The X reply button did not become ready." };
      }

      postButton.click();
      return { ok: true, composerText };
    },
  });

  return result ?? { ok: false, error: "Failed to inject reply into X composer." };
}

async function ensureCapturedItem(payload) {
  if (payload.inboxItemId) {
    return payload.inboxItemId;
  }

  const result = await apiFetch("/api/snipradar/inbox", {
    method: "POST",
    body: payload.capture,
  });
  return result.data.item.id;
}

// ── Badge counter ─────────────────────────────────────────────────────────────

async function updateBadge() {
  try {
    const result = await apiFetch("/api/snipradar/inbox?status=new&limit=1");
    const newCount = result.data?.counts?.new ?? 0;
    const text = newCount > 0 ? (newCount > 99 ? "99+" : String(newCount)) : "";
    await chrome.action.setBadgeText({ text });
    if (newCount > 0) {
      await chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
    }
  } catch (_error) {
    // Badge update is non-critical — ignore errors silently
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "snipradar:badge-poll") {
    updateBadge();
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.sync.get({ baseUrl: DEFAULT_BASE_URL });
  chrome.alarms.create("snipradar:badge-poll", { periodInMinutes: 30 });
  updateBadge();
});

// ── Keyboard commands ─────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "save-focused-tweet") return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await chrome.tabs.sendMessage(tab.id, { type: "snipradar:save-focused-tweet" });
  } catch (_error) {
    // Tab may not have content script — ignore
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "snipradar:get-config") {
        sendResponse({ ok: true, baseUrl: await getBaseUrl() });
        return;
      }

      if (message.type === "snipradar:set-base-url") {
        sendResponse({ ok: true, baseUrl: await setBaseUrl(message.baseUrl) });
        return;
      }

      if (message.type === "snipradar:reset-base-url") {
        sendResponse({ ok: true, baseUrl: await resetBaseUrl() });
        return;
      }

      if (message.type === "snipradar:check-session") {
        const result = await apiFetch("/api/snipradar/extension/session");
        sendResponse({ ok: true, session: result.data, baseUrl: result.baseUrl });
        return;
      }

      if (message.type === "snipradar:fetch-inbox-preview") {
        const result = await apiFetch("/api/snipradar/inbox?limit=5");
        sendResponse({ ok: true, inbox: result.data, baseUrl: result.baseUrl });
        return;
      }

      if (message.type === "snipradar:open-inbox") {
        const baseUrl = await getBaseUrl();
        await chrome.tabs.create({ url: `${baseUrl}/snipradar/inbox` });
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "snipradar:open-login") {
        const baseUrl = await getBaseUrl();
        await chrome.tabs.create({ url: `${baseUrl}/signin` });
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "snipradar:open-auth-window") {
        const baseUrl = await getBaseUrl();
        const authUrl = `${baseUrl}/signin?extension=true`;
        const win = await chrome.windows.create({
          url: authUrl,
          type: "popup",
          width: 520,
          height: 680,
        });

        // Watch for auth success redirect and close the popup window
        const authWindowId = win.id;
        const tabListener = (tabId, changeInfo, tab) => {
          if (
            changeInfo.status === "complete" &&
            tab.windowId === authWindowId &&
            tab.url &&
            tab.url.includes("/snipradar")
          ) {
            chrome.tabs.onUpdated.removeListener(tabListener);
            chrome.windows.remove(authWindowId).catch(() => {});
          }
        };
        chrome.tabs.onUpdated.addListener(tabListener);
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "snipradar:open-intent-popup") {
        if (!message.url || typeof message.url !== "string") {
          sendResponse({ ok: false, error: "Missing X intent URL" });
          return;
        }

        const popup = await openIntentPopup(message.url);
        sendResponse({ ok: true, popup });
        return;
      }

      if (message.type === "snipradar:save-draft") {
        const result = await apiFetch("/api/snipradar/extension/draft", {
          method: "POST",
          body: { text: message.text },
        });
        sendResponse({ ok: true, draft: result.data.draft });
        return;
      }

      if (message.type === "snipradar:capture") {
        const result = await apiFetch("/api/snipradar/inbox", {
          method: "POST",
          body: message.payload,
        });
        notify(result.data.deduped ? "Already in Research Inbox" : "Saved to Research Inbox");
        updateBadge();
        sendResponse({ ok: true, item: result.data.item, deduped: Boolean(result.data.deduped) });
        return;
      }

      if (message.type === "snipradar:reply") {
        const inboxItemId = await ensureCapturedItem(message.payload);
        const result = await apiFetch("/api/snipradar/extension/reply", {
          method: "POST",
          body: { inboxItemId },
        });
        sendResponse({
          ok: true,
          inboxItemId,
          reply: result.data.reply,
          variants: result.data.variants ?? [],
          meta: result.data.meta ?? null,
        });
        return;
      }

      if (message.type === "snipradar:inject-reply") {
        if (!_sender?.tab?.id) {
          sendResponse({ ok: false, error: "Active X tab not available." });
          return;
        }

        const result = await injectReplyIntoActiveComposer(_sender.tab.id, message.payload?.text ?? "");
        if (!result?.ok) {
          sendResponse({ ok: false, error: result?.error || "Failed to inject reply into X." });
          return;
        }
        sendResponse({ ok: true, composerText: result.composerText ?? null });
        return;
      }

      if (message.type === "snipradar:post-reply") {
        const inboxItemId = await ensureCapturedItem(message.payload);
        const result = await apiFetch("/api/snipradar/extension/reply/post", {
          method: "POST",
          body: {
            inboxItemId,
            text: message.payload.text,
            replyToTweetId: message.payload.replyToTweetId,
          },
        });
        notify("Reply posted on X");
        sendResponse({
          ok: true,
          inboxItemId,
          tweetId: result.data.tweetId,
          tweetUrl: result.data.tweetUrl,
          item: result.data.item,
        });
        return;
      }

      if (message.type === "snipradar:remix") {
        const inboxItemId = await ensureCapturedItem(message.payload);
        const result = await apiFetch("/api/snipradar/extension/remix", {
          method: "POST",
          body: { inboxItemId },
        });
        sendResponse({ ok: true, inboxItemId, remix: result.data.remix });
        return;
      }

      if (message.type === "snipradar:track") {
        const inboxItemId = await ensureCapturedItem(message.payload);
        const result = await apiFetch("/api/snipradar/extension/track", {
          method: "POST",
          body: { inboxItemId },
        });
        notify(`Tracking @${result.data.trackedAccount.trackedUsername}`);
        sendResponse({ ok: true, inboxItemId, trackedAccount: result.data.trackedAccount });
        return;
      }

      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (error) {
      console.error("[SnipRadar Extension] Message error", error);
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown extension error",
      });
    }
  })();

  return true;
});
