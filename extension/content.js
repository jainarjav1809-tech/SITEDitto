// ============================================================
// SITEDitto - Live Website Monitor
// ============================================================

console.log(
  "SITEDitto content monitor active."
);

let credentialDetected = false;
let externalFormDetected = false;

// ============================================================
// AUTOMATIC SECURITY WARNING
// ============================================================

function showSecurityWarning(score) {

  // Don't create duplicate warning
  const existing =
    document.getElementById(
      "siteditto-warning"
    );

  if (existing) {
    return;
  }

  const warning =
    document.createElement("div");

  warning.id =
    "siteditto-warning";

  warning.innerHTML = `
    <div style="
      font-size:17px;
      font-weight:800;
      margin-bottom:8px;
      color:#ffffff;
    ">
      🛡 SITEDitto
    </div>

    <div style="
      font-size:15px;
      font-weight:800;
      color:#ff6269;
      margin-bottom:8px;
    ">
      🚨 SECURITY WARNING
    </div>

    <div style="
      font-size:13px;
      font-weight:700;
      color:#ffffff;
      margin-bottom:7px;
    ">
      Trust Score: ${score}/100
    </div>

    <div style="
      font-size:12px;
      line-height:1.6;
      color:#d8dee8;
    ">
      Multiple security risk signals have been
      detected on this website.
    </div>

    <div style="
      margin-top:10px;
      font-size:11px;
      line-height:1.5;
      color:#ffb5b8;
    ">
      Avoid entering passwords, payment information,
      or other sensitive data.
    </div>
  `;

  Object.assign(
    warning.style,
    {
      position: "fixed",
      top: "20px",
      right: "20px",

      width: "340px",

      padding: "17px",

      background: "#111722",

      border:
        "2px solid #ff4f5e",

      borderRadius: "13px",

      boxShadow:
        "0 12px 40px rgba(0,0,0,0.5)",

      zIndex:
        "2147483647",

      fontFamily:
        "Arial, Helvetica, sans-serif"
    }
  );

  document.documentElement.appendChild(
    warning
  );
}

// ============================================================
// RECEIVE WARNING FROM BACKGROUND
// ============================================================

chrome.runtime.onMessage.addListener(
  (message) => {

    if (
      message.type ===
      "SECURITY_WARNING"
    ) {

      showSecurityWarning(
        message.score
      );
    }
  }
);

// ============================================================
// CREDENTIAL FORM DETECTION
// This is a SIGNAL, NOT automatically a threat.
// ============================================================

function detectCredentialForms() {

  const passwordInputs =
    document.querySelectorAll(
      'input[type="password"]'
    );

  if (
    passwordInputs.length > 0 &&
    !credentialDetected
  ) {

    credentialDetected = true;

    chrome.runtime.sendMessage({
      type: "CREDENTIAL_FORM"
    });

    console.log(
      "[SITEDitto] Credential form detected"
    );
  }
}

// ============================================================
// EXTERNAL FORM DETECTION
// ============================================================

function detectExternalForms() {

  const forms =
    document.querySelectorAll(
      "form"
    );

  const currentHost =
    window.location.hostname;

  for (const form of forms) {

    const action =
      form.getAttribute("action");

    if (!action) {
      continue;
    }

    try {

      const destination =
        new URL(
          action,
          window.location.href
        );

      if (
        destination.hostname &&
        destination.hostname !==
          currentHost &&
        !externalFormDetected
      ) {

        externalFormDetected = true;

        chrome.runtime.sendMessage({
          type: "EXTERNAL_FORM"
        });

        console.log(
          "[SITEDitto] External form detected"
        );

        break;
      }

    } catch {
      // Ignore invalid URLs
    }
  }
}

// ============================================================
// PAGE LOAD
// ============================================================

chrome.runtime.sendMessage({
  type: "PAGE_LOADED"
});

// ============================================================
// INITIAL ANALYSIS
// ============================================================

function analyzePage() {

  detectCredentialForms();

  detectExternalForms();
}

analyzePage();

// ============================================================
// LIVE DOM MONITORING
// Detect elements appearing later.
// ============================================================

let analysisTimeout = null;

const observer =
  new MutationObserver(() => {

    clearTimeout(
      analysisTimeout
    );

    analysisTimeout =
      setTimeout(() => {

        detectCredentialForms();

        detectExternalForms();

      }, 300);
  });

if (document.documentElement) {

  observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  );
}