// ============================================================
// SITEDitto — Deterministic Risk Engine
//
// This is the single source of truth for scoring weights and
// verdict thresholds.
//
// Architecture:
//
//   Extension observes
//          ↓
//   Backend / Risk Engine calculates
//          ↓
//   Dashboard displays
//
// The score does not depend on an LLM.
// It is plain arithmetic over browser-visible signals,
// so the result remains explainable and reproducible.
// ============================================================


// ============================================================
// RISK WEIGHTS
// ============================================================

export const WEIGHTS = {

  // ----------------------------------------------------------
  // Network / connection
  // ----------------------------------------------------------

  insecureHttp: -20,


  // ----------------------------------------------------------
  // Credential signals
  //
  // A password field alone is NOT considered malicious.
  // It receives only a small penalty.
  // ----------------------------------------------------------

  credentialForm: -10,


  // ----------------------------------------------------------
  // Form submitting data to another domain
  // ----------------------------------------------------------

  externalForm: -8,


  // ----------------------------------------------------------
  // Actual browser download
  // ----------------------------------------------------------

  download: -15,


  // ----------------------------------------------------------
  // PHISHING / SOCIAL ENGINEERING
  //
  // This is a strong signal because content.js only sends
  // this when it detects BOTH:
  //
  //   1. A password field
  //   2. Suspicious account-verification language
  //
  // Examples:
  //
  // "Verify Your Account"
  // "re-verification"
  // "confirm your password"
  // "verify your identity"
  //
  // Therefore this is much stronger than a normal login form.
  // ----------------------------------------------------------

  phishingIndicator: -45,


  // ----------------------------------------------------------
  // Suspicious download link
  //
  // Example:
  //
  // "Download your invoice"
  //
  // when it appears together with a credential-focused page.
  // ----------------------------------------------------------

  suspiciousDownloadLink: -10,


  // ----------------------------------------------------------
  // Redirect penalty
  //
  // A single redirect can be normal.
  // Multiple redirects become increasingly suspicious.
  // ----------------------------------------------------------

  redirectPerHop: -4,
};


// ============================================================
// SCORE THRESHOLDS
// ============================================================

export const THRESHOLDS = {

  // 80–100
  safe: 80,

  // 50–79
  caution: 50,

  // Below 50:
  //
  // DO NOT USE
  // QUARANTINE
};


// ============================================================
// VERDICT
// ============================================================

export function verdictForScore(score) {

  if (score >= THRESHOLDS.safe) {

    return "SAFE TO USE";

  }

  if (score >= THRESHOLDS.caution) {

    return "USE WITH CAUTION";

  }

  return "DO NOT USE";
}


// ============================================================
// QUARANTINE DECISION
//
// This must use the same boundary as background.js.
//
// score < 50
//       ↓
// QUARANTINE
// ============================================================

export function isQuarantineTier(score) {

  return score < THRESHOLDS.caution;
}


// ============================================================
// COMPUTE SCORE
//
// Input:
//
// {
//   https: true,
//   credentialForm: true,
//   externalForm: false,
//   download: false,
//   phishingIndicator: true,
//   suspiciousDownloadLink: true,
//   redirects: 0
// }
//
// Output:
//
// {
//   score: 35,
//   verdict: "DO NOT USE",
//   evidence: [...]
// }
// ============================================================

export function computeScore(signals = {}) {

  // Start every website at 100.
  let score = 100;

  // Explainable evidence shown to the dashboard.
  const evidence = [];


  // ==========================================================
  // HTTPS
  // ==========================================================

  if (signals.https === false) {

    score += WEIGHTS.insecureHttp;

    evidence.push({

      signal: "insecureHttp",

      weight: WEIGHTS.insecureHttp,

      message:
        "Website is not using HTTPS",

    });
  }


  // ==========================================================
  // CREDENTIAL FORM
  //
  // Small penalty only.
  //
  // A normal website can legitimately contain a password field.
  // ==========================================================

  if (signals.credentialForm) {

    score += WEIGHTS.credentialForm;

    evidence.push({

      signal: "credentialForm",

      weight: WEIGHTS.credentialForm,

      message:
        "Password or credential form detected",

    });
  }


  // ==========================================================
  // PHISHING INDICATOR
  //
  // Strong penalty.
  //
  // This should only be sent by content.js when suspicious
  // account-verification language is detected together with
  // a credential/password form.
  // ==========================================================

  if (signals.phishingIndicator) {

    score += WEIGHTS.phishingIndicator;

    evidence.push({

      signal: "phishingIndicator",

      weight: WEIGHTS.phishingIndicator,

      message:
        "Suspicious account-verification language detected on a credential-focused page",

    });
  }


  // ==========================================================
  // EXTERNAL FORM
  // ==========================================================

  if (signals.externalForm) {

    score += WEIGHTS.externalForm;

    evidence.push({

      signal: "externalForm",

      weight: WEIGHTS.externalForm,

      message:
        "A form submits data to a different domain than the one being visited",

    });
  }


  // ==========================================================
  // ACTUAL DOWNLOAD
  // ==========================================================

  if (signals.download) {

    score += WEIGHTS.download;

    evidence.push({

      signal: "download",

      weight: WEIGHTS.download,

      message:
        "The website initiated a file download",

    });
  }


  // ==========================================================
  // SUSPICIOUS DOWNLOAD LINK
  //
  // This is different from an actual download.
  //
  // content.js can detect suspicious download wording before
  // the user actually clicks the link.
  // ==========================================================

  if (signals.suspiciousDownloadLink) {

    score += WEIGHTS.suspiciousDownloadLink;

    evidence.push({

      signal: "suspiciousDownloadLink",

      weight: WEIGHTS.suspiciousDownloadLink,

      message:
        "Suspicious download link detected on a credential-focused page",

    });
  }


  // ==========================================================
  // REDIRECTS
  // ==========================================================

  const redirectCount =
    Number(signals.redirects || 0);

  if (redirectCount > 0) {

    const delta =
      WEIGHTS.redirectPerHop *
      redirectCount;

    score += delta;

    evidence.push({

      signal: "redirects",

      weight: delta,

      message:
        `${redirectCount} redirect hop(s) observed during navigation`,

    });
  }


  // ==========================================================
  // NORMALIZE SCORE
  //
  // Never allow:
  //
  // score > 100
  //
  // or:
  //
  // score < 0
  // ==========================================================

  score =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(score)
      )
    );


  // ==========================================================
  // FINAL RESULT
  // ==========================================================

  return {

    score,

    verdict:
      verdictForScore(score),

    evidence,

  };
}