// ============================================================
// SITEDitto — Backend / Risk Engine Server
//
// Responsibilities:
//  - Receive observed signals/events from the extension.
//  - Run the deterministic risk engine.
//  - Maintain state PER CHROME TAB.
//  - Broadcast state to the React dashboard over WebSocket.
// ============================================================

import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import {
  computeScore,
  isQuarantineTier
} from "./riskEngine.js";


// ============================================================
// CONFIG
// ============================================================

const PORT =
  process.env.PORT || 8000;


// ============================================================
// EXPRESS
// ============================================================

const app =
  express();

app.use(cors());

app.use(
  express.json()
);


// ============================================================
// TAB STATES
//
// IMPORTANT:
//
// Old version:
//     let latestState = null;
//
// That meant every Chrome tab shared one state.
//
// New version:
//     tabStates
//
// Example:
//
//     "1692606233" -> Google state
//     "1692609999" -> YouTube state
//
// This allows the dashboard to request the exact
// website associated with the tab that opened it.
// ============================================================

const tabStates =
  new Map();


// ============================================================
// HTTP + WEBSOCKET SERVER
// ============================================================

const server =
  http.createServer(app);

const wss =
  new WebSocketServer({
    server,
    path: "/ws"
  });


// ============================================================
// BROADCAST
// ============================================================

function broadcast(payload) {

  const data =
    JSON.stringify(payload);


  wss.clients.forEach(
    (client) => {

      if (
        client.readyState ===
        client.OPEN
      ) {

        client.send(data);
      }

    }
  );
}


// ============================================================
// EXTENSION -> BACKEND
// POST WEBSITE STATE
// ============================================================

app.post(
  "/api/state",
  (req, res) => {

    const incoming =
      req.body || {};


    // ----------------------------------------------------------
    // TAB ID
    // ----------------------------------------------------------

    const tabId =
      incoming.tabId;


    if (
      tabId === undefined ||
      tabId === null ||
      tabId === ""
    ) {

      return res
        .status(400)
        .json({
          ok: false,
          error:
            "tabId is required"
        });
    }


    // ----------------------------------------------------------
    // COMPUTE AUTHORITATIVE SCORE
    // ----------------------------------------------------------

    const {
      score,
      verdict,
      evidence
    } =
      computeScore(
        incoming.signals
      );


    // ----------------------------------------------------------
    // CREATE STATE
    // ----------------------------------------------------------

    const state = {

      ...incoming,

      // Always preserve the Chrome tab ID.
      tabId: tabId,

      // Backend is authoritative.
      score: score,

      verdict: verdict,

      riskEvidence:
        evidence,

      quarantined:
        isQuarantineTier(
          score
        ),

      receivedAt:
        Date.now()
    };


    // ----------------------------------------------------------
    // SAVE BY TAB ID
    // ----------------------------------------------------------

    tabStates.set(
      String(tabId),
      state
    );


    console.log(
      "[SITEDitto backend] State updated:",
      {
        tabId,
        url: state.url,
        score: state.score,
        verdict: state.verdict
      }
    );


    // ----------------------------------------------------------
    // BROADCAST
    // ----------------------------------------------------------

    broadcast({
      type:
        "STATE_UPDATE",

      state:
        state
    });


    // ----------------------------------------------------------
    // RESPONSE
    // ----------------------------------------------------------

    return res.json({

      ok: true,

      score:
        score,

      verdict:
        verdict,

      tabId:
        tabId
    });
  }
);


// ============================================================
// DASHBOARD -> BACKEND
// GET STATE FOR SPECIFIC TAB
//
// Example:
//
// /api/state?tabId=1692606233
//
// Returns:
//
// {
//   tabId: 1692606233,
//   url: "https://www.google.com",
//   ...
// }
// ============================================================

app.get(
  "/api/state",
  (req, res) => {

    const tabId =
      req.query.tabId;


    if (
      tabId === undefined ||
      tabId === null ||
      tabId === ""
    ) {

      return res
        .status(400)
        .json({
          ok: false,
          error:
            "tabId is required"
        });
    }


    const state =
      tabStates.get(
        String(tabId)
      );


    return res.json(
      state || {}
    );
  }
);


// ============================================================
// HEALTH
// ============================================================

app.get(
  "/api/health",
  (req, res) => {

    res.json({
      ok: true
    });

  }
);


// ============================================================
// WEBSOCKET
// ============================================================

wss.on(
  "connection",
  (ws) => {

    console.log(
      "[SITEDitto backend] Dashboard connected."
    );


    // ----------------------------------------------------------
    // RECEIVE DASHBOARD SUBSCRIPTION
    // ----------------------------------------------------------

    ws.on(
      "message",
      (rawMessage) => {

        try {

          const message =
            JSON.parse(
              rawMessage.toString()
            );


          if (
            message &&
            message.type ===
              "SUBSCRIBE"
          ) {

            console.log(
              "[SITEDitto backend] Dashboard subscribed to tab:",
              message.tabId
            );


            // If the dashboard already told us which tab
            // it belongs to, immediately send that tab's state.
            if (
              message.tabId !==
                undefined &&
              message.tabId !==
                null
            ) {

              const state =
                tabStates.get(
                  String(
                    message.tabId
                  )
                );


              if (state) {

                ws.send(
                  JSON.stringify({
                    type:
                      "STATE_UPDATE",

                    state:
                      state
                  })
                );
              }
            }
          }

        } catch (error) {

          console.error(
            "[SITEDitto backend] Invalid WebSocket message:",
            error
          );
        }
      }
    );


    ws.on(
      "close",
      () => {

        console.log(
          "[SITEDitto backend] Dashboard disconnected."
        );

      }
    );

  }
);


// ============================================================
// START SERVER
// ============================================================

server.listen(
  PORT,
  () => {

    console.log(
      `SITEDitto backend listening on http://localhost:${PORT}`
    );

    console.log(
      `WebSocket endpoint: ws://localhost:${PORT}/ws`
    );

  }
);