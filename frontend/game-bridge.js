/* frontend/game-bridge.js
 *
 * The glue between the Unity WebGL build and the Socket.IO game server
 * (backend/server.js). Load this on whatever page hosts the Unity canvas,
 * BEFORE createUnityInstance(). Then:
 *
 *   MTOWBridge.connect();               // open the socket (safe to call early)
 *   ...createUnityInstance(...).then(MTOWBridge.attach);
 *
 * WHO IS PLAYING
 *   Unity asks this page who the player is (window.getPlayerInfo, below). The
 *   host page sets it before the game boots:
 *
 *     window.MTOWPlayer = { playerId: "abc123", name: "Sam", classId: "SUN-3B", mode: "classic" };
 *
 *   For testing without a real page, it falls back to URL params:
 *     ?name=Sam&class=SUN-3B&mode=classic&id=abc123   (name/class/mode all optional)
 *
 * LEAVING THE GAME
 *   When the player taps "Main Menu" on the game-over screen Unity calls
 *   window.mtowExitToMenu() if the host page defines it (that is where the
 *   website navigates back to its menu). If it doesn't, the page just reloads,
 *   which queues the player for a fresh match.
 *
 * Direction of travel
 *   Unity -> JS : GameBridge.jslib calls window.findMatch / cancelMatch /
 *                 submitAnswer / exitToMenu / getPlayerInfo.
 *   JS -> Unity : socket events are forwarded (already JSON strings from the
 *                 server) to the "MultiplayerManager" GameObject via
 *                 unityInstance.SendMessage(name, method, jsonString).
 *
 * Server contract (backend/server.js):
 *   emit  find_match    {playerId?, name, classId, mode}      (JSON string)
 *   emit  cancel_match
 *   emit  submit_answer {roomId, submittedAnswer, responseTime} (JSON string)
 *   on    match_found | game_state_update | game_over | player_left  -> JSON string
 *   on    queue_joined | queue_left                                   -> JSON string
 *   on    error_msg                                                   -> raw string
 *   (create_room / join_room / start_game still exist server-side, unused.)
 */
(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  var SERVER = params.get("server") || (location.hostname ? "http://" + location.hostname + ":3000" : "http://localhost:3000");

  var socket = null;
  var connecting = null;      // promise while the socket is being set up
  var unityInstance = null;
  var toUnityQueue = [];      // SendMessage calls made before Unity is attached
  var toServerQueue = [];     // emits made before the socket is connected

  function toUnity(method, payload) {
    var arg = typeof payload === "string" ? payload : JSON.stringify(payload);
    if (unityInstance) {
      unityInstance.SendMessage("MultiplayerManager", method, arg);
    } else {
      toUnityQueue.push([method, arg]);
    }
  }

  // Unity boots and calls findMatch in its first frames - usually before the
  // socket has finished connecting. Hold the emit and flush it on connect
  // instead of dropping it (a dropped find_match leaves the kid on "Waiting"
  // forever).
  function toServer(event, payload) {
    if (socket && socket.connected) {
      socket.emit(event, payload);
    } else {
      toServerQueue.push([event, payload]);
    }
  }

  function flushToServer() {
    while (toServerQueue.length && socket && socket.connected) {
      var m = toServerQueue.shift();
      socket.emit(m[0], m[1]);
    }
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("failed to load " + src)); };
      document.head.appendChild(s);
    });
  }

  function wireSocket() {
    socket.on("connect", function () {
      console.log("[bridge] socket connected:", socket.id);
      flushToServer();
    });
    socket.on("disconnect", function (r) { console.warn("[bridge] socket disconnected:", r); });
    socket.on("connect_error", function (e) {
      console.error("[bridge] connect_error:", e && e.message);
      toUnity("OnError", "Could not reach the game server (" + SERVER + ").");
    });

    socket.on("match_found",       function (d) { toUnity("OnMatchFound", d); });
    socket.on("queue_joined",      function (d) { toUnity("OnQueueJoined", d); });
    socket.on("game_state_update", function (d) { toUnity("OnGameStateUpdate", d); });
    socket.on("game_over",         function (d) { toUnity("OnGameOver", d); });
    socket.on("player_left",       function (d) { toUnity("OnPlayerLeft", d); });
    socket.on("error_msg",         function (m) { toUnity("OnError", typeof m === "string" ? m : JSON.stringify(m)); });

    // Older room-code flow (not used by the current game, kept working).
    socket.on("room_created",      function (d) { toUnity("OnRoomCreated", d); });
    socket.on("player_joined",     function (d) { toUnity("OnPlayerJoined", d); });
    socket.on("game_started",      function (d) { toUnity("OnGameStarted", d); });
  }

  // ---- who is playing ----

  var fallbackPlayer = null;
  function playerFromUrl() {
    if (!fallbackPlayer) {
      fallbackPlayer = {
        playerId: params.get("id") || undefined,
        name: params.get("name") || ("Player" + Math.floor(1000 + Math.random() * 9000)),
        classId: params.get("class") || "PUBLIC",
        mode: params.get("mode") || "classic"
      };
    }
    return fallbackPlayer;
  }

  // Called by GameBridge.jslib (GetPlayerInfoJSON).
  window.getPlayerInfo = function () {
    return JSON.stringify(window.MTOWPlayer || playerFromUrl());
  };

  // ---- Unity -> JS (called from GameBridge.jslib) ----

  window.findMatch = function (playerJson) {
    // Unity sends the identity it got from getPlayerInfo; pass it straight through.
    toServer("find_match", typeof playerJson === "string" ? playerJson : JSON.stringify(playerJson));
  };

  window.cancelMatch = function () {
    toServer("cancel_match");
  };

  window.submitAnswer = function (roomId, answer, responseTime) {
    toServer("submit_answer", JSON.stringify({
      roomId: String(roomId || ""),
      submittedAnswer: Number(answer),
      responseTime: Number(responseTime) || 1000
    }));
  };

  window.exitToMenu = function () {
    if (typeof window.mtowExitToMenu === "function") {
      window.mtowExitToMenu();
    } else {
      location.reload();
    }
  };

  // Older room-code flow (not used by the current game).
  window.createRoom = function (playerName, difficulty) {
    toServer("create_room", JSON.stringify({ playerName: String(playerName || "Host"), difficulty: Number(difficulty) || 1 }));
  };
  window.joinRoom = function (roomId, playerName) {
    toServer("join_room", JSON.stringify({ roomId: String(roomId || "").toUpperCase(), playerName: String(playerName || "Guest") }));
  };
  window.startGame = function (roomId) {
    toServer("start_game", String(roomId || ""));
  };

  // Legacy single-player path - unused, kept so the jslib still links.
  window.submitAnswerLegacy = function (json) { console.log("[bridge] legacy submitAnswer (ignored):", json); };

  // ---- public API for the host page ----

  window.MTOWBridge = {
    serverUrl: SERVER,

    attach: function (instance) {
      unityInstance = instance;
      window.unityInstance = instance;
      while (toUnityQueue.length) {
        var m = toUnityQueue.shift();
        instance.SendMessage("MultiplayerManager", m[0], m[1]);
      }
    },

    // Idempotent. Call as early as possible (before Unity finishes booting).
    connect: function () {
      if (socket) return Promise.resolve(socket);
      if (connecting) return connecting;
      connecting = loadScript(SERVER + "/socket.io/socket.io.js").then(function () {
        socket = io(SERVER, { transports: ["websocket", "polling"] });
        wireSocket();
        return socket;
      });
      return connecting;
    },

    get socket() { return socket; }
  };
})();
