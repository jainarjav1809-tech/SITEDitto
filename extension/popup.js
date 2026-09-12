// ============================================================
// SITEDitto Popup
// ============================================================

let currentTabId = null;


// ============================================================
// DOM ELEMENTS
// ============================================================

const websiteElement =
  document.getElementById("website");

const scoreElement =
  document.getElementById("score");

const verdictElement =
  document.getElementById("verdict");

const httpsElement =
  document.getElementById("https");

const redirectsElement =
  document.getElementById("redirects");

const credentialsElement =
  document.getElementById("credentials");

const downloadsElement =
  document.getElementById("downloads");

const latestEventElement =
  document.getElementById("latestEvent");

const warningElement =
  document.getElementById("warning");

const warningTextElement =
  document.getElementById("warningText");

const dashboardButton =
  document.getElementById("openDashboard");


// ============================================================
// CHECK POPUP HTML
// ============================================================

console.log("[SITEDitto] Popup loaded.");

console.log("[SITEDitto] Required elements:", {
  website: !!websiteElement,
  score: !!scoreElement,
  verdict: !!verdictElement,
  https: !!httpsElement,
  redirects: !!redirectsElement,
  credentials: !!credentialsElement,
  downloads: !!downloadsElement,
  latestEvent: !!latestEventElement,
  warning: !!warningElement,
  warningText: !!warningTextElement,
  dashboardButton: !!dashboardButton
});


// ============================================================
// GET CURRENT TAB
// ============================================================

async function getCurrentTab() {

  try {

    const tabs =
      await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

    if (!tabs || tabs.length === 0) {
      return null;
    }

    return tabs[0];

  } catch (error) {

    console.error(
      "[SITEDitto] Failed to get current tab:",
      error
    );

    return null;
  }
}


// ============================================================
// GET STORED STATE
// ============================================================

async function getState(tabId) {

  try {

    const result =
      await chrome.storage.local.get(
        `tab_${tabId}`
      );

    return result[`tab_${tabId}`] || null;

  } catch (error) {

    console.error(
      "[SITEDitto] Failed to get state:",
      error
    );

    return null;
  }
}


// ============================================================
// UPDATE UI
// ============================================================

