const DEVELOPER_SHORTCUT_KEY = "D";

const developerPanel = document.getElementById("developer-panel");
const baseUrlInput = document.getElementById("base-url");
const saveBaseUrlButton = document.getElementById("save-base-url");
const resetBaseUrlButton = document.getElementById("reset-base-url");
const sessionStatus = document.getElementById("session-status");
const previewList = document.getElementById("preview-list");
const previewCount = document.getElementById("preview-count");
const composeTextarea = document.getElementById("compose-text");
const composeCounter = document.getElementById("compose-counter");
const saveDraftButton = document.getElementById("save-draft");

// ── Messaging ────────────────────────────────────────────────────────────────

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    if (
      typeof chrome === "undefined" ||
      !chrome.runtime ||
      typeof chrome.runtime.sendMessage !== "function"
    ) {
      reject(new Error("SnipRadar extension context is unavailable. Reload the extension."));
      return;
    }

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || "SnipRadar popup request failed."));
        return;
      }
      resolve(response);
    });
  });
}

// ── Session + preview ────────────────────────────────────────────────────────

function setStatus(message, isError = false) {
  sessionStatus.textContent = message;
  sessionStatus.style.color = isError ? "#fca5a5" : "#cbd5e1";
}

function toggleDeveloperPanel() {
  developerPanel.classList.toggle("is-hidden");
}

function renderPreview(items) {
  previewList.innerHTML = "";
  previewCount.textContent = String(items.length);

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "preview-card__meta";
    empty.textContent = "No captures yet.";
    previewList.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "preview-card";
    const title = document.createElement("p");
    title.textContent =
      item.title || (item.authorUsername ? `Capture from @${item.authorUsername}` : "Saved capture");
    const meta = document.createElement("p");
    meta.className = "preview-card__meta";
    meta.textContent = `${item.itemType} · ${item.status}`;
    card.appendChild(title);
    card.appendChild(meta);
    previewList.appendChild(card);
  });
}

async function refreshSession() {
  setStatus("Checking session...");
  try {
    const sessionResult = await sendMessage({ type: "snipradar:check-session" });

    if (!sessionResult || !sessionResult.ok) {
      setStatus(sessionResult && sessionResult.error ? sessionResult.error : "Not connected.", true);
      renderPreview([]);
      return;
    }

    const session = sessionResult.session;
    if (baseUrlInput) {
      baseUrlInput.value = sessionResult.baseUrl || "";
    }

    if (!session.authenticated) {
      setStatus(session.message || "Sign in required.", true);
      renderPreview([]);
      return;
    }

    setStatus(
      `Signed in as ${session.user.name || session.user.email}${session.snipradar.hasConnectedXAccount ? ` · @${session.snipradar.xUsername}` : ""}`
    );

    const inboxResult = await sendMessage({ type: "snipradar:fetch-inbox-preview" });
    renderPreview(inboxResult?.ok ? (inboxResult.inbox.items || []) : []);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Extension unavailable.", true);
    renderPreview([]);
  }
}

// ── Quick Compose ─────────────────────────────────────────────────────────────

function updateComposeCounter() {
  if (!composeTextarea || !composeCounter) return;
  const len = composeTextarea.value.length;
  composeCounter.textContent = `${len}/280`;
  composeCounter.classList.toggle("is-over", len > 280);
  if (saveDraftButton) {
    saveDraftButton.disabled = len === 0 || len > 280;
  }
}

if (composeTextarea) {
  composeTextarea.addEventListener("input", updateComposeCounter);
  updateComposeCounter();
}

if (saveDraftButton) {
  saveDraftButton.addEventListener("click", async () => {
    const text = composeTextarea?.value.trim();
    if (!text) return;

    saveDraftButton.disabled = true;
    saveDraftButton.textContent = "Saving...";

    try {
      const result = await sendMessage({ type: "snipradar:save-draft", text });
      if (!result?.ok) throw new Error(result?.error ?? "Failed to save draft");
      composeTextarea.value = "";
      updateComposeCounter();
      setStatus("Draft saved — open the app to schedule or post it.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save draft.", true);
    } finally {
      saveDraftButton.disabled = false;
      saveDraftButton.textContent = "Save Draft";
    }
  });
}

// ── Developer panel shortcut ─────────────────────────────────────────────────

document.addEventListener("keydown", (event) => {
  if (event.shiftKey && event.key.toUpperCase() === DEVELOPER_SHORTCUT_KEY) {
    event.preventDefault();
    toggleDeveloperPanel();
  }
});

// ── Developer panel buttons ──────────────────────────────────────────────────

if (saveBaseUrlButton) {
  saveBaseUrlButton.addEventListener("click", async () => {
    try {
      const result = await sendMessage({
        type: "snipradar:set-base-url",
        baseUrl: baseUrlInput.value,
      });
      if (result && result.ok) {
        baseUrlInput.value = result.baseUrl;
        await refreshSession();
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update URL.", true);
    }
  });
}

if (resetBaseUrlButton) {
  resetBaseUrlButton.addEventListener("click", async () => {
    try {
      const result = await sendMessage({ type: "snipradar:reset-base-url" });
      if (result && result.ok && baseUrlInput) {
        baseUrlInput.value = result.baseUrl;
        await refreshSession();
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to reset URL.", true);
    }
  });
}

// ── Navigation buttons ───────────────────────────────────────────────────────

document.getElementById("refresh-session").addEventListener("click", () => {
  refreshSession().catch(() => {});
});

document.getElementById("open-inbox").addEventListener("click", async () => {
  try {
    await sendMessage({ type: "snipradar:open-inbox" });
  } catch {
    // Ignore — tab open failure is non-critical
  }
});

// "Open login" uses an in-extension popup window; falls back to a new tab.
document.getElementById("open-login").addEventListener("click", async () => {
  try {
    await sendMessage({ type: "snipradar:open-auth-window" });
    // Give the auth window time to complete, then refresh session state.
    setTimeout(() => refreshSession().catch(() => {}), 3000);
  } catch {
    // Auth window creation failed — open a plain tab as fallback.
    try {
      await sendMessage({ type: "snipradar:open-login" });
    } catch {
      // Ignore fallback failure too
    }
  }
});

// ── Boot ─────────────────────────────────────────────────────────────────────

sendMessage({ type: "snipradar:get-config" })
  .then((result) => {
    if (result && result.ok && baseUrlInput) {
      baseUrlInput.value = result.baseUrl || "";
    }
  })
  .catch(() => {});

refreshSession().catch(() => {});
