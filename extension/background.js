// ============================================================
// SITEDitto - Background Service Worker
// ============================================================

const tabStates = {};

const DANGER_THRESHOLD = 50;

const BACKEND_URL = "http://localhost:8000";

// ============================================================
// DASHBOARD HOSTS
// ============================================================

const DASHBOARD_HOSTS = new Set([
  "localhost:5173",
  "127.0.0.1:5173"
]);

let activeTabId = null;


// ============================================================
// QUARANTINE STATE
// ============================================================

const quarantinedHosts = new Map();
const overriddenHosts = new Set();

let nextRuleId = 1;


// ============================================================
// INITIAL ACTIVE TAB
// ============================================================

chrome.tabs.query(
  {
    active: true,
    lastFocusedWindow: true
  },
  (tabs) => {

    if (tabs && tabs[0]) {
      activeTabId = tabs[0].id;
    }

  }
);


// ============================================================
// REHYDRATE QUARANTINE RULES
// ============================================================

(async () => {

  try {

    const rules =
      await chrome.declarativeNetRequest
        .getDynamicRules();

    for (const rule of rules) {

      const path =
        rule.action?.redirect?.extensionPath || "";

      const match =
        /host=([^&]+)/.exec(path);

      if (match) {

        const hostname =
          decodeURIComponent(match[1]);

        quarantinedHosts.set(
          hostname,
          rule.id
        );

        if (rule.id >= nextRuleId) {
          nextRuleId = rule.id + 1;
        }

      }

    }

  } catch (error) {

    console.error(
      "[SITEDitto] Failed to rehydrate quarantine rules:",
      error
    );

  }

})();


// ============================================================
// GET HOSTNAME / PAGE NAME
// ============================================================

function getHostname(url) {

  try {

    const parsed = new URL(url);

    // Normal HTTP/HTTPS website
    if (parsed.hostname) {
      return parsed.hostname;
    }

    // Local file
    if (parsed.protocol === "file:") {

      const path =
        decodeURIComponent(
          parsed.pathname || ""
        );

      const parts =
        path
          .split("/")
          .filter(Boolean);

      if (parts.length > 0) {

        return parts[
          parts.length - 1
        ];

      }

      return "local-file";
    }

    return parsed.protocol.replace(
      ":",
      ""
    );

  } catch {

    return url;

  }

}


// ============================================================
// CREATE INITIAL STATE
// ============================================================

function createState(url) {

  const isHttps =
    url.startsWith("https://");

  return {

    url: url,

    score: 100,

    verdict: "SAFE TO USE",

    quarantined: false,

    signals: {

      https: isHttps,

      redirects: 0,

      credentialForm: false,

      externalForm: false,

      download: false,

      phishingIndicator: false,

      suspiciousDownloadLink: false

    },

    events: [

      {

        type: "NAVIGATION",

        message:
          `Opened ${getHostname(url)}`,

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

async function saveState(tabId) {

  const state =
    tabStates[tabId];

  if (!state) {
    return;
  }

  await pushStateToBackend(
    tabId,
    state
  );

  try {

    await chrome.storage.local.set({

      [`tab_${tabId}`]: state

    });

  } catch (error) {

    console.error(
      "[SITEDitto] Storage error:",
      error
    );

  }

  broadcastToPopup(
    tabId,
    state
  );

}


// ============================================================
// BROADCAST TO POPUP
// ============================================================

function broadcastToPopup(
  tabId,
  state
) {

  if (
    tabId !== activeTabId
  ) {
    return;
  }

  chrome.runtime.sendMessage({

    type: "SCORE_UPDATED",

    state: {

      ...state,

      tabId: tabId

    }

  }).catch(() => {

    // Popup is not open.

  });

}


// ============================================================
// PUSH STATE TO BACKEND
// ============================================================

async function pushStateToBackend(
  tabId,
  state
) {

  if (
    tabId !== activeTabId
  ) {
    return false;
  }

  try {

    const response =
      await fetch(
        `${BACKEND_URL}/api/state`,
        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json"

          },

          body: JSON.stringify({

            ...state,

            tabId: tabId

          })

        }
      );

    if (!response.ok) {

      console.error(
        "[SITEDitto] Backend returned:",
        response.status
      );

      return false;

    }

    const authoritative =
      await response.json();

    if (
      authoritative &&
      typeof authoritative.score ===
        "number"
    ) {

      state.score =
        authoritative.score;

      state.verdict =
        authoritative.verdict ||
        state.verdict;

    }

    return true;

  } catch (error) {

    console.error(
      "[SITEDitto] Backend unavailable:",
      error
    );

    return false;

  }

}


// ============================================================
// UPDATE VERDICT
// ============================================================

function updateVerdict(state) {

  state.score =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(state.score)
      )
    );

  if (state.score >= 80) {

    state.verdict =
      "SAFE TO USE";

  } else if (state.score >= 50) {

    state.verdict =
      "USE WITH CAUTION";

  } else {

    state.verdict =
      "DO NOT USE";

  }

  state.lastUpdated =
    Date.now();

}


