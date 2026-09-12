// ============================================================
// SITEDitto - Quarantine Page
//
// Reads the hostname from the URL (?host=...), loads the stored
// quarantine record written by background.js's checkQuarantine(),
// and wires up the three action buttons.
// ============================================================

const params = new URLSearchParams(window.location.search);
const hostname = params.get("host") || "";

const scoreElement = document.getElementById("score");
const hostnameElement = document.getElementById("hostname");
const evidenceListElement = document.getElementById("evidenceList");
const fullLogElement = document.getElementById("fullLog");

const goBackButton = document.getElementById("goBack");
const viewEvidenceButton = document.getElementById("viewEvidence");
const restoreAccessButton = document.getElementById("restoreAccess");

let record = null;

// ============================================================
// SEVERITY -> LOG CLASS
// ============================================================

function severityClass(severity) {
  if (severity === "danger") return "danger";
  if (severity === "warning") return "warning";
  return "safe";
}

// ============================================================
// LOAD STORED QUARANTINE RECORD
// ============================================================

async function loadRecord() {

  if (!hostname) {
    if (hostnameElement) hostnameElement.textContent = "this website";
    if (evidenceListElement) {
      evidenceListElement.innerHTML = "<li>No hostname was provided.</li>";
    }
    return;
  }

  if (hostnameElement) {
    hostnameElement.textContent = hostname;
  }

  try {

    const stored = await chrome.storage.local.get(`quarantine_${hostname}`);
    record = stored[`quarantine_${hostname}`];

    if (!record) {

      if (scoreElement) scoreElement.textContent = "--/100";

      if (evidenceListElement) {
        evidenceListElement.innerHTML =
          "<li>No stored evidence was found for this site.</li>";
      }

      return;
    }

    // ------------------------------------------------------
    // Score
    // ------------------------------------------------------

    if (scoreElement) {
      const score = Math.max(0, Math.min(100, Number(record.score ?? 0)));
      scoreElement.textContent = `${score}/100`;
    }

    // ------------------------------------------------------
    // Evidence (top danger/warning events)
    // ------------------------------------------------------

    const events = Array.isArray(record.events) ? record.events : [];

    const evidenceEvents = events.filter(
      (event) => event.severity === "danger" || event.severity === "warning"
    );

    if (evidenceListElement) {

      if (evidenceEvents.length === 0) {

        evidenceListElement.innerHTML =
          "<li>No specific high-risk signals were recorded.</li>";

      } else {

        evidenceListElement.innerHTML = evidenceEvents
          .map((event) => `<li>${escapeHtml(event.message || event.type || "Security signal detected")}</li>`)
          .join("");
      }
    }

    // ------------------------------------------------------
    // Full activity log (all events, most recent first)
    // ------------------------------------------------------

    if (fullLogElement) {

      if (events.length === 0) {

        fullLogElement.innerHTML = "<div class=\"logLine\">No activity was recorded.</div>";

      } else {

        fullLogElement.innerHTML = events
          .map((event) => {
            const time = event.time
              ? new Date(event.time).toLocaleTimeString()
              : "";
            const cls = severityClass(event.severity);
            const label = event.type ? `[${escapeHtml(event.type)}] ` : "";
            return `<div class="logLine ${cls}">${time ? `${time} — ` : ""}${label}${escapeHtml(event.message || "")}</div>`;
          })
          .join("");
      }
    }

  } catch (error) {
    console.error("[SITEDitto] Failed to load quarantine record:", error);

    if (evidenceListElement) {
      evidenceListElement.innerHTML = "<li>Could not load stored evidence.</li>";
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================
// BUTTON: GO BACK
// Leaves the flagged site entirely rather than re-navigating
// to it (that would just get redirected straight back here by
// the declarativeNetRequest rule).
// ============================================================

if (goBackButton) {
  goBackButton.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      chrome.tabs.update({ url: "chrome://newtab" });
    }
  });
}

// ============================================================
// BUTTON: VIEW FULL ACTIVITY LOG
// Toggles the full event log panel.
// ============================================================

if (viewEvidenceButton) {
  viewEvidenceButton.addEventListener("click", () => {
    if (!fullLogElement) return;
    fullLogElement.classList.toggle("hidden");

    viewEvidenceButton.textContent = fullLogElement.classList.contains("hidden")
      ? "View Full Activity Log"
      : "Hide Full Activity Log";
  });
}

// ============================================================
// BUTTON: RESTORE ACCESS
// Tells background.js to remove the quarantine rule and
// navigate this tab back to the original URL.
// ============================================================

if (restoreAccessButton) {
  restoreAccessButton.addEventListener("click", () => {

    if (!hostname) return;

    restoreAccessButton.disabled = true;
    restoreAccessButton.textContent = "Restoring...";

    chrome.runtime.sendMessage(
      { type: "RESTORE_ACCESS", hostname },
      () => {
        // background.js navigates this tab away on success.
        // If something goes wrong, re-enable the button so the
        // user isn't stuck.
        if (chrome.runtime.lastError) {
          restoreAccessButton.disabled = false;
          restoreAccessButton.textContent = "Restore Access";
        }
      }
    );
  });
}

// ============================================================
// START
// ============================================================

loadRecord();   