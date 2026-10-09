# Multiplayer playtest — how to run it

Kids don't type room codes. They press Play, land on the **VS screen** showing
"Waiting…", and the server pairs them with a classmate. Two pieces make it run:
the Socket.IO game server (`backend/`) and the Unity WebGL build
(`unity-client/MTOW/WebGLBuild/`, produced by `Tools ▸ MTOW ▸ Build WebGL (Playtest)`).

## 1. Start the server

Windows PowerShell has no `&&` — one command per line:

```powershell
cd "C:\Users\Minec\Documents\GitHub\PRJ381_MTOW_Group4\backend"
npm install      # first time only
npm start        # -> "Multiplayer Tug-of-War Server running on port 3000"
```

Ctrl+C stops it.

## 2. Serve the Unity build

```powershell
npx http-server "C:\Users\Minec\Documents\Unity Projects\MTOW\unity-client\MTOW\WebGLBuild" -p 8080 -c-1
```

## 3. Play

Open the game in **two browser windows**, telling each who is playing and which
class they're in (this is the identity the real website will supply):

- Window A: `http://localhost:8080/?name=Alice&class=SUN-3B`
- Window B: `http://localhost:8080/?name=Bob&class=SUN-3B`

Both land on the VS screen. As soon as the second one arrives the server pairs
them, the opponent's name appears, the crush animation plays and gameplay starts.

Things worth checking:

| Try this | Expect |
|---|---|
| A alone | stays on VS "Waiting…" indefinitely |
| A + B, same `class=` | matched, play a full game |
| A + C where C has `class=OTHER-1` | **not** matched (classes never mix) |
| Close a window mid-game | the other player wins ("opponent left") |
| Game over ▸ Play Again | back to VS, queues for a new match |
| Game over ▸ Main Menu | host page's `mtowExitToMenu()`; the test page just reloads |

URL params (all optional): `name`, `class`, `mode`, `id`, `server` (game-server URL
if it isn't the same host on port 3000).

## How the wiring fits together

```
Unity C#                     game-bridge.js                backend/server.js
--------                     -------------                 ----------------
MultiplayerManager  <--SendMessage--  socket.on(...)  <----  emit(...)
   |  WebGLBridge  --window.findMatch / submitAnswer / exitToMenu-->  emit(...)
                          window.getPlayerInfo()  <-- Unity asks who is playing
```

`game-bridge.js` is plumbing only. Matchmaking lives in
`backend/src/services/Matchmaker.js` (queue per class + mode, oldest waiter first).

## Server tests

```powershell
cd backend
npm test
```

Spawns the real server and drives it with real Socket.IO clients: pairing, class
isolation, cancel, same-account-twice, a scored round, opponent-disconnect.

## Known rough edges

- The server currently **trusts** the name / class the page sends. Once accounts
  exist, `find_match` should verify a login token and read the class from the
  student's record.
- `QuestionDTO.answer` is sent to the client — cheatable from the browser console.
  One-line fix in `GameSession.getSummary()`.
- The round timer is disabled in multiplayer; a match ends when the rope reaches ±1.
- The old room-code flow (`create_room` / `join_room` / `start_game` and
  `Lobby.unity`) still exists but is no longer part of the build.
