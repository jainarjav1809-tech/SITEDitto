// ============================================================
// SITEDitto - Background Service Worker
// ============================================================

const tabStates = {};

const DANGER_THRESHOLD = 50;

// ============================================================
// HELPERS
// ============================================================

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function createState(url) {
  const isHttps = url.startsWith("https://");

  return {
    url: url,

    score: isHttps ? 100 : 80,

    verdict: isHttps
      ? "SAFE TO USE"
      : "USE WITH CAUTION",

    signals: {
      https: isHttps,
      redirects: 0,
      credentialForm: false,
      externalForm: false,
      download: false
    },

    events: [
      {
        type: "NAVIGATION",
        message: `Opened ${getHostname(url)}`,
        severity: "safe",
        time: Date.now()
      }
    ],

    lastUpdated: Date.now()
  };
}

// ============================================================
// SAVE STATE
// ============================================================

function saveState(tabId) {
  const state = tabStates[tabId];

  if (!state) {
    return;
  }

  chrome.storage.local.set({
    [`tab_${tabId}`]: state
  });
}

// ============================================================
// UPDATE VERDICT
// ============================================================

function updateVerdict(state) {

  state.score = Math.max(
    0,
    Math.min(100, state.score)
  );

  if (state.score >= 80) {

    state.verdict = "SAFE TO USE";

  } else if (state.score >= 50) {

    state.verdict = "USE WITH CAUTION";

  } else {

    state.verdict = "DO NOT USE";
  }

  state.lastUpdated = Date.now();
}

// ============================================================
// SEND AUTOMATIC WARNING TO WEBPAGE
// ============================================================

function checkDangerThreshold(tabId) {

  const state = tabStates[tabId];

  if (!state) {
    return;
  }

  // Only warn when score is below 50
  if (state.score < DANGER_THRESHOLD) {

    chrome.tabs.sendMessage(
      tabId,
      {
        type: "SECURITY_WARNING",
        score: state.score,
        verdict: state.verdict,
        events: state.events
      }
    ).catch(() => {
      // Ignore pages where content scripts cannot run
    });
  }
}

// ============================================================
// ADD SECURITY EVENT
// ============================================================

function addEvent(
  tabId,
  type,
  message,
  severity = "safe"
) {

  const state = tabStates[tabId];

  if (!state) {
    return;
  }

  state.events.unshift({
    type: type,
    message: message,
    severity: severity,
    time: Date.now()
  });

  // Keep only latest 20 events
  state.events =
    state.events.slice(0, 20);

  state.lastUpdated = Date.now();

  saveState(tabId);
}

// ============================================================
// WEBSITE NAVIGATION
// ============================================================

chrome.webNavigation.onCommitted.addListener(
  (details) => {

    if (details.frameId !== 0) {
      return;
    }

    const tabId = details.tabId;
    const url = details.url;

    if (
      url.startsWith("chrome://") ||
      url.startsWith("edge://") ||
      url.startsWith("about:") ||
      url.startsWith("chrome-extension://")
    ) {
      return;
    }

    // Create fresh state for new website
    const state = createState(url);

    tabStates[tabId] = state;

    // ========================================================
    // HTTPS CHECK
    // ========================================================

    if (!state.signals.https) {

      state.score -= 20;

      addEvent(
        tabId,
        "SECURITY",
        "Website is not using HTTPS",
        "danger"
      );

    } else {

      addEvent(
        tabId,
        "HTTPS",
        "Secure HTTPS connection detected",
        "safe"
      );
    }

    updateVerdict(state);

    saveState(tabId);

    checkDangerThreshold(tabId);

    console.log(
      "[SITEDitto] Monitoring:",
      getHostname(url)
    );
  }
);

// ============================================================
// NAVIGATION START
// ============================================================

chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {

    if (details.frameId !== 0) {
      return;
    }

    const tabId = details.tabId;

    if (!tabStates[tabId]) {
      return;
    }

    console.log(
      "[SITEDitto] Navigation started:",
      details.url
    );
  }
);

// ============================================================
// CONTENT SCRIPT EVENTS
// ============================================================

chrome.runtime.onMessage.addListener(
  (message, sender) => {

    if (!sender.tab) {
      return;
    }

    const tabId = sender.tab.id;

    if (tabId === undefined) {
      return;
    }

    const state = tabStates[tabId];

    if (!state) {
      return;
    }

    // ========================================================
    // PAGE LOADED
    // ========================================================

    if (message.type === "PAGE_LOADED") {

      addEvent(
        tabId,
        "BROWSER",
        "Live website monitoring started",
        "safe"
      );
    }

    // ========================================================
    // CREDENTIAL FORM
    // IMPORTANT:
    // This is only a signal.
    // It does NOT directly trigger a warning.
    // ========================================================

    if (message.type === "CREDENTIAL_FORM") {

      if (!state.signals.credentialForm) {

        state.signals.credentialForm = true;

        state.score -= 10;

        addEvent(
          tabId,
          "CREDENTIAL",
          "Password or credential form detected",
          "warning"
        );
      }
    }

    // ========================================================
    // EXTERNAL FORM
    // ========================================================

    if (message.type === "EXTERNAL_FORM") {

      if (!state.signals.externalForm) {

        state.signals.externalForm = true;

        state.score -= 8;

        addEvent(
          tabId,
          "FORM",
          "Form submits data to another domain",
          "warning"
        );
      }
    }

    // ========================================================
    // DOWNLOAD
    // ========================================================

    if (message.type === "DOWNLOAD_SIGNAL") {

      if (!state.signals.download) {

        state.signals.download = true;

        state.score -= 15;

        addEvent(
          tabId,
          "DOWNLOAD",
          "Website started a file download",
          "warning"
        );
      }
    }

    // ========================================================
    // UPDATE SCORE
    // ========================================================

    updateVerdict(state);

    saveState(tabId);

    // Check if score has crossed danger threshold
    checkDangerThreshold(tabId);

    console.log(
      "[SITEDitto] Signal:",
      message.type,
      "Score:",
      state.score
    );
  }
);

// ============================================================
// DOWNLOAD MONITORING
// ============================================================

chrome.downloads.onCreated.addListener(
  (downloadItem) => {

    const tabId = downloadItem.tabId;

    if (tabId === -1) {
      return;
    }

    const state = tabStates[tabId];

    if (!state) {
      return;
    }

    if (!state.signals.download) {

      state.signals.download = true;

      state.score -= 15;

      addEvent(
        tabId,
        "DOWNLOAD",
        `Download started: ${
          downloadItem.filename || "unknown file"
        }`,
        "warning"
      );
    }

    updateVerdict(state);

    saveState(tabId);

    checkDangerThreshold(tabId);

    console.log(
      "[SITEDitto] Download detected"
    );
  }
);

// ============================================================
// CLEAN UP CLOSED TABS
// ============================================================

chrome.tabs.onRemoved.addListener(
  (tabId) => {

    delete tabStates[tabId];

    chrome.storage.local.remove(
      `tab_${tabId}`
    );
  }
);

console.log(
  "SITEDitto background monitoring started."
);