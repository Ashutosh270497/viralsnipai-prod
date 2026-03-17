(function () {
  const RESERVED_PATHS = new Set([
    "home",
    "explore",
    "notifications",
    "messages",
    "compose",
    "search",
    "settings",
    "i",
    "jobs",
    "communities",
    "bookmarks",
    "lists",
    "premium",
  ]);
  const SAVED_TWEET_IDS_KEY = "snipradarSavedTweetIds";

  let lastUrl = location.href;
  let activeResultPanel = null;
  const savedTweetIds = new Set();
  let refreshScheduled = false;

  function getExtensionApi() {
    if (typeof chrome !== "undefined") {
      return chrome;
    }
    if (typeof browser !== "undefined") {
      return browser;
    }
    return null;
  }

  function getExtensionRuntime() {
    const extensionApi = getExtensionApi();
    if (!extensionApi || !extensionApi.runtime || !extensionApi.runtime.sendMessage) {
      return null;
    }
    return extensionApi.runtime;
  }

  function isSnipRadarNode(node) {
    if (!(node instanceof Element)) return false;
    return Boolean(
      node.closest("#snipradar-menu-root, #snipradar-toast-host, #snipradar-profile-launcher") ||
        node.classList.contains("snipradar-inline-host") ||
        node.classList.contains("snipradar-toggle") ||
        node.classList.contains("snipradar-menu") ||
        node.classList.contains("snipradar-result-panel")
    );
  }

  function getSessionStorageArea() {
    const extensionApi = getExtensionApi();
    if (!extensionApi || !extensionApi.storage) {
      return null;
    }
    if (extensionApi.storage.session) {
      return extensionApi.storage.session;
    }
    if (extensionApi.storage.local) {
      return extensionApi.storage.local;
    }
    return null;
  }

  async function hydrateSavedTweetIds() {
    const storageArea = getSessionStorageArea();
    if (!storageArea) return;

    try {
      const result = await storageArea.get({ [SAVED_TWEET_IDS_KEY]: [] });
      for (const tweetId of result[SAVED_TWEET_IDS_KEY] || []) {
        if (typeof tweetId === "string" && tweetId) {
          savedTweetIds.add(tweetId);
        }
      }
      syncSavedTweetStates();
    } catch (_error) {
      // Ignore storage failures; inline state still works for the current page lifecycle.
    }
  }

  async function persistSavedTweetId(tweetId) {
    if (!tweetId) return;
    savedTweetIds.add(tweetId);
    const storageArea = getSessionStorageArea();
    if (!storageArea) return;

    try {
      await storageArea.set({
        [SAVED_TWEET_IDS_KEY]: Array.from(savedTweetIds).slice(-500),
      });
    } catch (_error) {
      // Best-effort only.
    }
  }

  function getMenuRoot() {
    let root = document.getElementById("snipradar-menu-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "snipradar-menu-root";
      document.body.appendChild(root);
    }
    return root;
  }

  function closeAllMenus(exceptMenu = null) {
    document.querySelectorAll(".snipradar-menu.is-visible").forEach((node) => {
      if (exceptMenu && node === exceptMenu) return;
      node.classList.remove("is-visible");
      node.style.top = "";
      node.style.left = "";
    });
  }

  function closeResultPanel() {
    if (!activeResultPanel) return;
    activeResultPanel.remove();
    activeResultPanel = null;
  }

  function positionFloatingLayer(anchor, layer, widthFallback, heightFallback) {
    const margin = 12;
    const rect = anchor.getBoundingClientRect();
    const layerRect = layer.getBoundingClientRect();
    const layerWidth = Math.max(layerRect.width || 0, widthFallback);
    const layerHeight = Math.max(layerRect.height || 0, heightFallback);

    let left = rect.right - layerWidth;
    if (left < margin) left = margin;
    if (left + layerWidth > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - layerWidth - margin);
    }

    let top = rect.bottom + 8;
    const fitsBelow = top + layerHeight <= window.innerHeight - margin;
    if (!fitsBelow) {
      top = Math.max(margin, rect.top - layerHeight - 8);
    }

    layer.style.left = `${Math.round(left)}px`;
    layer.style.top = `${Math.round(top)}px`;
  }

  function positionMenu(toggle, menu) {
    positionFloatingLayer(toggle, menu, 200, 180);
  }

  function positionResultPanel(toggle, panel) {
    positionFloatingLayer(toggle, panel, 360, 250);
  }

  function showToast(message, isError = false, withRefresh = false) {
    let host = document.getElementById("snipradar-toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "snipradar-toast-host";
      document.body.appendChild(host);
    }

    const toast = document.createElement("div");
    toast.className = `snipradar-toast${isError ? " is-error" : ""}`;

    if (withRefresh) {
      const span = document.createElement("span");
      span.textContent = message + " ";
      const link = document.createElement("a");
      link.textContent = "Refresh page";
      link.href = "#";
      link.style.cssText = "color:inherit;font-weight:700;text-decoration:underline;cursor:pointer;";
      link.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.reload();
      });
      toast.appendChild(span);
      toast.appendChild(link);
    } else {
      toast.textContent = message;
    }

    host.appendChild(toast);
    window.setTimeout(() => {
      toast.remove();
    }, withRefresh ? 8000 : 3200);
  }

  function isExtensionContextValid() {
    try {
      return (
        typeof chrome !== "undefined" &&
        Boolean(chrome.runtime) &&
        typeof chrome.runtime.id === "string" &&
        chrome.runtime.id.length > 0
      );
    } catch (_e) {
      return false;
    }
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      if (!isExtensionContextValid()) {
        reject(new Error("SnipRadar was reloaded. Refresh the page to reconnect."));
        return;
      }

      try {
        chrome.runtime.sendMessage(message, (response) => {
          try {
            const runtimeError = chrome?.runtime?.lastError ?? null;
            if (runtimeError) {
              reject(
                new Error(
                  /context invalidated/i.test(runtimeError.message || "")
                    ? "SnipRadar was reloaded. Refresh the page to reconnect."
                    : runtimeError.message || "SnipRadar extension request failed."
                )
              );
              return;
            }
            resolve(response);
          } catch (_callbackError) {
            reject(new Error("SnipRadar was reloaded. Refresh the page to reconnect."));
          }
        });
      } catch (error) {
        reject(
          new Error(
            /context invalidated/i.test(error?.message || "")
              ? "SnipRadar was reloaded. Refresh the page to reconnect."
              : error?.message || "SnipRadar extension unavailable."
          )
        );
      }
    });
  }

  function extractUsernameFromHref(href) {
    try {
      const url = new URL(href, location.origin);
      const segment = url.pathname.split("/").filter(Boolean)[0];
      if (!segment || RESERVED_PATHS.has(segment.toLowerCase())) return null;
      return segment.replace(/^@/, "");
    } catch (_error) {
      return null;
    }
  }

  // ── Engagement metrics ──────────────────────────────────────────────────────

  function scrapeEngagementCount(article, testId) {
    const btn = article.querySelector(`[data-testid="${testId}"]`);
    if (!btn) return null;
    // aria-label is the most stable signal: "1,234 Likes", "47 reposts", etc.
    const label = btn.getAttribute("aria-label") || "";
    const labelMatch = label.match(/^([\d,]+)/);
    if (labelMatch) return labelMatch[1].replace(/,/g, "");
    // Fallback: look for a numeric span child
    for (const span of btn.querySelectorAll("span")) {
      const t = span.textContent?.trim() ?? "";
      if (/^[\d.]+[KkMm]?$/.test(t) && t.length > 0) return t;
    }
    return null;
  }

  function scrapeEngagementMetrics(article) {
    return {
      likeCount: scrapeEngagementCount(article, "like"),
      retweetCount: scrapeEngagementCount(article, "retweet"),
      replyCount: scrapeEngagementCount(article, "reply"),
      viewCount:
        scrapeEngagementCount(article, "views") ??
        scrapeEngagementCount(article, "analyticsButton"),
    };
  }

  function normalizeCapturedText(text) {
    if (!text) return "";

    const cleanedLines = text
      .split("\n")
      .map((line) => line.trim())
      .map((line) =>
        line
          .replace(/\b(?:https?:\/\/|pic\.x\.com\/|t\.co\/)\S+/gi, "")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean);

    return Array.from(new Set(cleanedLines)).join("\n");
  }

  // ── Single-tweet capture ────────────────────────────────────────────────────

  function buildTweetCapture(article) {
    const rawText = Array.from(article.querySelectorAll('[data-testid="tweetText"]'))
      .map((node) => node.innerText.trim())
      .filter(Boolean)
      .join("\n");
    const text = normalizeCapturedText(rawText);
    const statusLink = Array.from(article.querySelectorAll('a[href*="/status/"]'))
      .map((anchor) => anchor.href)
      .find((href) => /\/status\/\d+/.test(href));

    if (!statusLink || !text) return null;

    const userNameRoot = article.querySelector('[data-testid="User-Name"]');
    const authorUsername = userNameRoot
      ? Array.from(userNameRoot.querySelectorAll('a[href^="/"]'))
          .map((anchor) => extractUsernameFromHref(anchor.getAttribute("href") || ""))
          .find(Boolean)
      : null;
    const authorDisplayName =
      userNameRoot?.querySelector("span")?.textContent?.trim() ||
      authorUsername ||
      "Saved tweet";
    const tweetId = statusLink.match(/status\/(\d+)/)?.[1] || null;
    const engagement = scrapeEngagementMetrics(article);

    return {
      source: "browser_extension",
      itemType: location.pathname.includes("/status/") ? "thread" : "tweet",
      sourceUrl: statusLink,
      xEntityId: tweetId,
      title: (text.split("\n")[0] || "").slice(0, 120) || `@${authorUsername || "x"}`,
      text,
      authorUsername,
      authorDisplayName,
      labels: ["extension"],
      metadata: {
        pageUrl: location.href,
        engagement,
      },
    };
  }

  // ── Full-thread capture ─────────────────────────────────────────────────────

  function buildThreadCapture() {
    if (!location.pathname.includes("/status/")) return null;

    const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
    if (articles.length === 0) return null;

    const posts = articles
      .map((article, index) => {
        const rawText = Array.from(article.querySelectorAll('[data-testid="tweetText"]'))
          .map((n) => n.innerText.trim())
          .filter(Boolean)
          .join("\n");
        const text = normalizeCapturedText(rawText);
        const statusLink = Array.from(article.querySelectorAll('a[href*="/status/"]'))
          .map((a) => a.href)
          .find((h) => /\/status\/\d+/.test(h));
        if (!text || !statusLink) return null;
        const tweetId = statusLink.match(/status\/(\d+)/)?.[1] ?? null;
        const userNameRoot = article.querySelector('[data-testid="User-Name"]');
        const authorUsername = userNameRoot
          ? Array.from(userNameRoot.querySelectorAll('a[href^="/"]'))
              .map((a) => extractUsernameFromHref(a.getAttribute("href") || ""))
              .find(Boolean)
          : null;
        const engagement = scrapeEngagementMetrics(article);
        return { index, text, tweetId, authorUsername, sourceUrl: statusLink, engagement };
      })
      .filter(Boolean);

    if (posts.length === 0) return null;

    const firstPost = posts[0];
    const combinedText = posts.map((p, i) => `[${i + 1}] ${p.text}`).join("\n\n");

    return {
      source: "browser_extension",
      itemType: "thread",
      sourceUrl: firstPost.sourceUrl,
      xEntityId: firstPost.tweetId,
      title: `Thread by @${firstPost.authorUsername || "x"} (${posts.length} posts)`,
      text: combinedText,
      authorUsername: firstPost.authorUsername,
      authorDisplayName: firstPost.authorUsername || "Saved thread",
      labels: ["extension", "thread"],
      metadata: {
        pageUrl: location.href,
        posts,
        postCount: posts.length,
      },
    };
  }

  function buildProfileCapture() {
    const pathParts = location.pathname.split("/").filter(Boolean);
    if (pathParts.length !== 1) return null;
    const authorUsername = extractUsernameFromHref(location.pathname);
    if (!authorUsername) return null;

    const bio =
      document.querySelector('[data-testid="UserDescription"]')?.innerText?.trim() ||
      document.querySelector('meta[name="description"]')?.getAttribute("content") ||
      "";
    const displayName =
      document.querySelector('[data-testid="UserName"] span')?.textContent?.trim() ||
      document.title.split(" / X")[0] ||
      authorUsername;

    return {
      source: "browser_extension",
      itemType: "profile",
      sourceUrl: location.href,
      xEntityId: authorUsername,
      title: `@${authorUsername} — ${displayName}`.slice(0, 120),
      text: bio,
      authorUsername,
      authorDisplayName: displayName,
      labels: ["extension", "profile"],
      metadata: {
        pageUrl: location.href,
      },
    };
  }

  function setToggleSavedState(toggle, isSaved) {
    if (!toggle) return;
    toggle.dataset.saved = isSaved ? "true" : "false";
    toggle.classList.toggle("snipradar-toggle--saved", isSaved);
    toggle.textContent = isSaved ? "Saved" : "SnipRadar";
    toggle.setAttribute(
      "aria-label",
      isSaved ? "Saved to SnipRadar inbox" : "Open SnipRadar actions"
    );
  }

  function markCaptureSaved(payload, context) {
    if (payload.xEntityId) {
      void persistSavedTweetId(payload.xEntityId);
    }
    if (context.article) {
      context.article.dataset.snipradarSaved = "true";
    }
    setToggleSavedState(context.toggle, true);
  }

  function syncSavedTweetStates() {
    document.querySelectorAll('article[data-snipradar-entity-id]').forEach((article) => {
      const tweetId = article.dataset.snipradarEntityId;
      const toggle = article.querySelector(".snipradar-toggle");
      const isSaved =
        article.dataset.snipradarSaved === "true" || (tweetId && savedTweetIds.has(tweetId));
      if (isSaved) {
        article.dataset.snipradarSaved = "true";
      }
      setToggleSavedState(toggle, Boolean(isSaved));
    });
  }

  function updateCounter(counter, textarea) {
    const remaining = 280 - textarea.value.length;
    counter.textContent = `${textarea.value.length}/280`;
    counter.classList.toggle("is-over", remaining < 0);
  }

  function isVisibleElement(node) {
    if (!(node instanceof Element)) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getComposerContainer(node) {
    if (!(node instanceof Element)) return null;
    return (
      node.closest('div[role="dialog"]') ||
      node.closest('[data-testid="tweetTextarea_0"]') ||
      node
    );
  }

  function resolveComposerEditor(node) {
    if (!node) return null;
    if (
      node instanceof Element &&
      node.matches('div[role="textbox"][contenteditable="true"]')
    ) {
      return node;
    }

    if (!(node instanceof Element)) return null;

    // Prefer the Lexical root scoped to X's known composer test ID first,
    // then fall back to broader selectors. This avoids targeting a stale or
    // wrong contenteditable when multiple editors exist on the page.
    return (
      node.querySelector('[data-testid="tweetTextarea_0"] div[role="textbox"][contenteditable="true"]') ||
      node.querySelector('[data-testid="tweetTextarea_0_label"] ~ div div[role="textbox"][contenteditable="true"]') ||
      node.querySelector('div[role="textbox"][contenteditable="true"]') ||
      node.querySelector('[contenteditable="true"]')
    );
  }

  function getLiveComposerEditor(node) {
    const editor = resolveComposerEditor(node);
    if (editor instanceof Element && editor.isConnected) {
      return editor;
    }
    return null;
  }

  async function copyText(text) {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard");
  }

  function buildTweetIntentUrl(text, options = {}) {
    const params = new URLSearchParams();
    params.set("text", text);
    if (options.replyToTweetId) {
      params.set("in_reply_to", options.replyToTweetId);
    }
    return `https://twitter.com/intent/tweet?${params.toString()}`;
  }

  async function tryOpenIntentComposer(text, mode, context) {
    const intentUrl = buildTweetIntentUrl(text, {
      replyToTweetId: mode === "reply" ? context.replyToTweetId : null,
    });
    const result = await sendMessage({
      type: "snipradar:open-intent-popup",
      url: intentUrl,
    });
    if (!result || !result.ok) return false;
    showToast(mode === "reply" ? "Reply opened in X popup" : "Composer opened in X popup");
    return true;
  }

  async function waitForComposer(timeoutMs = 5000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const candidates = [
        document.querySelector('[data-testid="tweetTextarea_0"] div[role="textbox"][contenteditable="true"]'),
        document.querySelector('[data-testid="tweetTextarea_0"] [contenteditable="true"]'),
        document.querySelector('div[role="dialog"] div[role="textbox"][contenteditable="true"]'),
        document.querySelector('div[role="textbox"][contenteditable="true"]'),
      ].filter(Boolean);

      for (const candidate of candidates) {
        const editor = resolveComposerEditor(candidate);
        if (editor && isVisibleElement(editor)) {
          return getComposerContainer(editor);
        }
      }

      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
    throw new Error("Could not find the X composer.");
  }

  function getComposerPlainText(editor) {
    if (!(editor instanceof Element)) return "";
    return (editor.innerText || editor.textContent || "").replace(/\s+/g, " ").trim();
  }

  async function composerHasText(composerRef, text, timeoutMs = 600) {
    const expected = text.replace(/\s+/g, " ").trim();
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const editor = getLiveComposerEditor(composerRef);
      if (!editor) {
        await new Promise((resolve) => window.setTimeout(resolve, 40));
        continue;
      }
      const current = getComposerPlainText(editor);
      if (current && (current === expected || current.includes(expected.slice(0, Math.min(18, expected.length))))) {
        return true;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 40));
    }

    return false;
  }

  async function writeComposerText(composer, text) {
    let editor = getLiveComposerEditor(composer);
    if (!editor) {
      throw new Error("Could not find the editable X composer.");
    }

    editor.focus();
    await new Promise((resolve) => window.setTimeout(resolve, 40));

    const safeHtml =
      "<p>" +
      text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") +
      "</p>";

    // ── Strategy 1: beforeinput insertText (Lexical — X's current editor) ───────
    // X migrated to Lexical. Lexical processes ALL text insertion via beforeinput.
    // When Lexical handles the event it calls event.preventDefault() to block the
    // browser's native insertion (avoiding a double-write). We detect this via
    // event.defaultPrevented — a reliable synchronous signal that Lexical accepted
    // the text. No clipboard access or user activation required.
    //
    // CRITICAL targeting fix: Lexical registers its beforeinput handler on the
    // focused element. After editor.focus() the activeElement IS the Lexical root.
    // We must dispatch on document.activeElement (not the cached editor reference)
    // to guarantee the event reaches the listener Lexical registered at init time.
    try {
      editor = getLiveComposerEditor(composer);
      if (!editor) throw new Error("Reply composer was replaced before insertion.");
      editor.focus();
      await new Promise((resolve) => window.setTimeout(resolve, 60));
      // Post-focus, document.activeElement is the exact contenteditable Lexical owns.
      const lexicalTarget =
        document.activeElement instanceof Element &&
        document.activeElement.isContentEditable
          ? document.activeElement
          : editor;
      const ev = new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: text,
      });
      lexicalTarget.dispatchEvent(ev);
      if (ev.defaultPrevented && (await composerHasText(composer, text))) return;
    } catch (_e) {}

    // ── Strategy 2: ClipboardEvent + getData monkey-patch ──────────────────────
    // Chrome puts a constructed DataTransfer into "protected" mode making
    // getData() return "". Patching getData on the same JS object bypasses this
    // because Chrome passes the SAME reference as event.clipboardData.
    // If the paste event is handled (prevented), we're done.
    try {
      editor = getLiveComposerEditor(composer);
      if (!editor) throw new Error("Reply composer was replaced before paste insertion.");
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      dt.getData = function (format) {
        const f = (format || "").toLowerCase().split(";")[0].trim();
        if (f === "text/plain" || f === "text") return text;
        if (f === "text/html") return safeHtml;
        return "";
      };
      const ev = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });
      editor.dispatchEvent(ev);
      if (ev.defaultPrevented && (await composerHasText(composer, text))) return;
    } catch (_e) {}

    // ── Strategy 3: insertFromPaste InputEvent (Lexical alt / ProseMirror) ──────
    // Some editor builds handle insertFromPaste by reading event.dataTransfer
    // (which IS accessible unlike ClipboardEvent.clipboardData in protected mode).
    // Same activeElement targeting as Strategy 1.
    try {
      editor = getLiveComposerEditor(composer);
      if (!editor) throw new Error("Reply composer was replaced before paste insertion.");
      editor.focus();
      await new Promise((resolve) => window.setTimeout(resolve, 30));
      const lexicalTarget3 =
        document.activeElement instanceof Element &&
        document.activeElement.isContentEditable
          ? document.activeElement
          : editor;
      const dt2 = new DataTransfer();
      dt2.setData("text/plain", text);
      const ev = new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "insertFromPaste",
        dataTransfer: dt2,
      });
      lexicalTarget3.dispatchEvent(ev);
      if (ev.defaultPrevented && (await composerHasText(composer, text))) return;
    } catch (_e) {}

    // ── Strategy 4: execCommand paste (reads real clipboard pre-written earlier) ─
    try {
      editor = getLiveComposerEditor(composer);
      if (!editor) throw new Error("Reply composer was replaced before clipboard insertion.");
      editor.focus();
      if (document.execCommand("paste") && (await composerHasText(composer, text))) return;
    } catch (_e) {}

    // ── Strategy 5: execCommand insertText (user-activation-gated) ─────────────
    try {
      editor = getLiveComposerEditor(composer);
      if (!editor) throw new Error("Reply composer was replaced before insertText.");
      editor.focus();
      if (document.execCommand("insertText", false, text) && (await composerHasText(composer, text))) return;
    } catch (_e) {}

    // ── Strategy 6: Direct DOM + synthetic events (absolute last resort) ────────
    editor = getLiveComposerEditor(composer);
    if (!editor) {
      throw new Error("Could not find a stable X composer to write into.");
    }
    editor.innerHTML = "";
    const paragraph = document.createElement("div");
    paragraph.setAttribute("data-snipradar-generated", "true");
    paragraph.textContent = text;
    editor.appendChild(paragraph);
    editor.dispatchEvent(
      new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: text })
    );
    editor.dispatchEvent(new Event("change", { bubbles: true }));
    if (!(await composerHasText(composer, text, 400))) {
      throw new Error("Could not insert reply into the X composer.");
    }
  }

  async function openReplyComposer(article) {
    // Reuse only the active reply dialog or a composer inside the same article.
    // Never grab a random global composer from another tweet on the page.
    const dialogCandidates = [
      document.querySelector('div[role="dialog"] div[role="textbox"][contenteditable="true"]'),
      document.querySelector('div[role="dialog"] [contenteditable="true"]'),
    ].filter(Boolean);

    for (const candidate of dialogCandidates) {
      const editor = resolveComposerEditor(candidate) ?? (candidate instanceof Element ? candidate : null);
      if (editor && isVisibleElement(editor)) return getComposerContainer(editor);
    }

    const articleCandidates = article
      ? [
          article.querySelector('[data-testid="tweetTextarea_0"] div[role="textbox"][contenteditable="true"]'),
          article.querySelector('[data-testid="tweetTextarea_0"] [contenteditable="true"]'),
          article.querySelector('div[role="textbox"][contenteditable="true"]'),
          article.querySelector('[contenteditable="true"]'),
        ].filter(Boolean)
      : [];

    for (const candidate of articleCandidates) {
      const editor = resolveComposerEditor(candidate) ?? (candidate instanceof Element ? candidate : null);
      if (editor && isVisibleElement(editor)) return getComposerContainer(editor);
    }

    // No existing composer — click the tweet's reply button to open one.
    const replyButton =
      article?.querySelector('[data-testid="reply"]') ||
      article?.querySelector('button[aria-label*="Reply"]');
    if (!replyButton) {
      throw new Error("Could not find the reply button for this tweet.");
    }
    replyButton.click();
    return waitForComposer();
  }

  async function openPostComposer() {
    const composeTrigger =
      document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
      document.querySelector('a[href="/compose/post"]') ||
      document.querySelector('button[aria-label*="Post"]');
    if (!composeTrigger) {
      throw new Error("Could not open the X composer.");
    }
    composeTrigger.click();
    return waitForComposer();
  }

  async function openComposerWithText(text, mode, context) {
    const composer =
      mode === "reply"
        ? await openReplyComposer(context.article)
        : await openPostComposer();
    // Give the editor a moment to fully settle after focus/open before injecting text.
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    await writeComposerText(composer, text);
    showToast(mode === "reply" ? "Reply ready in X composer" : "Post ready in X composer");
  }

  function buildResultPanel(text, options) {
    closeResultPanel();

    const panel = document.createElement("div");
    panel.className = "snipradar-result-panel";
    panel.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    const header = document.createElement("div");
    header.className = "snipradar-result-panel__header";

    const titleGroup = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "snipradar-result-panel__eyebrow";
    eyebrow.textContent = options.mode === "reply" ? "Reply Assist" : "Remix Assist";
    const title = document.createElement("p");
    title.className = "snipradar-result-panel__title";
    title.textContent =
      options.mode === "reply"
        ? "Pick a variant and post in-place"
        : "Edit before you post";
    titleGroup.appendChild(eyebrow);
    titleGroup.appendChild(title);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "snipradar-result-panel__close";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", () => closeResultPanel());

    header.appendChild(titleGroup);
    header.appendChild(closeButton);

    const variants =
      options.mode === "reply" && Array.isArray(options.variants) && options.variants.length > 0
        ? options.variants.map((variant) => ({
            tone: variant.tone,
            label: variant.label || variant.tone,
            text: variant.text,
          }))
        : null;
    let activeTone = variants?.[0]?.tone ?? null;

    const tabs = document.createElement("div");
    tabs.className = "snipradar-result-panel__tabs";

    const textarea = document.createElement("textarea");
    textarea.className = "snipradar-result-panel__textarea";
    textarea.value = text;
    textarea.spellcheck = false;

    const status = document.createElement("div");
    status.className = "snipradar-result-panel__status";

    const footer = document.createElement("div");
    footer.className = "snipradar-result-panel__footer";

    const counter = document.createElement("span");
    counter.className = "snipradar-result-panel__counter";

    const actions = document.createElement("div");
    actions.className = "snipradar-result-panel__actions";

    const regenerateButton = document.createElement("button");
    regenerateButton.type = "button";
    regenerateButton.className =
      "snipradar-result-panel__button snipradar-result-panel__button--secondary";
    regenerateButton.textContent = "Regenerate";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "snipradar-result-panel__button snipradar-result-panel__button--secondary";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", async () => {
      try {
        await copyText(textarea.value);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Copy failed", true);
      }
    });

    const postButton = document.createElement("button");
    postButton.type = "button";
    postButton.className = "snipradar-result-panel__button";
    postButton.textContent = options.mode === "reply" ? "Post Reply" : "Open compose";

    const setStatus = (message = "", tone = "neutral") => {
      status.textContent = message;
      status.dataset.state = tone;
      status.classList.toggle("is-visible", Boolean(message));
    };

    const syncActiveVariantText = () => {
      if (!variants || !activeTone) return;
      const activeVariant = variants.find((variant) => variant.tone === activeTone);
      if (activeVariant) {
        activeVariant.text = textarea.value;
      }
    };

    const renderTabs = () => {
      tabs.innerHTML = "";
      if (!variants?.length) return;

      variants.forEach((variant) => {
        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = "snipradar-result-panel__tab";
        if (variant.tone === activeTone) {
          tab.classList.add("is-active");
        }
        tab.textContent = variant.label;
        tab.addEventListener("click", () => {
          if (variant.tone === activeTone) return;
          syncActiveVariantText();
          activeTone = variant.tone;
          textarea.value = variant.text;
          updateCounter(counter, textarea);
          setStatus("");
          renderTabs();
        });
        tabs.appendChild(tab);
      });
    };

    postButton.addEventListener("click", async () => {
      postButton.disabled = true;
      regenerateButton.disabled = true;
      const text = textarea.value.trim();
      try {
        if (options.mode === "reply") {
          if (!text) {
            throw new Error("Reply text is empty.");
          }
          setStatus("Opening reply composer…");
          await openReplyComposer(options.context.article);
          await new Promise((resolve) => window.setTimeout(resolve, 180));
          setStatus("Posting reply on X…");
          const result = await sendMessage({
            type: "snipradar:inject-reply",
            payload: { text },
          });
          if (!result || !result.ok) {
            throw new Error(result?.error || "Failed to inject the reply into X.");
          }
          closeResultPanel();
          showToast("Reply posted on X");
          return;
        }

        if (await tryOpenIntentComposer(text, options.mode, options.context)) {
          closeResultPanel();
          return;
        }

        // Pre-write to real clipboard so Strategy 3 (execCommand paste) can read it.
        // navigator.clipboard.writeText works in extension content scripts without
        // requiring user activation, making it safe to call before the async chain.
        try {
          await navigator.clipboard.writeText(text);
        } catch (_clipErr) {
          // Clipboard write failed — Strategy 1/2 will still handle insertion.
        }

        await openComposerWithText(text, options.mode, options.context);
        closeResultPanel();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to open composer";
        setStatus(message, "error");
        showToast(message, true);
      } finally {
        postButton.disabled = false;
        regenerateButton.disabled = false;
      }
    });

    const syncComposerState = () => {
      syncActiveVariantText();
      updateCounter(counter, textarea);
      const overLimit = textarea.value.length > 280;
      postButton.disabled = overLimit;
      // Copy is always enabled regardless of length — users may want the full text
    };
    syncComposerState();
    textarea.addEventListener("input", () => {
      setStatus("");
      syncComposerState();
    });

    regenerateButton.addEventListener("click", async () => {
      if (options.mode !== "reply") return;
      regenerateButton.disabled = true;
      postButton.disabled = true;
      setStatus("Generating 3 fresh reply variants…");
      try {
        const result = await sendMessage({
          type: "snipradar:reply",
          payload: { capture: options.context.capturePayload, forceRegenerate: true },
        });
        if (!result || !result.ok) {
          throw new Error(result?.error || "Failed to regenerate reply variants");
        }
        markCaptureSaved(options.context.capturePayload, options.context);
        buildResultPanel(result.reply, {
          mode: "reply",
          variants: result.variants,
          context: {
            ...options.context,
            inboxItemId: result.inboxItemId,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to regenerate reply variants";
        setStatus(message, "error");
        showToast(message, true);
      } finally {
        regenerateButton.disabled = false;
        postButton.disabled = textarea.value.length > 280;
      }
    });

    if (variants?.length) {
      activeTone = variants[0].tone;
      textarea.value = variants[0].text;
      renderTabs();
      syncComposerState();
    }

    actions.appendChild(copyButton);
    if (options.mode === "reply") {
      actions.appendChild(regenerateButton);
    }
    actions.appendChild(postButton);
    footer.appendChild(counter);
    footer.appendChild(actions);

    panel.appendChild(header);
    if (variants?.length) {
      panel.appendChild(tabs);
    }
    panel.appendChild(textarea);
    panel.appendChild(status);
    panel.appendChild(footer);

    getMenuRoot().appendChild(panel);
    requestAnimationFrame(() => {
      panel.classList.add("is-visible");
      positionResultPanel(options.context.toggle, panel);
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });

    activeResultPanel = panel;
    return panel;
  }

  async function executeAction(action, payload, button, context) {
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Working...";

    try {
      if (action === "save") {
        const result = await sendMessage({ type: "snipradar:capture", payload });
        if (!result || !result.ok) throw new Error(result?.error || "Failed to save capture");
        markCaptureSaved(payload, context);
        closeAllMenus();
        showToast(result.deduped ? "Already in Research Inbox" : "Saved to Research Inbox");
        return;
      }

      if (action === "reply") {
        const result = await sendMessage({
          type: "snipradar:reply",
          payload: { capture: payload },
        });
        if (!result || !result.ok) throw new Error(result?.error || "Failed to generate reply");
        markCaptureSaved(payload, context);
        closeAllMenus();
        buildResultPanel(result.reply, {
          mode: "reply",
          variants: result.variants,
          context: {
            ...context,
            inboxItemId: result.inboxItemId,
            capturePayload: payload,
            replyToTweetId: payload.xEntityId,
          },
        });
        return;
      }

      if (action === "remix") {
        const result = await sendMessage({
          type: "snipradar:remix",
          payload: { capture: payload },
        });
        if (!result || !result.ok) throw new Error(result?.error || "Failed to generate remix");
        markCaptureSaved(payload, context);
        closeAllMenus();
        buildResultPanel(result.remix, { mode: "remix", context });
        return;
      }

      if (action === "track") {
        const result = await sendMessage({
          type: "snipradar:track",
          payload: { capture: payload },
        });
        if (!result || !result.ok) throw new Error(result?.error || "Failed to track author");
        markCaptureSaved(payload, context);
        closeAllMenus();
        showToast(`Tracking @${result.trackedAccount.trackedUsername}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "SnipRadar action failed";
      const isContextError = /reloaded|context/i.test(msg);
      showToast(msg, true, isContextError);
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }

  function createMenuButton(label, action, payload, context) {
    const button = document.createElement("button");
    button.className = "snipradar-menu-button";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void executeAction(action, payload, button, context);
    });
    return button;
  }

  function buildMenu(payload, context, options = { includeReply: true }) {
    const menu = document.createElement("div");
    menu.className = "snipradar-menu";
    menu.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    getMenuRoot().appendChild(menu);
    menu.appendChild(createMenuButton("Save to inbox", "save", payload, context));
    // On thread pages offer a one-click "Save full thread" action using the
    // aggregated thread capture instead of the single-tweet payload.
    if (options.includeThread) {
      const threadPayload = buildThreadCapture();
      if (threadPayload) {
        menu.appendChild(createMenuButton("Save full thread", "save", threadPayload, context));
      }
    }
    if (options.includeReply) {
      menu.appendChild(createMenuButton("Reply assist", "reply", payload, context));
    }
    menu.appendChild(createMenuButton("Generate remix", "remix", payload, context));
    if (payload.authorUsername) {
      menu.appendChild(createMenuButton("Track author", "track", payload, context));
    }
    return menu;
  }

  // ── Silent save (used by keyboard shortcut) ─────────────────────────────────

  function saveTweetSilently(article) {
    const payload = buildTweetCapture(article);
    if (!payload) {
      showToast("Could not read this tweet.", true);
      return;
    }
    const toggle = article.querySelector(".snipradar-toggle");
    const context = { article, toggle };
    sendMessage({ type: "snipradar:capture", payload })
      .then((result) => {
        if (!result || !result.ok) throw new Error(result?.error || "Failed to save");
        markCaptureSaved(payload, context);
        showToast(result.deduped ? "Already in Research Inbox" : "Saved to Research Inbox");
      })
      .catch((error) => {
        const msg = error instanceof Error ? error.message : "SnipRadar action failed";
        const isContextError = /reloaded|context/i.test(msg);
        showToast(msg, true, isContextError);
      });
  }

  function bindToggle(toggle, menu) {
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeResultPanel();
      const willOpen = !menu.classList.contains("is-visible");
      closeAllMenus(willOpen ? menu : null);
      if (!willOpen) {
        menu.classList.remove("is-visible");
        return;
      }
      menu.classList.add("is-visible");
      requestAnimationFrame(() => positionMenu(toggle, menu));
    });
  }

  function injectTweetMenus() {
    const tweets = document.querySelectorAll('article[data-testid="tweet"]:not([data-snipradar-bound="true"])');
    tweets.forEach((article) => {
      const payload = buildTweetCapture(article);
      article.setAttribute("data-snipradar-bound", "true");
      if (!payload) return;

      if (payload.xEntityId) {
        article.dataset.snipradarEntityId = payload.xEntityId;
        if (savedTweetIds.has(payload.xEntityId)) {
          article.dataset.snipradarSaved = "true";
        }
      }

      const host = document.createElement("div");
      host.className = "snipradar-inline-host";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "snipradar-toggle";
      setToggleSavedState(toggle, article.dataset.snipradarSaved === "true");
      const context = { article, toggle };
      const onThreadPage = location.pathname.includes("/status/");
      const menu = buildMenu(payload, context, {
        includeReply: true,
        includeThread: onThreadPage,
      });
      bindToggle(toggle, menu);

      host.appendChild(toggle);

      const target =
        article.querySelector('div[role="group"]')?.parentElement ||
        article.querySelector('div[data-testid="cellInnerDiv"]') ||
        article;
      target.appendChild(host);
    });
  }

  function injectProfileMenu() {
    const payload = buildProfileCapture();
    const existing = document.getElementById("snipradar-profile-launcher");
    if (!payload) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;

    const launcher = document.createElement("div");
    launcher.id = "snipradar-profile-launcher";
    launcher.className = "snipradar-profile-launcher";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "snipradar-toggle";
    setToggleSavedState(toggle, false);
    const context = { article: null, toggle };
    const menu = buildMenu(payload, context, { includeReply: false });
    bindToggle(toggle, menu);
    launcher.appendChild(toggle);
    document.body.appendChild(launcher);
  }

  function refreshEnhancements() {
    injectTweetMenus();
    injectProfileMenu();
    syncSavedTweetStates();
  }

  function scheduleRefresh() {
    if (refreshScheduled) return;
    refreshScheduled = true;
    window.requestAnimationFrame(() => {
      refreshScheduled = false;
      refreshEnhancements();
    });
  }

  const observer = new MutationObserver((mutations) => {
    let shouldRefresh = false;

    if (location.href !== lastUrl) {
      lastUrl = location.href;
      document.getElementById("snipradar-profile-launcher")?.remove();
      closeAllMenus();
      closeResultPanel();
      shouldRefresh = true;
    }

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (isSnipRadarNode(node)) continue;
        shouldRefresh = true;
        break;
      }
      if (shouldRefresh) break;
    }

    if (shouldRefresh) {
      scheduleRefresh();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("click", () => {
    closeAllMenus();
    closeResultPanel();
  });
  window.addEventListener("scroll", () => {
    closeAllMenus();
    closeResultPanel();
  }, true);
  window.addEventListener("resize", () => {
    closeAllMenus();
    closeResultPanel();
  });

  // ── Keyboard shortcut: save focused/hovered tweet ──────────────────────────
  // The service worker forwards chrome.commands "save-focused-tweet" here.

  const extensionRuntime = getExtensionRuntime();
  if (extensionRuntime && extensionRuntime.onMessage) {
    extensionRuntime.onMessage.addListener((message) => {
      if (message.type !== "snipradar:save-focused-tweet") return;
      const articles = Array.from(
        document.querySelectorAll('article[data-testid="tweet"]')
      );
      // Prefer the article the cursor is currently over, else the first visible one.
      const target =
        articles.find((a) => {
          try { return a.matches(":hover"); } catch { return false; }
        }) ?? articles[0];
      if (!target) {
        showToast("No tweet found to save.", true);
        return;
      }
      saveTweetSilently(target);
    });
  }

  hydrateSavedTweetIds();
  scheduleRefresh();
})();
