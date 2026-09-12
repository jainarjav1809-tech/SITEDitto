// ============================================================
// SITEDitto - Live Website Monitor
// ============================================================

console.log("SITEDitto content monitor active.");

let credentialDetected = false;
let externalFormDetected = false;
let phishingPageDetected = false;


// ============================================================
// AUTOMATIC SECURITY WARNING
// ============================================================

function showSecurityWarning(score) {

  const existing =
    document.getElementById("siteditto-warning");

  if (existing) {
    return;
  }

  const warning =
    document.createElement("div");

  warning.id = "siteditto-warning";

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
//
// A password field by itself is NOT considered malicious.
// It becomes important when combined with phishing language.
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
// PHISHING / SOCIAL ENGINEERING DETECTION
//
// Looks for combinations such as:
//
// "Verify Your Account"
// "re-verification"
// "confirm your password"
// "account verification"
// "security verification"
// "account suspended"
// "confirm your identity"
//
// IMPORTANT:
// We require credential-related elements AND suspicious
// account-verification language before sending the strong
// phishing signal.
// ============================================================

function detectPhishingPage() {

  if (phishingPageDetected) {
    return;
  }

  const passwordInputs =
    document.querySelectorAll(
      'input[type="password"]'
    );

  if (passwordInputs.length === 0) {
    return;
  }

  const bodyText =
    (
      document.body?.innerText ||
      ""
    ).toLowerCase();

  const phishingPhrases = [

    "verify your account",
    "verify account",

    "account verification",
    "account verification required",

    "re-verification",
    "reverification",

    "confirm your password",
    "confirm password",

    "verify your password",
    "verify password",

    "confirm your identity",
    "verify your identity",

    "account requires verification",
    "account requires re-verification",

    "security verification",
    "security check",

    "account suspended",
    "account will be suspended",

    "account has been suspended",

    "unusual activity",
    "suspicious activity",

    "confirm your account",
    "validate your account",

    "update your account",

    "login to verify",
    "sign in to verify"
  ];

  const matchedPhrases =
    phishingPhrases.filter(
      (phrase) =>
        bodyText.includes(phrase)
    );

  if (matchedPhrases.length === 0) {
    return;
  }

  phishingPageDetected = true;

  console.log(
    "[SITEDitto] Suspicious credential/phishing page detected:",
    matchedPhrases
  );

  chrome.runtime.sendMessage({

    type: "PHISHING_INDICATOR",

    phrases: matchedPhrases

  });
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
// SUSPICIOUS DOWNLOAD-LIKE LINK DETECTION
//
// This is NOT a real download event.
// It is only an additional signal when the page contains
// credential/phishing language and a suspicious download link.
// ============================================================

function detectSuspiciousDownloadLink() {

  const links =
    document.querySelectorAll(
      "a"
    );

  const suspiciousDownloadWords = [

    "download your invoice",
    "download invoice",
    "download statement",
    "download document",
    "download receipt",
    "download file"
  ];

  for (const link of links) {

    const text =
      (
        link.innerText ||
        link.textContent ||
        ""
      )
        .trim()
        .toLowerCase();

    if (!text) {
      continue;
    }

    const matched =
      suspiciousDownloadWords.some(
        (phrase) =>
          text.includes(phrase)
      );

    if (matched) {

      const passwordInputs =
        document.querySelectorAll(
          'input[type="password"]'
        );

      if (
        passwordInputs.length > 0
      ) {

        chrome.runtime.sendMessage({

          type: "SUSPICIOUS_DOWNLOAD_LINK"

        });

        console.log(
          "[SITEDitto] Suspicious download link detected"
        );

        return;
      }
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

  detectPhishingPage();

  detectSuspiciousDownloadLink();
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

        detectPhishingPage();

        detectSuspiciousDownloadLink();

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