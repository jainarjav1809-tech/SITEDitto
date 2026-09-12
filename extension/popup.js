// ============================================
// SITEDitto Browser Extension
// Review 1 Demo Version
// ============================================


// --------------------------------------------
// Get elements
// --------------------------------------------

const websiteUrlElement =
  document.getElementById("websiteUrl");

const loadingElement =
  document.getElementById("loading");

const resultElement =
  document.getElementById("result");

const scoreElement =
  document.getElementById("score");

const verdictElement =
  document.getElementById("verdict");

const warningCheck =
  document.getElementById("warningCheck");

const fullAnalysisButton =
  document.getElementById("fullAnalysis");


// --------------------------------------------
// Demo website analysis
// --------------------------------------------

function analyzeWebsite(url) {

  const lowerUrl = url.toLowerCase();


  // ------------------------------------------
  // DANGEROUS
  // ------------------------------------------

  if (
    lowerUrl.includes("verify-account") ||
    lowerUrl.includes("secure-account") ||
    lowerUrl.includes("login-verification") ||
    lowerUrl.includes("free-prize") ||
    lowerUrl.includes("password-reset")
  ) {

    return {

      score: 23,

      verdict: "🚨 DO NOT USE",

      type: "danger",

      checks: [
        "Suspicious redirect detected",
        "Phishing indicators detected",
        "Credential form detected",
        "Unknown external destination"
      ]

    };

  }


  // ------------------------------------------
  // CAUTION
  // ------------------------------------------

  if (
    lowerUrl.includes("bit.ly") ||
    lowerUrl.includes("tinyurl") ||
    lowerUrl.includes("t.co") ||
    lowerUrl.includes("shorturl") ||
    lowerUrl.includes("login") ||
    lowerUrl.includes("account")
  ) {

    return {

      score: 61,

      verdict: "⚠ USE WITH CAUTION",

      type: "caution",

      checks: [
        "Shortened or sensitive URL",
        "Additional redirect possible",
        "Third-party network activity",
        "Verify website identity"
      ]

    };

  }


  // ------------------------------------------
  // SAFE
  // ------------------------------------------

  return {

    score: 94,

    verdict: "✓ SAFE TO USE",

    type: "safe",

    checks: [
      "HTTPS connection",
      "No suspicious redirect",
      "Low network risk",
      "Analytics detected"
    ]

  };

}


// --------------------------------------------
// Update check list
// --------------------------------------------

function updateChecks(checks) {

  const checksContainer =
    document.querySelector(".checks");


  checksContainer.innerHTML = "";


  checks.forEach((check, index) => {

    const div =
      document.createElement("div");

    div.className = "check";


    const icon =
      document.createElement("span");

    icon.className = "check-icon";


    const text =
      document.createElement("span");


    text.textContent = check;


    // First two are treated as positive
    if (index < 2) {

      icon.textContent = "✓";

    } else {

      icon.textContent = "!";

      div.classList.add("warning");

    }


    div.appendChild(icon);

    div.appendChild(text);

    checksContainer.appendChild(div);

  });

}


// --------------------------------------------
// Display analysis
// --------------------------------------------

function displayResult(url) {

  const analysis =
    analyzeWebsite(url);


  // URL
  websiteUrlElement.textContent = url;


  // Score
  scoreElement.textContent =
    analysis.score;


  // Verdict
  verdictElement.textContent =
    analysis.verdict;


  // Reset classes
  verdictElement.className =
    "verdict " + analysis.type;


  // Checks
  updateChecks(
    analysis.checks
  );


  // Show result
  loadingElement.classList.add(
    "hidden"
  );

  resultElement.classList.remove(
    "hidden"
  );

}


// --------------------------------------------
// Get current browser tab
// --------------------------------------------

function getCurrentTab() {

  chrome.tabs.query(
    {
      active: true,
      currentWindow: true
    },

    function(tabs) {

      if (
        !tabs ||
        tabs.length === 0
      ) {

        websiteUrlElement.textContent =
          "No active tab";

        loadingElement.classList.add(
          "hidden"
        );

        return;

      }


      const tab = tabs[0];


      const url =
        tab.url;


      // Browser internal pages
      if (
        !url ||
        url.startsWith("chrome://") ||
        url.startsWith("edge://") ||
        url.startsWith("about:")
      ) {

        websiteUrlElement.textContent =
          "Browser internal page";

        loadingElement.classList.add(
          "hidden"
        );

        resultElement.classList.remove(
          "hidden"
        );

        scoreElement.textContent =
          "--";

        verdictElement.textContent =
          "Cannot analyze this page";

        verdictElement.className =
          "verdict caution";

        return;

      }


      // --------------------------------------
      // Simulate analysis
      // --------------------------------------

      setTimeout(
        function() {

          displayResult(url);

        },
        900
      );


      // --------------------------------------
      // Full dashboard button
      // --------------------------------------

fullAnalysisButton.onclick =
  function() {

    chrome.tabs.create(
      {
        url: "http://localhost:5173/"
      }
    );

  };    

    }

  );

}


// --------------------------------------------
// Start
// --------------------------------------------

getCurrentTab();