function updateUI(state) {

  if (
    !websiteElement ||
    !scoreElement ||
    !verdictElement
  ) {

    console.error(
      "[SITEDitto] Required popup elements are missing."
    );

    return;
  }


  // ----------------------------------------------------------
  // No state
  // ----------------------------------------------------------

  if (!state) {

    websiteElement.textContent =
      "No monitoring data";

    scoreElement.textContent =
      "--";

    verdictElement.textContent =
      "WAITING";

    if (httpsElement) {
      httpsElement.textContent = "—";
    }

    if (redirectsElement) {
      redirectsElement.textContent = "—";
    }

    if (credentialsElement) {
      credentialsElement.textContent = "—";
    }

    if (downloadsElement) {
      downloadsElement.textContent = "—";
    }

    if (latestEventElement) {
      latestEventElement.textContent =
        "Waiting for activity...";
    }

    if (warningElement) {
      warningElement.classList.add("hidden");
    }

    return;
  }


  // ----------------------------------------------------------
  // Website
  // ----------------------------------------------------------

  let hostname =
    state.url || "Unknown";

  try {

    hostname =
      new URL(state.url).hostname;

  } catch {

    // Keep original URL
  }

  websiteElement.textContent =
    hostname;


  // ----------------------------------------------------------
  // Score
  // ----------------------------------------------------------

  const score =
    Math.max(
      0,
      Math.min(
        100,
        Number(state.score ?? 0)
      )
    );

  scoreElement.textContent =
    score;


  // ----------------------------------------------------------
  // Verdict
  // ----------------------------------------------------------

  let verdict =
    state.verdict;

  if (!verdict) {

    if (score >= 80) {

      verdict =
        "SAFE TO USE";

    } else if (score >= 50) {

      verdict =
        "USE WITH CAUTION";

    } else {

      verdict =
        "DO NOT USE";
    }
  }

  verdictElement.textContent =
    verdict;


  // ----------------------------------------------------------
  // Score colors
  // ----------------------------------------------------------

  if (score >= 80) {

    scoreElement.style.color =
      "#49e29b";

    verdictElement.style.color =
      "#49e29b";

  } else if (score >= 50) {

    scoreElement.style.color =
      "#f4c95d";

    verdictElement.style.color =
      "#f4c95d";

  } else {

    scoreElement.style.color =
      "#ff6269";

    verdictElement.style.color =
      "#ff6269";
  }


  // ----------------------------------------------------------
  // Signals
  // ----------------------------------------------------------

  const signals =
    state.signals || {};


  if (httpsElement) {

    httpsElement.textContent =
      signals.https
        ? "✓"
        : "⚠";
  }


  if (redirectsElement) {

    redirectsElement.textContent =
      signals.redirects ?? 0;
  }


  if (credentialsElement) {

    credentialsElement.textContent =
      signals.credentialForm
        ? "⚠"
        : "✓";
  }


  if (downloadsElement) {

    downloadsElement.textContent =
      signals.download
        ? "⚠"
        : "✓";
  }


  // ----------------------------------------------------------
  // Latest Event
  // ----------------------------------------------------------

  if (latestEventElement) {

    if (
      Array.isArray(state.events) &&
      state.events.length > 0
    ) {

      latestEventElement.textContent =
        state.events[0].message ||
        "Security activity detected.";

    } else {

      latestEventElement.textContent =
        "No security events detected.";
    }
  }


  // ----------------------------------------------------------
  // Warning
  // ----------------------------------------------------------

  if (
    warningElement &&
    warningTextElement
  ) {

    if (score < 50) {

      warningElement.classList.remove(
        "hidden"
      );

      warningTextElement.textContent =
        "This website has multiple security risk signals. Avoid entering passwords or sensitive information.";

    } else if (score < 80) {

      warningElement.classList.remove(
        "hidden"
      );

      warningTextElement.textContent =
        "Some security signals require caution. Review the detected activity before continuing.";

    } else {

      warningElement.classList.add(
        "hidden"
      );
    }
  }
}


// ============================================================
// LOAD POPUP
// ============================================================

async function loadPopup() {

  console.log(
    "[SITEDitto] Loading popup..."
  );


  const tab =
    await getCurrentTab();


  if (
    !tab ||
    typeof tab.id !== "number"
  ) {

    console.warn(
      "[SITEDitto] No valid active tab."
    );

    updateUI(null);

    return;
  }


  currentTabId =
    tab.id;


  console.log(
    "[SITEDitto] Current tab:",
    tab.url
  );


  const state =
    await getState(
      currentTabId
    );


  updateUI(state);
}


// ============================================================
// LIVE SCORE UPDATE
// ============================================================

chrome.runtime.onMessage.addListener(
  (message) => {

    console.log(
      "[SITEDitto] Message received:",
      message
    );


    if (
      message &&
      message.type === "SCORE_UPDATED" &&
      message.state
    ) {

      // Only update if the message belongs to
      // the popup's current Chrome tab.
      if (
        message.state.tabId !== undefined &&
        String(message.state.tabId) !==
          String(currentTabId)
      ) {
        return;
      }

      updateUI(
        message.state
      );
    }
  }
);


// ============================================================
// OPEN DASHBOARD
// ============================================================

if (dashboardButton) {

  dashboardButton.addEventListener(
    "click",
    () => {

      console.log(
        "[SITEDitto] Opening dashboard for tab:",
        currentTabId
      );


      if (
        typeof currentTabId !== "number"
      ) {

        console.error(
          "[SITEDitto] Cannot open dashboard: invalid tab ID."
        );

        return;
      }


      chrome.tabs.create({

        // IMPORTANT:
        // tabId is ONLY used internally by the dashboard
        // to identify which Chrome tab's state to display.
        url:
          `http://localhost:5173/?tabId=${encodeURIComponent(
            currentTabId
          )}`
      });

    }
  );

} else {

  console.error(
    "[SITEDitto] Dashboard button not found."
  );
}


// ============================================================
// START
// ============================================================

loadPopup();