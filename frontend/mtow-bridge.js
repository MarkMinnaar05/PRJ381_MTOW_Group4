(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  var SERVER = params.get("server") || (location.hostname ? location.protocol + "//" + location.hostname + ":3000" : "http://localhost:3000");
  var RECEIVER = "MultiplayerManager";
  var CONNECT_TIMEOUT_MS = 4000;

  var socket = null;
  var unity = null;
  var toUnityQueue = [];
  var toServerQueue = [];

  function player() {
    if (window.MTOWPlayer) return window.MTOWPlayer;
    var id = params.get("id");
    if (!id) {
      try {
        id = localStorage.getItem("mtow.playerId");
        if (!id) {
          id = "guest-" + Math.random().toString(36).slice(2, 10);
          localStorage.setItem("mtow.playerId", id);
        }
      } catch (e) {
        id = "guest-" + Math.random().toString(36).slice(2, 10);
      }
    }
    return { playerId: id, name: params.get("name") || "Player", classId: params.get("class") || "PUBLIC", avatarId: "" };
  }

  function toUnity(method, payload) {
    var arg = typeof payload === "string" ? payload : JSON.stringify(payload);
    if (unity) unity.SendMessage(RECEIVER, method, arg);
    else toUnityQueue.push([method, arg]);
  }

  function emit(event, json) {
    var payload = {};
    try { payload = JSON.parse(json || "{}"); } catch (e) { console.warn("[mtow] bad JSON for " + event, json); }
    if (socket && socket.connected) socket.emit(event, payload);
    else toServerQueue.push([event, payload]);
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

  function wire() {
    socket.on("connect", function () {
      toUnity("ReceiveConnectionState", "connected");
      while (toServerQueue.length && socket.connected) {
        var m = toServerQueue.shift();
        socket.emit(m[0], m[1]);
      }
    });
    socket.on("disconnect", function () { toUnity("ReceiveConnectionState", "disconnected"); });
    socket.io.on("reconnect_attempt", function () { toUnity("ReceiveConnectionState", "reconnecting"); });
    socket.onAny(function (event, payload) {
      if (event.indexOf("Receive") === 0) toUnity(event, payload);
    });
  }

  window.MTOWBridge = {
    serverUrl: SERVER,

    
    connect: function () {
      return loadScript(SERVER + "/socket.io/socket.io.js").then(function () {
        socket = io(SERVER, { transports: ["websocket", "polling"], auth: player() });
        wire();
        return new Promise(function (resolve) {
          var timer = setTimeout(function () { resolve(false); }, CONNECT_TIMEOUT_MS);
          socket.once("connect", function () { clearTimeout(timer); resolve(true); });
        });
      }).catch(function (e) {
        console.warn("[mtow] game server unreachable, Unity will play offline:", e.message);
        return false;
      }).then(function (online) {
        if (online) window.mtowEmit = emit;
        else if (socket) socket.disconnect();
        return online;
      });
    },

    attach: function (instance) {
      unity = instance;
      window.unityInstance = instance;
      while (toUnityQueue.length) {
        var m = toUnityQueue.shift();
        instance.SendMessage(RECEIVER, m[0], m[1]);
      }
    },

    get socket() { return socket; }
  };

  window.mtowExit = function () {
    if (typeof window.mtowExitToMenu === "function") window.mtowExitToMenu();
    else location.reload();
  };
})();