// ============================================================
// SEND WARNING TO PAGE
// ============================================================

function checkDangerThreshold(
  tabId
) {

  const state =
    tabStates[tabId];

  if (!state) {
    return;
  }

  if (
    state.score <
    DANGER_THRESHOLD
  ) {

    chrome.tabs.sendMessage(
      tabId,
      {

        type:
          "SECURITY_WARNING",

        score:
          state.score,

        verdict:
          state.verdict,

        events:
          state.events

      }
    ).catch(() => {

      // Content script may not be available.

    });

  }

}


// ============================================================
// QUARANTINE
// ============================================================

async function checkQuarantine(
  tabId
) {

  const state =
    tabStates[tabId];

  if (!state) {
    return;
  }

  if (
    state.score >=
    DANGER_THRESHOLD
  ) {
    return;
  }

  const hostname =
    getHostname(state.url);

  if (
    overriddenHosts.has(
      hostname
    )
  ) {

    return;

  }

  if (state.quarantined) {
    return;
  }

  state.quarantined = true;

  addEventWithoutSave(
    tabId,
    "QUARANTINE",
    `Website quarantined: ${hostname}`,
    "danger"
  );


  // ==========================================================
  // SAVE QUARANTINE RECORD
  // ==========================================================

  try {

    await chrome.storage.local.set({

      [`quarantine_${hostname}`]: {

        hostname,

        originalUrl:
          state.url,

        score:
          state.score,

        verdict:
          state.verdict,

        events:
          state.events,

        quarantinedAt:
          Date.now()

      }

    });

  } catch (error) {

    console.error(
      "[SITEDitto] Failed to save quarantine record:",
      error
    );

  }


  // ==========================================================
  // ADD DNR RULE FOR REAL WEB HOSTS
  // ==========================================================

  const isHttpOrHttps =
    state.url.startsWith(
      "http://"
    ) ||
    state.url.startsWith(
      "https://"
    );

  if (
    isHttpOrHttps &&
    !quarantinedHosts.has(
      hostname
    )
  ) {

    const ruleId =
      nextRuleId++;

    quarantinedHosts.set(
      hostname,
      ruleId
    );

    try {

      await chrome
        .declarativeNetRequest
        .updateDynamicRules({

          addRules: [

            {

              id: ruleId,

              priority: 1,

              action: {

                type: "redirect",

                redirect: {

                  extensionPath:
                    `/quarantine.html?host=${encodeURIComponent(
                      hostname
                    )}`

                }

              },

              condition: {

                urlFilter:
                  `||${hostname}^`,

                resourceTypes: [
                  "main_frame"
                ]

              }

            }

          ],

          removeRuleIds: []

        });

    } catch (error) {

      console.error(
        "[SITEDitto] Failed to add quarantine rule:",
        error
      );

    }

  }


  // ==========================================================
  // KICK CURRENT TAB TO QUARANTINE
  // ==========================================================

  try {

    await chrome.tabs.update(
      tabId,
      {

        url:
          chrome.runtime.getURL(
            `quarantine.html?host=${encodeURIComponent(
              hostname
            )}`
          )

      }
    );

  } catch (error) {

    console.error(
      "[SITEDitto] Failed to redirect tab:",
      error
    );

  }

}


