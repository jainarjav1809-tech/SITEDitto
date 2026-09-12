import React, { useEffect, useState } from "react";
import jsQR from "jsqr";

/*
=========================================================
 SITEDitto
 Virtual Website Security Environment
 FRONTEND-ONLY REVIEW 1 VERSION

 Features:
 - Website scanning UI
 - QR / Shortlink scanner
 - Phishing detection UI
 - Network intelligence
 - Privacy analysis
 - Credential safety
 - LiveGuard
 - Scan history
 - Security report
=========================================================
*/


/* ========================================================
   DEMO WEBSITE SCENARIOS
======================================================== */

const scenarios = {
  safe: {
    score: 94,
    security: 98,
    privacy: 91,
    phishing: 97,
    network: 94,
    credential: 95,
    download: 92,

    verdict: "SAFE TO USE",

    events: [
      ["✓", "HTTPS", "Secure HTTPS connection established", "safe"],
      ["✓", "BROWSER", "Isolated analysis environment created", "safe"],
      ["✓", "NETWORK", "Connected to website CDN", "safe"],
      ["✓", "SCRIPT", "Page scripts loaded successfully", "safe"],
      ["!", "TRACKER", "One analytics service detected", "warning"],
      ["✓", "SCAN", "No suspicious redirect detected", "safe"],
    ],

    destinations: [
      ["example.com", "Target Website", "United States", "Low", "128"],
      ["cdn.example.com", "CDN", "United States", "Low", "34"],
      [
        "analytics.example.com",
        "Analytics",
        "Germany",
        "Medium",
        "9",
      ],
    ],

    findings: [
      "HTTPS is enabled for the current session.",
      "One analytics destination was observed.",
      "No suspicious redirect chain was detected.",
      "A login form is present. Verify the domain before entering credentials.",
    ],
  },

  caution: {
    score: 61,
    security: 72,
    privacy: 48,
    phishing: 64,
    network: 57,
    credential: 55,
    download: 82,

    verdict: "USE WITH CAUTION",

    events: [
      ["✓", "HTTPS", "Secure HTTPS connection established", "safe"],
      ["!", "NETWORK", "11 external domains contacted", "warning"],
      ["!", "TRACKER", "Advertising tracker detected", "warning"],
      ["!", "REDIRECT", "Redirect chain contains 3 hops", "warning"],
      ["!", "LOGIN", "Password field detected", "warning"],
      ["!", "NETWORK", "Unexpected third-party endpoint observed", "warning"],
    ],

    destinations: [
      ["shop-example.com", "Target Website", "United States", "Medium", "81"],
      ["cdn.example.net", "CDN", "Netherlands", "Low", "24"],
      ["analytics.example.net", "Analytics", "Germany", "Medium", "13"],
      ["ads.example.net", "Advertising", "Singapore", "Medium", "17"],
      ["unknown-cdn.net", "Unknown", "Romania", "High", "4"],
    ],

    findings: [
      "Multiple third-party domains were observed.",
      "Advertising and tracker-like connections reduce the privacy score.",
      "A multi-hop redirect chain was observed.",
      "A password field is present. Verify the exact domain before submitting credentials.",
    ],
  },

  danger: {
    score: 23,
    security: 18,
    privacy: 41,
    phishing: 9,
    network: 22,
    credential: 12,
    download: 35,

    verdict: "DO NOT USE",

    events: [
      ["✓", "HTTPS", "HTTPS connection established", "safe"],
      ["×", "REDIRECT", "Suspicious redirect detected", "danger"],
      ["×", "PHISHING", "URL contains phishing-like indicators", "danger"],
      ["×", "LOGIN", "Credential form detected on suspicious domain", "danger"],
      ["×", "NETWORK", "Unknown external destination contacted", "danger"],
      ["×", "DOWNLOAD", "Potentially risky download observed", "danger"],
    ],

    destinations: [
      [
        "secure-account-login.example",
        "Target Website",
        "Unknown",
        "High",
        "13",
      ],
      [
        "track-service.example",
        "Tracker",
        "United States",
        "Medium",
        "7",
      ],
      [
        "unknown-host.example",
        "Unknown",
        "Unknown",
        "High",
        "5",
      ],
    ],

    findings: [
      "The URL contains terms commonly associated with account or payment lures.",
      "A suspicious redirect chain was observed.",
      "Credential fields appear on a high-risk domain.",
      "An unknown external destination was contacted.",
      "A download event was observed. Do not open the file without independent scanning.",
    ],
  },
};


/* ========================================================
   QR / SHORTLINK DEMO DATA
======================================================== */

const qrScenarios = {
  safe: {
    original:
      "https://bit.ly/siteditto-demo",

    final:
      "https://example.com",

    redirects: 1,

    score: 94,

    verdict: "SAFE TO USE",

    phishing: 97,
    network: 94,
    privacy: 91,
    credential: 95,

    message:
      "The shortened link resolves to a low-risk destination with no suspicious redirect indicators.",

    redirectsList: [
      "bit.ly/siteditto-demo",
      "example.com",
    ],
  },

  caution: {
    original:
      "https://tinyurl.com/account-check",

    final:
      "https://account-verification-example.com",

    redirects: 3,

    score: 61,

    verdict: "USE WITH CAUTION",

    phishing: 64,
    network: 57,
    privacy: 48,
    credential: 55,

    message:
      "The link uses a shortening service and redirects through multiple destinations. Verify the final domain before continuing.",

    redirectsList: [
      "tinyurl.com/account-check",
      "redirect-service.example",
      "verify-account.example",
      "account-verification-example.com",
    ],
  },

  danger: {
    original:
      "https://qr-example.com/login",

    final:
      "https://secure-account-login-example.com",

    redirects: 5,

    score: 18,

    verdict: "DO NOT USE",

    phishing: 7,
    network: 19,
    privacy: 32,
    credential: 9,

    message:
      "The QR/link resolves through a suspicious redirect chain and ends at a credential-focused domain with phishing indicators.",

    redirectsList: [
      "qr-example.com/login",
      "short-link.example",
      "redirect-example.net",
      "verify-user.example",
      "account-check.example",
      "secure-account-login-example.com",
    ],
  },
};