// ============================================================
// RESTORE ACCESS
// ============================================================

async function handleRestoreAccess(
  hostname,
  sender
) {

  if (!hostname) {
    return;
  }

  overriddenHosts.add(
    hostname
  );

  const ruleId =
    quarantinedHosts.get(
      hostname
    );

  if (ruleId) {

    try {

      await chrome
        .declarativeNetRequest
        .updateDynamicRules({

          removeRuleIds: [
            ruleId
          ]

        });

    } catch (error) {

      console.error(
        "[SITEDitto] Failed to remove quarantine rule:",
        error
      );

    }

    quarantinedHosts.delete(
      hostname
    );

  }

  try {

    const stored =
      await chrome.storage.local.get(
        `quarantine_${hostname}`
      );

    const record =
      stored[
        `quarantine_${hostname}`
      ];

    const targetUrl =
      record?.originalUrl ||
      `https://${hostname}`;

    if (
      sender.tab &&
      typeof sender.tab.id ===
        "number"
    ) {

      await chrome.tabs.update(
        sender.tab.id,
        {

          url: targetUrl

        }
      );

    }

  } catch (error) {

    console.error(
      "[SITEDitto] Restore failed:",
      error
    );

  }

}


// ============================================================
// ADD EVENT WITHOUT SAVING
//
// Used internally by quarantine so we don't create a recursive
// save -> quarantine -> save loop.
// ============================================================

function addEventWithoutSave(
  tabId,
  type,
  message,
  severity = "safe"
) {

  const state =
    tabStates[tabId];

  if (!state) {
    return;
  }

  state.events.unshift({

    type,

    message,

    severity,

    time: Date.now()

  });

  state.events =
    state.events.slice(
      0,
      20
    );

  state.lastUpdated =
    Date.now();

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

  const state =
    tabStates[tabId];

  if (!state) {
    return;
  }

  state.events.unshift({

    type,

    message,

    severity,

    time: Date.now()

  });

  state.events =
    state.events.slice(
      0,
      20
    );

  state.lastUpdated =
    Date.now();

  saveState(tabId);

}


// ============================================================
// WEBSITE NAVIGATION
// ============================================================

chrome.webNavigation.onCommitted.addListener(
  async (details) => {

    if (
      details.frameId !== 0
    ) {
      return;
    }

    const tabId =
      details.tabId;

    const url =
      details.url;


    // ========================================================
    // ACCEPT:
    //
    // http://
    // https://
    // file://
    //
    // IGNORE:
    //
    // chrome://
    // edge://
    // about:
    // devtools:
    // etc.
    // ========================================================

    const isHttp =
      url.startsWith(
        "http://"
      );

    const isHttps =
      url.startsWith(
        "https://"
      );

    const isFile =
      url.startsWith(
        "file://"
      );

    if (
      !isHttp &&
      !isHttps &&
      !isFile
    ) {

      return;

    }


    // ========================================================
    // NEVER MONITOR SITEDitto DASHBOARD
    // ========================================================

    let hostnameWithPort = "";

    try {

      const parsed =
        new URL(url);

      hostnameWithPort =
        parsed.port
          ? `${parsed.hostname}:${parsed.port}`
          : parsed.hostname;

    } catch {

      hostnameWithPort =
        getHostname(url);

    }

    if (
      DASHBOARD_HOSTS.has(
        hostnameWithPort
      )
    ) {

      return;

    }


    // ========================================================
    // CREATE NEW STATE
    // ========================================================

    const state =
      createState(url);


    // ========================================================
    // REDIRECT DETECTION
    // ========================================================

    const qualifiers =
      details.transitionQualifiers ||
      [];

    if (
      qualifiers.includes(
        "client_redirect"
      ) ||
      qualifiers.includes(
        "server_redirect"
      )
    ) {

      state.signals.redirects =
        1;

    }


    // ========================================================
    // STORE TAB STATE
    // ========================================================

    tabStates[tabId] = state;


    // ========================================================
    // HTTPS CHECK
    // ========================================================

    if (
      !state.signals.https
    ) {

      state.score -= 20;

      addEventWithoutSave(
        tabId,
        "SECURITY",
        "Website is not using HTTPS",
        "danger"
      );

    } else {

      addEventWithoutSave(
        tabId,
        "HTTPS",
        "Secure HTTPS connection detected",
        "safe"
      );

    }


    // ========================================================
    // REDIRECT SCORE
    // ========================================================

    if (
      state.signals.redirects >
      0
    ) {

      state.score -=
        4 *
        state.signals.redirects;

      addEventWithoutSave(
        tabId,
        "REDIRECT",
        `${state.signals.redirects} redirect hop(s) observed during navigation`,
        "warning"
      );

    }


    // ========================================================
    // INITIAL VERDICT
    // ========================================================

    updateVerdict(
      state
    );


    // ========================================================
    // SAVE / BACKEND
    // ========================================================

    await saveState(
      tabId
    );


    // ========================================================
    // WARNING
    // ========================================================

    checkDangerThreshold(
      tabId
    );


    // ========================================================
    // QUARANTINE
    // ========================================================

    await checkQuarantine(
      tabId
    );


    console.log(
      "[SITEDitto] Monitoring:",
      url,
      "Score:",
      state.score
    );

  }
);


// ============================================================
// NAVIGATION START
// ============================================================

chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {

    if (
      details.frameId !== 0
    ) {
      return;
    }

    const tabId =
      details.tabId;

    if (
      !tabStates[tabId]
    ) {
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
  async (message, sender) => {

    // ========================================================
    // RESTORE ACCESS
    // ========================================================

    if (
      message &&
      message.type ===
        "RESTORE_ACCESS"
    ) {

      await handleRestoreAccess(
        message.hostname,
        sender
      );

      return;

    }


    // ========================================================
    // CONTENT SCRIPT MUST COME FROM A TAB
    // ========================================================

    if (!sender.tab) {
      return;
    }

    const tabId =
      sender.tab.id;

    if (
      tabId === undefined ||
      tabId === null
    ) {
      return;
    }


    // ========================================================
    // GET STATE
    // ========================================================

    const state =
      tabStates[tabId];

    if (!state) {

      console.warn(
        "[SITEDitto] No state for tab:",
        tabId,
        message?.type
      );

      return;

    }


    // ========================================================
    // PAGE LOADED
    // ========================================================

    if (
      message.type ===
      "PAGE_LOADED"
    ) {

      addEventWithoutSave(
        tabId,
        "BROWSER",
        "Live website monitoring started",
        "safe"
      );

    }


    // ========================================================
    // CREDENTIAL FORM
    //
    // Password field alone is only a small penalty.
    // ========================================================

    if (
      message.type ===
      "CREDENTIAL_FORM"
    ) {

      if (
        !state.signals.credentialForm
      ) {

        state.signals.credentialForm =
          true;

        state.score -= 10;

        addEventWithoutSave(
          tabId,
          "CREDENTIAL",
          "Password or credential form detected",
          "warning"
        );

      }

    }


    // ========================================================
    // PHISHING INDICATOR
    //
    // Triggered by content.js when a credential page contains
    // suspicious account-verification/social-engineering text.
    // ========================================================

    if (
      message.type ===
      "PHISHING_INDICATOR"
    ) {

      if (
        !state.signals.phishingIndicator
      ) {

        state.signals.phishingIndicator =
          true;

        state.score -= 45;

        const phrases =
          Array.isArray(
            message.phrases
          )
            ? message.phrases
            : [];

        const phraseText =
          phrases.length
            ? `: ${phrases.join(", ")}`
            : "";

        addEventWithoutSave(
          tabId,
          "PHISHING",
          `Suspicious account-verification language detected on a credential page${phraseText}`,
          "danger"
        );

      }

    }


    // ========================================================
    // SUSPICIOUS DOWNLOAD LINK
    // ========================================================

    if (
      message.type ===
      "SUSPICIOUS_DOWNLOAD_LINK"
    ) {

      if (
        !state.signals
          .suspiciousDownloadLink
      ) {

        state.signals
          .suspiciousDownloadLink =
          true;

        state.score -= 10;

        addEventWithoutSave(
          tabId,
          "DOWNLOAD",
          "Suspicious download link detected on a credential-focused page",
          "warning"
        );

      }

    }


    // ========================================================
    // EXTERNAL FORM
    // ========================================================

    if (
      message.type ===
      "EXTERNAL_FORM"
    ) {

      if (
        !state.signals.externalForm
      ) {

        state.signals.externalForm =
          true;

        state.score -= 8;

        addEventWithoutSave(
          tabId,
          "FORM",
          "Form submits data to another domain",
          "warning"
        );

      }

    }


    // ========================================================
    // DOWNLOAD SIGNAL FROM CONTENT SCRIPT
    // ========================================================

    if (
      message.type ===
      "DOWNLOAD_SIGNAL"
    ) {

      if (
        !state.signals.download
      ) {

        state.signals.download =
          true;

        state.score -= 15;

        addEventWithoutSave(
          tabId,
          "DOWNLOAD",
          "Website started a file download",
          "warning"
        );

      }

    }


    // ========================================================
    // UPDATE VERDICT
    // ========================================================

    updateVerdict(
      state
    );


    // ========================================================
    // SAVE
    // ========================================================

    await saveState(
      tabId
    );


    // ========================================================
    // WARNING
    // ========================================================

    checkDangerThreshold(
      tabId
    );


    // ========================================================
    // QUARANTINE
    // ========================================================

    await checkQuarantine(
      tabId
    );


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
  async (downloadItem) => {

    const tabId =
      downloadItem.tabId;

    if (
      tabId === -1 ||
      tabId === undefined
    ) {
      return;
    }

    const state =
      tabStates[tabId];

    if (!state) {
      return;
    }

    if (
      !state.signals.download
    ) {

      state.signals.download =
        true;

      state.score -= 15;

      addEventWithoutSave(
        tabId,
        "DOWNLOAD",
        `Download started: ${
          downloadItem.filename ||
          "unknown file"
        }`,
        "warning"
      );

    }

    updateVerdict(
      state
    );

    await saveState(
      tabId
    );

    checkDangerThreshold(
      tabId
    );

    await checkQuarantine(
      tabId
    );

    console.log(
      "[SITEDitto] Download detected"
    );

  }
);


// ============================================================
// ACTIVE TAB TRACKING
// ============================================================

chrome.tabs.onActivated.addListener(
  async ({ tabId }) => {

    activeTabId =
      tabId;

    const state =
      tabStates[tabId];

    if (state) {

      broadcastToPopup(
        tabId,
        state
      );

      await pushStateToBackend(
        tabId,
        state
      );

    }

  }
);


// ============================================================
// WINDOW FOCUS TRACKING
// ============================================================

chrome.windows.onFocusChanged.addListener(
  async (windowId) => {

    if (
      windowId ===
      chrome.windows.WINDOW_ID_NONE
    ) {
      return;
    }

    const tabs =
      await chrome.tabs.query({

        active: true,

        windowId: windowId

      });

    if (
      !tabs ||
      !tabs[0]
    ) {
      return;
    }

    activeTabId =
      tabs[0].id;

    const state =
      tabStates[activeTabId];

    if (state) {

      broadcastToPopup(
        activeTabId,
        state
      );

      await pushStateToBackend(
        activeTabId,
        state
      );

    }

  }
);


// ============================================================
// CLEAN UP CLOSED TABS
// ============================================================

chrome.tabs.onRemoved.addListener(
  (tabId) => {

    delete tabStates[
      tabId
    ];

    chrome.storage.local.remove(
      `tab_${tabId}`
    );

  }
);


// ============================================================
// STARTUP LOG
// ============================================================

console.log(
  "SITEDitto background monitoring started."
);