/* ========================================================
   MAIN APP
======================================================== */

export default function App() {

  const [page, setPage] =
    useState("Dashboard");

  const [sidebarOpen, setSidebarOpen] =
    useState(true);

  const [scenario, setScenario] =
    useState("safe");

  const [url, setUrl] =
    useState("https://example.com");

  const [scanning, setScanning] =
    useState(false);

  const [progress, setProgress] =
    useState(0);

  const [result, setResult] =
    useState(null);

  const [liveGuard, setLiveGuard] =
    useState(true);

  const [selectedAction, setSelectedAction] =
    useState("Browse");

  const [aiAnswer, setAiAnswer] =
    useState("");

  const [history, setHistory] =
    useState([
      {
        url: "https://example.com",
        score: 94,
        verdict: "SAFE TO USE",
        time: "Today, 10:42",
      },

      {
        url: "https://shop-example.com",
        score: 61,
        verdict: "USE WITH CAUTION",
        time: "Today, 09:18",
      },

      {
        url:
          "https://secure-account-login.example",
        score: 23,
        verdict: "DO NOT USE",
        time: "Yesterday",
      },
    ]);


  /* ======================================================
     QR STATES
  ====================================================== */

  const [qrInput, setQrInput] =
    useState("");

  const [qrFile, setQrFile] =
    useState(null);

  const [qrScanning, setQrScanning] =
    useState(false);

  const [qrProgress, setQrProgress] =
    useState(0);

  const [qrResult, setQrResult] =
    useState(null);

  const [qrError, setQrError] =
    useState("");

  const [decodedQrUrl, setDecodedQrUrl] =
    useState("");


  const data =
    result || scenarios[scenario];


  /* ======================================================
     WEBSITE SCAN
  ====================================================== */

  function startScan() {

    if (!url.trim() || scanning) {
      return;
    }

    setScanning(true);
    setProgress(0);
    setResult(null);

    let current = 0;

    const timer =
      setInterval(() => {

        current += 10;

        setProgress(current);

        if (current >= 100) {

          clearInterval(timer);

          setTimeout(() => {

            const scanData = {
              ...scenarios[scenario],
              url: url.trim(),
            };

            setResult(scanData);

            setScanning(false);

            setHistory((old) => [

              {
                url: url.trim(),
                score: scanData.score,
                verdict:
                  scanData.verdict,
                time: "Just now",
              },

              ...old,

            ].slice(0, 8));

          }, 400);
        }

      }, 180);
  }


  /* ======================================================
     LIVEGUARD
  ====================================================== */

  useEffect(() => {

    if (!liveGuard || !result) {
      return;
    }

    const timer =
      setInterval(() => {

        setResult((current) => {

          if (!current) {
            return current;
          }

          const change =
            Math.random() > 0.8
              ? -1
              : 0;

          return {
            ...current,

            score: Math.max(
              1,
              current.score + change
            ),
          };

        });

      }, 3000);

    return () =>
      clearInterval(timer);

  }, [liveGuard, result]);


  /* ======================================================
     QR / SHORTLINK SCAN
  ====================================================== */

  async function decodeQrImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const image = new Image();

        image.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d", {
              willReadFrequently: true,
            });

            if (!context) {
              reject(new Error("Could not process the QR image."));
              return;
            }

            const maxSize = 1600;
            const scale = Math.min(
              1,
              maxSize /
                Math.max(
                  image.naturalWidth,
                  image.naturalHeight
                )
            );

            canvas.width = Math.max(
              1,
              Math.round(image.naturalWidth * scale)
            );
            canvas.height = Math.max(
              1,
              Math.round(image.naturalHeight * scale)
            );

            context.drawImage(
              image,
              0,
              0,
              canvas.width,
              canvas.height
            );

            const imageData = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            );

            const code = jsQR(
              imageData.data,
              imageData.width,
              imageData.height,
              {
                inversionAttempts: "attemptBoth",
              }
            );

            if (!code?.data) {
              reject(
                new Error(
                  "No readable QR code was found. Try a clearer QR image."
                )
              );
              return;
            }

            resolve(code.data.trim());
          } catch {
            reject(
              new Error(
                "The QR image could not be processed. Please try another image."
              )
            );
          }
        };

        image.onerror = () => {
          reject(
            new Error(
              "This image could not be opened. Please choose a valid PNG, JPG or WEBP file."
            )
          );
        };

        image.src = reader.result;
      };

      reader.onerror = () => {
        reject(
          new Error(
            "The QR image could not be read. Please try again."
          )
        );
      };

      reader.readAsDataURL(file);
    });
  }

  function classifyQrDestination(input) {
    const normalized = input.trim().toLowerCase();

    // Synthetic phishing examples use reserved .example domains.
    if (
      normalized.includes(".example") ||
      normalized.includes("login-verification") ||
      normalized.includes("account-security-verify")
    ) {
      return {
        ...qrScenarios.danger,
        message:
          "The decoded destination contains high-risk account/login language. This is a synthetic phishing demonstration URL; do not visit or enter credentials.",
        redirectsList: [
          normalized.replace(/^https?:\/\//, ""),
          "credential-check.example",
          "account-security-verify.example",
        ],
      };
    }

    // Shortened links are shown as caution until backend redirect
    // resolution is connected.
    if (
      normalized.includes("tinyurl") ||
      normalized.includes("bit.ly") ||
      normalized.includes("bitly") ||
      normalized.includes("t.co") ||
      normalized.includes("is.gd") ||
      normalized.includes("ow.ly") ||
      normalized.includes("shorturl")
    ) {
      return qrScenarios.caution;
    }

    // Safe baseline for ordinary HTTPS URLs in Review 1.
    return {
      ...qrScenarios.safe,
      message:
        "The QR code was decoded successfully. The destination uses HTTPS and no obvious phishing keywords were found in the URL.",
      redirectsList: [
        normalized.replace(/^https?:\/\//, ""),
      ],
    };
  }

  async function analyzeQrLink() {
    if (!qrInput.trim() && !qrFile) {
      setQrError("Enter a link or choose a QR image first.");
      return;
    }

    setQrScanning(true);
    setQrProgress(0);
    setQrResult(null);
    setQrError("");

    let current = 0;

    const progressTimer = setInterval(() => {
      current = Math.min(current + 10, 90);
      setQrProgress(current);
    }, 120);

    try {
      let destination = qrInput.trim();

      // A selected QR image is decoded locally in the browser.
      if (qrFile) {
        destination = await decodeQrImage(qrFile);
        setDecodedQrUrl(destination);
        setQrInput(destination);
      } else {
        setDecodedQrUrl("");
      }

      if (!/^https?:\/\//i.test(destination)) {
        destination = `https://${destination}`;
      }

      let parsedUrl;

      try {
        parsedUrl = new URL(destination);
      } catch {
        throw new Error(
          "The QR was decoded, but it does not contain a valid website URL."
        );
      }

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error(
          "SITEDitto currently analyzes HTTP and HTTPS destinations only."
        );
      }

      // Review 1 frontend analysis. Real redirect resolution will be
      // connected to the backend in the next phase.
      const selected = classifyQrDestination(parsedUrl.href);

      await new Promise((resolve) => {
        setTimeout(resolve, 250);
      });

      clearInterval(progressTimer);
      setQrProgress(100);

      setTimeout(() => {
        setQrResult({
          ...selected,
          original: parsedUrl.href,
          final:
            selected === qrScenarios.safe
              ? parsedUrl.href
              : selected.final,
          message:
            selected === qrScenarios.safe
              ? "The QR code was decoded successfully. No obvious phishing keywords were found in the destination URL."
              : selected.message,
          redirectsList:
            selected === qrScenarios.safe
              ? [parsedUrl.host]
              : selected.redirectsList,
        });

        setQrScanning(false);
      }, 300);
    } catch (error) {
      clearInterval(progressTimer);
      setQrProgress(0);
      setQrScanning(false);
      setQrError(
        error?.message || "Unable to analyze this QR/link."
      );
    }
  }



  /* ======================================================
     NAVIGATION
  ====================================================== */

  const navigation = [

    ["Dashboard", "⌂"],

    ["Scan Website", "⌕"],

    ["QR / Link Scanner", "▣"],

    ["LiveGuard", "◉"],

    ["Network Intelligence", "◎"],

    ["Privacy & Tracking", "◌"],

    ["Credential Safety", "🔑"],

    ["Scan History", "◷"],

  ];


  /* ======================================================
     APP UI
  ====================================================== */

  return (

    <div className="app">

      {/* ==================================================
          TOP BAR
      ================================================== */}

      <header className="topbar">

        <div className="brand">

          <button
            className="menu"
            onClick={() =>
              setSidebarOpen(
                (value) => !value
              )
            }
          >
            ☰
          </button>

          <div className="logo">
            🛡
          </div>

          <div>

            <div className="brandName">
              SITE<span>Ditto</span>
            </div>

            <div className="brandSub">
              VIRTUAL WEBSITE SECURITY
            </div>

          </div>

        </div>


        <div className="topActions">

          <div className="system">

            <span></span>

            System Online

          </div>


          <button
            className={`live ${
              liveGuard ? "on" : ""
            }`}
            onClick={() =>
              setLiveGuard(
                (value) => !value
              )
            }
          >

            ◉ LiveGuard{" "}

            {liveGuard
              ? "ON"
              : "OFF"}

          </button>


          <div className="avatar">
            U
          </div>

        </div>

      </header>


      <div className="body">


        {/* =================================================
            SIDEBAR
        ================================================= */}

        {sidebarOpen && (

          <aside className="sidebar">

            <div className="sideLabel">
              SECURITY CENTER
            </div>


            {navigation.map(
              ([name, icon]) => (

                <button
                  key={name}
                  className={`navItem ${
                    page === name
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setPage(name)
                  }
                >

                  <span className="icon">
                    {icon}
                  </span>

                  <span>
                    {name}
                  </span>

                </button>

              )
            )}


            <div className="sideBottom">

              <div className="sideLabel">
                SYSTEM
              </div>


              <button
                className={`navItem ${
                  page ===
                  "Security Report"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setPage(
                    "Security Report"
                  )
                }
              >

                <span className="icon">
                  ▤
                </span>

                <span>
                  Security Report
                </span>

              </button>


              <button
                className={`navItem ${
                  page === "Settings"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setPage("Settings")
                }
              >

                <span className="icon">
                  ⚙
                </span>

                <span>
                  Settings
                </span>

              </button>


              <div className="environment">

                <div className="envIcon">
                  🛡
                </div>

                <div>

                  <b>
                    Isolated Mode
                  </b>

                  <small>
                    Ready for analysis
                  </small>

                </div>

                <span className="greenDot"></span>

              </div>

            </div>

          </aside>

        )}


        {/* =================================================
            MAIN CONTENT
        ================================================= */}

        <main className="content">


          {/* =================================================
              DASHBOARD
          ================================================= */}

          {(page === "Dashboard" ||
            page === "Scan Website") && (

            <Dashboard
              url={url}
              setUrl={setUrl}
              scenario={scenario}
              setScenario={setScenario}
              scanning={scanning}
              progress={progress}
              startScan={startScan}
              data={data}
              liveGuard={liveGuard}
              selectedAction={
                selectedAction
              }
              setSelectedAction={
                setSelectedAction
              }
              aiAnswer={aiAnswer}
              setAiAnswer={setAiAnswer}
              setPage={setPage}
            />

          )}


          {/* =================================================
              QR PAGE
          ================================================= */}

          {page === "QR / Link Scanner" && (

            <QrScannerPage

              qrInput={qrInput}

              setQrInput={setQrInput}

              qrFile={qrFile}

              setQrFile={setQrFile}

              qrScanning={qrScanning}

              qrProgress={qrProgress}

              qrResult={qrResult}

              qrError={qrError}

              decodedQrUrl={decodedQrUrl}

              analyzeQrLink={
                analyzeQrLink
              }

            />

          )}


          {/* =================================================
              LIVEGUARD
          ================================================= */}

          {page === "LiveGuard" && (

            <LiveGuardPage
              liveGuard={liveGuard}
              setLiveGuard={
                setLiveGuard
              }
              data={data}
            />

          )}


          {/* =================================================
              NETWORK
          ================================================= */}

          {page ===
            "Network Intelligence" && (

            <NetworkPage
              data={data}
            />

          )}


          {/* =================================================
              PRIVACY
          ================================================= */}

          {page ===
            "Privacy & Tracking" && (

            <PrivacyPage
              data={data}
            />

          )}


          {/* =================================================
              CREDENTIAL
          ================================================= */}

          {page ===
            "Credential Safety" && (

            <CredentialPage
              data={data}
            />

          )}


          {/* =================================================
              HISTORY
          ================================================= */}

          {page === "Scan History" && (

            <HistoryPage
              history={history}
              setUrl={setUrl}
              setScenario={setScenario}
              setPage={setPage}
            />

          )}


          {/* =================================================
              REPORT
          ================================================= */}

          {page ===
            "Security Report" && (

            <ReportPage
              data={data}
              url={url}
            />

          )}


          {/* =================================================
              SETTINGS
          ================================================= */}

          {page === "Settings" && (

            <SettingsPage
              liveGuard={liveGuard}
              setLiveGuard={
                setLiveGuard
              }
            />

          )}

        </main>

      </div>

    </div>
  );
}


/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard({
  url,
  setUrl,
  scenario,
  setScenario,
  scanning,
  progress,
  startScan,
  data,
  liveGuard,
  selectedAction,
  setSelectedAction,
  aiAnswer,
  setAiAnswer,
  setPage,
}) {

  const advice = {

    Browse:
      "Basic browsing currently appears acceptable based on the observed security signals.",

    Account:
      "Creating an account is possible, but use a unique password.",

    Password:
      "Verify the exact domain and HTTPS before submitting your password.",

    Payment:
      "Do not enter payment information if the domain or payment flow looks unexpected.",

    Upload:
      "Upload only non-sensitive files unless you fully trust the website.",

    Download:
      "Scan downloaded files with trusted security software before opening them.",

  };


  return (

    <>

      {/* HEADING */}

      <section className="heading">

        <div>

          <div className="eyebrow">
            WEBSITE SECURITY ENVIRONMENT
          </div>

          <h1>

            Don't trust the website.

            <br />

            <span>
              Test it first.
            </span>

          </h1>

          <p>
            SITEDitto creates an
            isolated execution session
            for a website, observes
            security-relevant browser
            behavior and provides an
            actionable security verdict.
          </p>

        </div>


        <div className="demoSelector">

          <span>
            DEMO SCENARIO
          </span>

          <select
            value={scenario}
            onChange={(event) =>
              setScenario(
                event.target.value
              )
            }
          >

            <option value="safe">
              Safe Website
            </option>

            <option value="caution">
              Suspicious Website
            </option>

            <option value="danger">
              Dangerous Website
            </option>

          </select>

        </div>

      </section>


      {/* WEBSITE SCANNER */}

      <section className="scannerBox">

        <span className="searchIcon">
          🔍
        </span>

        <input
          value={url}
          onChange={(event) =>
            setUrl(event.target.value)
          }
          onKeyDown={(event) => {

            if (
              event.key === "Enter"
            ) {
              startScan();
            }

          }}
          placeholder="Enter website URL..."
        />

        <button
          onClick={startScan}
          disabled={scanning}
        >

          {scanning
            ? "Analyzing..."
            : "Scan Website"}

        </button>

      </section>


      {/* PROGRESS */}

      {scanning && (

        <section className="scanProgress">

          <div className="progressHead">

            <span>
              ⚡ SITEDitto isolated
              analysis running...
            </span>

            <b>
              {progress}%
            </b>

          </div>


          <div className="progressTrack">

            <div
              style={{
                width:
                  `${progress}%`,
              }}
            />

          </div>


          <div className="scanSteps">

            <span
              className={
                progress >= 20
                  ? "done"
                  : ""
              }
            >
              ● Create environment
            </span>

            <span
              className={
                progress >= 40
                  ? "done"
                  : ""
              }
            >
              ● Load website
            </span>

            <span
              className={
                progress >= 60
                  ? "done"
                  : ""
              }
            >
              ● Observe behavior
            </span>

            <span
              className={
                progress >= 80
                  ? "done"
                  : ""
              }
            >
              ● Analyze risk
            </span>

            <span
              className={
                progress >= 100
                  ? "done"
                  : ""
              }
            >
              ● Generate verdict
            </span>

          </div>

        </section>

      )}


      {!scanning && (

        <>

          {/* SCORE + RISK */}

          <section className="topGrid">

            <div className="card scoreCard">

              <div className="cardLabel">
                SITEDitto Trust Score
              </div>

              <div className="scoreLine">

                <span>
                  {data.score}
                </span>

                <small>
                  / 100
                </small>

              </div>


              <Verdict
                verdict={data.verdict}
              />


              <div className="fakeChart">

                {[
                  25,
                  35,
                  30,
                  45,
                  42,
                  55,
                  51,
                  66,
                  61,
                  75,
                  82,
                  88,
                  data.score,
                ].map(
                  (value, index) => (

                    <div
                      key={index}
                      style={{
                        height:
                          `${Math.max(
                            10,
                            value * 0.55
                          )}%`,
                      }}
                    />

                  )
                )}

              </div>


              <div className="scoreFoot">

                <span>
                  Risk signal trend
                </span>

                <span>
                  {liveGuard
                    ? "LIVE"
                    : "PAUSED"}
                </span>

              </div>

            </div>


            {/* RISK */}

            <div className="card">

              <div className="cardHead">

                <div>

                  <h2>
                    Risk Breakdown
                  </h2>

                  <p>
                    Explainable signals
                    from the isolated browser.
                  </p>

                </div>

                <span className="cardSymbol">
                  ◈
                </span>

              </div>


              <div className="riskGrid">

                <Risk
                  label="Security"
                  value={
                    data.security
                  }
                />

                <Risk
                  label="Privacy"
                  value={
                    data.privacy
                  }
                />

                <Risk
                  label="Phishing"
                  value={
                    data.phishing
                  }
                />

                <Risk
                  label="Network Safety"
                  value={
                    data.network
                  }
                />

                <Risk
                  label="Credential Safety"
                  value={
                    data.credential
                  }
                />

                <Risk
                  label="Download Safety"
                  value={
                    data.download
                  }
                />

              </div>

            </div>

          </section>


          {/* ACTIVITY + ACTIONS */}

          <section className="twoGrid">

            <div className="card">

              <div className="cardHead">

                <div>

                  <h2>
                    ◉ Live Website Activity
                  </h2>

                  <p>
                    Browser-visible
                    security events.
                  </p>

                </div>


                {liveGuard && (

                  <div className="monitor">

                    <span />

                    MONITORING

                  </div>

                )}

              </div>


              <div className="events">

                {data.events.map(
                  (event, index) => (

                    <Event
                      key={index}
                      icon={event[0]}
                      type={event[1]}
                      message={event[2]}
                      severity={event[3]}
                    />

                  )
                )}

              </div>

            </div>


            <div className="card">

              <div className="cardHead">

                <div>

                  <h2>
                    ◇ What Can I Safely Do?
                  </h2>

                  <p>
                    Action-specific
                    security guidance.
                  </p>

                </div>

              </div>


              <div className="actions">

                {[
                  "Browse",
                  "Account",
                  "Password",
                  "Payment",
                  "Upload",
                  "Download",
                ].map((item) => (

                  <button
                    key={item}
                    className={`action ${
                      selectedAction === item
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedAction(item)
                    }
                  >

                    <span>

                      {item ===
                      "Password"
                        ? "🔑"
                        : item ===
                          "Payment"
                        ? "💳"
                        : item ===
                          "Download"
                        ? "↓"
                        : item ===
                          "Upload"
                        ? "↑"
                        : item ===
                          "Account"
                        ? "●"
                        : "○"}

                    </span>

                    <span>
                      {item}
                    </span>

                    <span>
                      ›
                    </span>

                  </button>

                ))}

              </div>


              <div className="recommend">

                <div>
                  ✓ Recommendation
                </div>

                <p>
                  {advice[selectedAction]}
                </p>

              </div>

            </div>

          </section>


          {/* NETWORK + AI */}

          <section className="twoGrid">

            <div className="card">

              <div className="cardHead">

                <div>

                  <h2>
                    ◎ Where Is My Data Going?
                  </h2>

                  <p>
                    External destinations
                    observed during the session.
                  </p>

                </div>


                <button
                  className="textBtn"
                  onClick={() =>
                    setPage(
                      "Network Intelligence"
                    )
                  }
                >
                  View details →
                </button>

              </div>


              <NetworkFlow />


              <Destinations
                data={data}
              />

            </div>


            {/* AI */}

            <div className="card">

              <div className="cardHead">

                <div>

                  <h2>
                    ✦ AI Security Copilot
                  </h2>

                  <p>
                    Ask about the current
                    security evidence.
                  </p>

                </div>

                <span>
                  ✦
                </span>

              </div>


              <div className="questions">

                {[
                  "Why is this website risky?",
                  "Can I enter my password?",
                  "Who is tracking me?",
                  "Why did my score change?",
                ].map((question) => (

                  <button
                    key={question}
                    onClick={() =>
                      setAiAnswer(
                        question
                      )
                    }
                  >

                    {question}

                    <span>
                      ›
                    </span>

                  </button>

                ))}

              </div>


              {aiAnswer && (

                <div className="aiAnswer">

                  <b>
                    SITEDITTO AI
                  </b>

                  <p>

                    {aiAnswer.includes(
                      "password"
                    )
                      ? "The website contains a credential field. Verify the exact domain and HTTPS before submitting your password."

                      : aiAnswer.includes(
                          "tracking"
                        )
                      ? "Third-party analytics or tracking signals were observed. Check Network Intelligence and Privacy."

                      : `The current trust score is ${data.score}/100. SITEDitto calculated this from security, privacy, phishing and network signals.`}

                  </p>

                </div>

              )}

            </div>

          </section>


          {/* FINDINGS */}

          <section className="card findingsCard">

            <div className="cardHead">

              <div>

                <h2>
                  ⚠ Why did the score change?
                </h2>

                <p>
                  Evidence contributing to
                  the current verdict.
                </p>

              </div>

            </div>


            <div className="findingGrid">

              {data.findings.map(
                (finding, index) => (

                  <div
                    className="finding"
                    key={index}
                  >

                    <span>
                      ⚠
                    </span>

                    <p>
                      {finding}
                    </p>

                  </div>

                )
              )}

            </div>

          </section>

        </>

      )}

    </>
  );
}


/* =========================================================
   QR / LINK SCANNER PAGE
========================================================= */

function QrScannerPage({
  qrInput,
  setQrInput,
  qrFile,
  setQrFile,
  qrScanning,
  qrProgress,
  qrResult,
  qrError,
  decodedQrUrl,
  analyzeQrLink,
}) {

  return (

    <>

      <PageTitle
        eyebrow="QR & SHORTLINK SECURITY"
        title="Don't trust the QR. Test it first."
        sub="Upload a QR code or enter a shortened link. SITEDitto resolves the destination and analyzes the redirect chain before you visit it."
      />


      {/* INPUT AREA */}

      <div className="qrGrid">


        {/* QR UPLOAD */}

        <div className="card qrUploadCard">

          <div className="cardHead">

            <div>

              <h2>
                📷 QR Code Scanner
              </h2>

              <p>
                Upload a QR code image.
              </p>

            </div>

          </div>


          <label className="qrDrop">

            <div className="qrBigIcon">
              ▣
            </div>

            <strong>
              {qrFile
                ? qrFile.name
                : "Drop QR image here"}
            </strong>

            <span>
              PNG, JPG or WEBP
            </span>

            <div className="qrUploadButton">
              Choose QR Image
            </div>


            <input
              type="file"
              accept="image/*"
              onChange={(event) => {

                const file =
                  event.target.files?.[0];

                if (file) {
                  setQrFile(file);
                  setQrResult(null);
                }

              }}
              style={{
                display: "none",
              }}
            />

          </label>

        </div>


        {/* SHORTLINK */}

        <div className="card qrLinkCard">

          <div className="cardHead">

            <div>

              <h2>
                🔗 Shortened Link
              </h2>

              <p>
                Paste a URL or shortlink.
              </p>

            </div>

          </div>


          <div className="qrLinkInput">

            <span>
              🔍
            </span>

            <input
              value={qrInput}
              onChange={(event) =>
                setQrInput(
                  event.target.value
                )
              }
              placeholder="https://bit.ly/example"
            />

          </div>


          <div className="qrExamples">
            <button
              onClick={() =>
                setQrInput("https://www.google.com")
              }
            >
              Google
            </button>

            <button
              onClick={() =>
                setQrInput("https://github.com")
              }
            >
              GitHub
            </button>

            <button
              onClick={() =>
                setQrInput("https://www.wikipedia.org")
              }
            >
              Wikipedia
            </button>

            <button
              onClick={() =>
                setQrInput(
                  "https://github.com-login-verification.example"
                )
              }
            >
              Suspicious Login
            </button>

            <button
              onClick={() =>
                setQrInput(
                  "https://account-security-verify.example/login"
                )
              }
            >
              Phishing Demo
            </button>
          </div>


          <div className="qrDemoNote">
            Real websites are provided for safe demonstrations.
            Phishing examples use reserved <b>.example</b> domains
            and are not real malicious websites.
          </div>

          <button
            className="qrAnalyzeButton"
            onClick={
              analyzeQrLink
            }
            disabled={qrScanning}
          >

            {qrScanning
              ? "Resolving & Analyzing..."
              : "Analyze QR / Link →"}

          </button>

        </div>

      </div>


      {/* QR PROGRESS */}

      {qrScanning && (

        <div className="scanProgress qrProgress">

          <div className="progressHead">

            <span>
              ⚡ Resolving destination
              and analyzing redirect chain...
            </span>

            <b>
              {qrProgress}%
            </b>

          </div>


          <div className="progressTrack">

            <div
              style={{
                width:
                  `${qrProgress}%`,
              }}
            />

          </div>


          <div className="scanSteps">

            <span
              className={
                qrProgress >= 20
                  ? "done"
                  : ""
              }
            >
              ● Decode
            </span>

            <span
              className={
                qrProgress >= 40
                  ? "done"
                  : ""
              }
            >
              ● Resolve
            </span>

            <span
              className={
                qrProgress >= 60
                  ? "done"
                  : ""
              }
            >
              ● Follow redirects
            </span>

            <span
              className={
                qrProgress >= 80
                  ? "done"
                  : ""
              }
            >
              ● Analyze
            </span>

            <span
              className={
                qrProgress >= 100
                  ? "done"
                  : ""
              }
            >
              ● Verdict
            </span>

          </div>

        </div>

      )}


      {/* QR RESULT */}

      {qrResult && !qrScanning && (

        <section className="card qrResultCard">

          <div className="qrResultHeader">

            <div>

              <div className="eyebrow">
                QR / LINK ANALYSIS COMPLETE
              </div>

              <h2>
                Destination Analysis
              </h2>

            </div>


            <div className="qrScore">

              <span>
                {qrResult.score}
              </span>

              <small>
                /100
              </small>

            </div>

          </div>


          <Verdict
            verdict={
              qrResult.verdict
            }
          />


          {/* LINK CHAIN */}

          <div className="qrChain">

            <div className="chainTitle">
              REDIRECT CHAIN
            </div>


            {qrResult.redirectsList.map(
              (link, index) => (

                <div
                  className="chainItem"
                  key={index}
                >

                  <div className="chainNumber">
                    {index + 1}
                  </div>

                  <div className="chainLink">
                    {link}
                  </div>

                  {index <
                  qrResult
                    .redirectsList
                    .length -
                    1 ? (
                    <div className="chainArrow">
                      ↓
                    </div>
                  ) : (
                    <div className="finalBadge">
                      FINAL
                    </div>
                  )}

                </div>

              )
            )}

          </div>


          {/* ORIGINAL + FINAL */}

          <div className="qrDestinationGrid">

            <div className="destinationBox">

              <span>
                ORIGINAL LINK
              </span>

              <b>
                {qrResult.original}
              </b>

            </div>


            <div className="destinationBox final">

              <span>
                FINAL DESTINATION
              </span>

              <b>
                {qrResult.final}
              </b>

            </div>

          </div>


          {/* METRICS */}

          <div className="threeGrid">

            <Stat
              title="Redirects"
              value={
                qrResult.redirects
              }
            />

            <Stat
              title="Phishing Score"
              value={
                qrResult.phishing
              }
            />

            <Stat
              title="Network Score"
              value={
                qrResult.network
              }
            />

          </div>


          {/* EXPLANATION */}

          <div className="qrExplanation">

            <div>
              ⚠
            </div>

            <div>

              <b>
                SITEDitto Assessment
              </b>

              <p>
                {qrResult.message}
              </p>

            </div>

          </div>


          <div className="qrPrivacyNote">

            🔒 SITEDitto analyzes the
            destination before the user
            needs to interact with it.

          </div>

        </section>

      )}

    </>
  );
}


/* =========================================================
   RISK
========================================================= */

function Risk({
  label,
  value,
}) {

  return (

    <div className="risk">

      <div>

        <span>
          {label}
        </span>

        <b>
          {value}
        </b>

      </div>


      <div className="bar">

        <i
          style={{
            width:
              `${value}%`,
          }}
        />

      </div>

    </div>
  );
}


/* =========================================================
   VERDICT
========================================================= */

function Verdict({
  verdict,
}) {

  let className = "safe";

  if (
    verdict ===
    "USE WITH CAUTION"
  ) {
    className = "caution";
  }

  if (
    verdict ===
    "DO NOT USE"
  ) {
    className = "danger";
  }


  return (

    <div
      className={`verdict ${className}`}
    >

      <span>

        {className === "safe"
          ? "✓"
          : className === "caution"
          ? "!"
          : "×"}

      </span>

      {verdict}

    </div>

  );
}


/* =========================================================
   EVENT
========================================================= */

function Event({
  icon,
  type,
  message,
  severity,
}) {

  return (

    <div className="event">

      <div
        className={`eventIcon ${severity}`}
      >
        {icon}
      </div>


      <div>

        <small>
          {type}
        </small>

        <span>
          {message}
        </span>

      </div>


      <em>
        LIVE
      </em>

    </div>

  );
}


/* =========================================================
   NETWORK FLOW
========================================================= */

function NetworkFlow() {

  return (

    <div className="networkFlow">

      <div className="node main">

        <strong>
          ◉
        </strong>

        <span>
          Website
        </span>

      </div>


      <span className="flowArrow">
        →
      </span>


      <div className="node">

        <strong>
          ▣
        </strong>

        <span>
          CDN
        </span>

      </div>


      <span className="flowArrow">
        →
      </span>


      <div className="node">

        <strong>
          ◌
        </strong>

        <span>
          Analytics
        </span>

      </div>


      <span className="flowArrow">
        →
      </span>


      <div className="node">

        <strong>
          ◎
        </strong>

        <span>
          External
        </span>

      </div>

    </div>

  );
}


/* =========================================================
   DESTINATIONS
========================================================= */

function Destinations({
  data,
}) {

  return (

    <div className="destinations">

      {data.destinations.map(
        (destination, index) => (

          <div
            className="destination"
            key={index}
          >

            <span className="domain">
              ◉ {destination[0]}
            </span>

            <span>
              {destination[1]}
            </span>

            <span>
              {destination[2]}
            </span>

            <span>
              {destination[4]} req
            </span>

            <b
              className={
                destination[3] ===
                "High"
                  ? "high"
                  : destination[3] ===
                    "Medium"
                  ? "medium"
                  : "low"
              }
            >
              {destination[3]}
            </b>

          </div>

        )
      )}

    </div>

  );
}


/* =========================================================
   PAGE TITLE
========================================================= */

function PageTitle({
  eyebrow,
  title,
  sub,
}) {

  return (

    <section className="pageTitle">

      <div className="eyebrow">
        {eyebrow}
      </div>

      <h1>
        {title}
      </h1>

      <p>
        {sub}
      </p>

    </section>

  );
}


/* =========================================================
   LIVEGUARD
========================================================= */

function LiveGuardPage({
  liveGuard,
  setLiveGuard,
  data,
}) {

  return (

    <>

      <PageTitle
        eyebrow="CONTINUOUS MONITORING"
        title="SITEDitto LiveGuard"
        sub="Continuously observe security-relevant browser activity during the website session."
      />


      <div className="guardHero card">

        <div className="guardIcon">
          ◉
        </div>


        <div>

          <h2>
            LiveGuard is{" "}
            {liveGuard
              ? "active"
              : "paused"}
          </h2>

          <p>
            {liveGuard
              ? "SITEDitto is ready to update the risk picture as new events appear."
              : "Monitoring is currently paused."}
          </p>

        </div>


        <button
          className="primary"
          onClick={() =>
            setLiveGuard(
              (value) => !value
            )
          }
        >

          {liveGuard
            ? "Pause Monitoring"
            : "Enable LiveGuard"}

        </button>

      </div>


      <div className="twoGrid">

        <div className="card stat">

          <span>
            CURRENT TRUST SCORE
          </span>

          <b>
            {data.score}
          </b>

          <Verdict
            verdict={data.verdict}
          />

        </div>


        <div className="card">

          <div className="cardHead">

            <h2>
              Monitoring Scope
            </h2>

          </div>


          <ul className="scope">

            <li>
              Navigation and redirects
            </li>

            <li>
              Relevant network requests
            </li>

            <li>
              Login/password forms
            </li>

            <li>
              Downloads
            </li>

            <li>
              Browser storage signals
            </li>

          </ul>

        </div>

      </div>

    </>
  );
}


/* =========================================================
   NETWORK PAGE
========================================================= */

function NetworkPage({
  data,
}) {

  return (

    <>

      <PageTitle
        eyebrow="NETWORK INTELLIGENCE"
        title="Where is the website connecting?"
        sub="Understand the external destinations observed during the isolated session."
      />


      <div className="card">

        <NetworkFlow />

        <Destinations
          data={data}
        />

      </div>


      <div className="threeGrid">

        <Stat
          title="External Domains"
          value={
            data.destinations
              .length
          }
        />

        <Stat
          title="Risky Destinations"
          value={
            data.destinations.filter(
              (item) =>
                item[3] ===
                "High"
            ).length
          }
        />

        <Stat
          title="Network Score"
          value={
            data.network
          }
        />

      </div>

    </>
  );
}


/* =========================================================
   PRIVACY PAGE
========================================================= */

function PrivacyPage({
  data,
}) {

  return (

    <>

      <PageTitle
        eyebrow="PRIVACY & TRACKING"
        title="Privacy exposure"
        sub="Review trackers, external services and privacy-related signals observed during analysis."
      />


      <div className="threeGrid">

        <Stat
          title="Privacy Score"
          value={
            data.privacy
          }
        />

        <Stat
          title="External Services"
          value={
            data.destinations
              .length
          }
        />

        <Stat
          title="Tracker Signals"
          value={
            data.score > 80
              ? 1
              : data.score > 40
              ? 4
              : 6
          }
        />

      </div>


      <div className="card">

        <div className="cardHead">

          <h2>
            Privacy Findings
          </h2>

        </div>


        <div className="findingGrid">

          {data.findings.map(
            (finding, index) => (

              <div
                className="finding"
                key={index}
              >

                <span>
                  ◌
                </span>

                <p>
                  {finding}
                </p>

              </div>

            )
          )}

        </div>

      </div>

    </>
  );
}


/* =========================================================
   CREDENTIAL PAGE
========================================================= */

function CredentialPage({
  data,
}) {

  return (

    <>

      <PageTitle
        eyebrow="CREDENTIAL SAFETY"
        title="Should I enter my password?"
        sub="Credential guidance based on domain, HTTPS, login-form and phishing signals."
      />


      <div className="credentialHero card">

        <div className="bigShield">
          🔑
        </div>


        <div>

          <div className="cardLabel">
            CREDENTIAL SAFETY SCORE
          </div>


          <div className="bigMini">

            {data.credential}

            <small>
              /100
            </small>

          </div>

        </div>


        <Verdict
          verdict={data.verdict}
        />

      </div>


      <div className="card">

        <div className="cardHead">

          <h2>
            Recommendation
          </h2>

        </div>


        <div className="recommend">

          <div>
            ✓ Credential guidance
          </div>

          <p>
            Verify the exact domain
            and HTTPS before
            submitting credentials.
            SITEDitto does not read
            or extract saved browser
            passwords.
          </p>

        </div>

      </div>

    </>
  );
}


/* =========================================================
   HISTORY
========================================================= */

function HistoryPage({
  history,
  setUrl,
  setScenario,
  setPage,
}) {

  function openHistory(item) {

    setUrl(item.url);

    if (item.score >= 80) {
      setScenario("safe");
    }

    else if (item.score >= 40) {
      setScenario("caution");
    }

    else {
      setScenario("danger");
    }

    setPage("Dashboard");
  }


  return (

    <>

      <PageTitle
        eyebrow="SCAN HISTORY"
        title="Previous website analyses"
        sub="Review previous SITEDitto scans."
      />


      <div className="card history">

        {history.map(
          (item, index) => (

            <button
              key={index}
              onClick={() =>
                openHistory(item)
              }
            >

              <div className="historyIcon">
                ◉
              </div>


              <div>

                <b>
                  {item.url}
                </b>

                <small>
                  {item.time}
                </small>

              </div>


              <strong
                className={
                  item.score < 40
                    ? "dangerText"
                    : item.score < 80
                    ? "warnText"
                    : "safeText"
                }
              >
                {item.score}/100
              </strong>


              <span>
                {item.verdict}
              </span>


              <span>
                →
              </span>

            </button>

          )
        )}

      </div>

    </>
  );
}


/* =========================================================
   REPORT
========================================================= */

function ReportPage({
  data,
  url,
}) {

  return (

    <>

      <PageTitle
        eyebrow="SECURITY REPORT"
        title="SITEDitto analysis report"
        sub="A concise summary of the current website assessment."
      />


      <div className="report card">

        <div className="reportTop">

          <div>

            <div className="eyebrow">
              TARGET
            </div>

            <h2>
              {url}
            </h2>

          </div>


          <div className="reportScore">

            {data.score}

            <small>
              /100
            </small>

          </div>

        </div>


        <Verdict
          verdict={data.verdict}
        />


        <h3>
          Key Findings
        </h3>


        {data.findings.map(
          (finding, index) => (

            <div
              className="finding wide"
              key={index}
            >

              <span>
                ⚠
              </span>

              <p>
                {finding}
              </p>

            </div>

          )
        )}


        <h3>
          Score Breakdown
        </h3>


        <div className="riskGrid">

          <Risk
            label="Security"
            value={data.security}
          />

          <Risk
            label="Privacy"
            value={data.privacy}
          />

          <Risk
            label="Phishing"
            value={data.phishing}
          />

          <Risk
            label="Network Safety"
            value={data.network}
          />

          <Risk
            label="Credential Safety"
            value={data.credential}
          />

          <Risk
            label="Download Safety"
            value={data.download}
          />

        </div>

      </div>

    </>
  );
}


/* =========================================================
   SETTINGS
========================================================= */

function SettingsPage({
  liveGuard,
  setLiveGuard,
}) {

  return (

    <>

      <PageTitle
        eyebrow="SYSTEM SETTINGS"
        title="SITEDitto Settings"
        sub="Frontend controls for the Review 1 prototype."
      />


      <div className="card settings">

        <Setting
          title="LiveGuard"
          description="Continuously display monitoring status."
          value={liveGuard}
          onClick={() =>
            setLiveGuard(
              (value) => !value
            )
          }
        />


        <Setting
          title="Isolated Mode"
          description="Temporary browser environment for website analysis."
          value={true}
          disabled
        />


        <Setting
          title="Demo Mode"
          description="Use controlled scenarios for the frontend review."
          value={true}
          disabled
        />

      </div>

    </>
  );
}


/* =========================================================
   SETTING
========================================================= */

function Setting({
  title,
  description,
  value,
  onClick,
  disabled,
}) {

  return (

    <div className="setting">

      <div>

        <b>
          {title}
        </b>

        <p>
          {description}
        </p>

      </div>


      <button
        className={`toggle ${
          value ? "on" : ""
        }`}
        onClick={onClick}
        disabled={disabled}
      >

        <span />

      </button>

    </div>

  );
}


/* =========================================================
   STAT
========================================================= */

function Stat({
  title,
  value,
}) {

  return (

    <div className="card stat">

      <span>
        {title}
      </span>

      <b>
        {value}
      </b>

      <small>
        Current session
      </small>

    </div>

  );
}