# MongoDB and API integration

This update targets the PRJ381_MTOW_Group4-dev.zip supplied on 11 October 2026.
Production starts through backend/server.js. It connects to MongoDB before opening
its HTTP port. It does not fall back to in-memory or JSON-file storage when MongoDB
is unavailable. The old PlayerStore is retained solely for protocol compatibility tests.

## Data flow

Browser → REST API or authenticated Socket.IO → MongoDB.

| Collection | Contents |
|---|---|
| users | Teacher accounts and temporary learner identities |
| authTokens | Hashes of access tokens and expiry dates |
| players | Nicknames, avatars, cumulative XP, idempotent XP awards |
| gameSessions | REST practice sessions and their questions/answers |
| answerEvents | Learner answer records for analytics |
| sessionRecords | Per-learner game summaries |
| matches | Completed player match history |
| matchSnapshots | Socket game snapshots |
| legacyRooms | Snapshots of the older room-code flow |

## Routes

All paths below start with /api. Send Authorization: Bearer <token> except for
health, test, and auth/register, auth/login, auth/guest.

| Method | Path | Purpose |
|---|---|---|
| GET | /health | Pings the database |
| GET | /test | Checks route mounting |
| POST | /auth/register | Creates a teacher account and a class code |
| POST | /auth/login | Signs in a teacher |
| POST | /auth/guest | Creates a learner; optionally accepts an existing teacher's classCode |
| GET | /auth/me | Reads the authenticated identity |
| POST | /auth/logout | Revokes the current token |
| GET/PATCH | /players/me | Reads/updates your profile |
| GET | /players/me/stats | Reads your own game totals |
| GET | /players/me/history | Reads up to 50 completed matches |
| GET | /leaderboard | Reads the top 20 XP totals in your class |
| POST | /session/start | Starts a persistent practice session |
| GET | /session/status/:sessionId | Reads your own session |
| DELETE | /session/end/:sessionId | Ends and saves your own session |
| GET | /question/next/:sessionId | Reads the current unanswered question |
| GET | /question/batch/:sessionId?count=5 | Queues 1–20 questions |
| POST | /answer/submit | Grades sessionId + questionId + submittedAnswer |
| GET | /analytics/dashboard | Teacher-only, class-scoped dashboard |
| GET | /analytics/report?format=html | Teacher-only report |
| GET | /analytics/export.csv | Teacher-only CSV |
| GET | /analytics/status | Teacher-only MongoDB storage status |
| POST/DELETE | /analytics/sample | Adds/removes that teacher's sample records |

The other original analytics routes remain mounted (overview, operations,
difficulty, trend, response-times, players, top-performers, recent-activity,
insights, players/:playerName).

## Behaviour

- REST sessions use an atomic version check. Concurrent updates cannot score the
  same question twice. Repeated questionId submissions return the saved result.
- expectedAnswer is ignored. Correct answers come from the saved server question.
- REST questions hide the answer until grading.
- Embedded REST answers are authoritative. Analytics projections can be rebuilt
  when a session is read after an interrupted write.
- Both socket protocols keep their original event names. Connect with auth.token.
  The token determines playerId and classId, not browser-supplied identifiers.
- Socket profiles and history use MongoDB. Client saveMatchHistory cannot insert
  invented production scores. Server match completion writes history automatically.
- Socket game simulation remains in one Node process. Stored snapshots and history
  survive restart; an interrupted live multiplayer match cannot be resumed after
  restart in this version. REST practice session state can be read after restart.
- The existing analytics calculations operate on a fresh, class-scoped MongoDB
  snapshot. The temporary snapshot is for calculation, not permanent storage.
- Practice XP is added to the profile when the round ends. Finishing twice cannot
  double-award XP. A round left unfinished has its session saved but no final award.
- Learners currently use seven-day browser tokens, matching the class-code-only
  interface. Signing out, clearing browser storage, using another browser, or token
  expiry creates a new learner identity on the next class join. A permanent learner
  password/account-recovery flow is not included. Teacher accounts can log in again.
- Learners with identical display names are stored under distinct player IDs;
  the original analytics presentation groups by display name. Use distinct display
  names in a class until the analytics presentation is migrated to IDs.
- Teacher class management is one class per teacher in this update. The original
  placeholder grade/achievement/class-tab features are not implemented database features.
- JSON player data from older versions is not migrated automatically.

The supplied ZIP has no Unity WebGL build. Play opens the REST practice game;
updated Unity bridges are ready for your team's separate game-host page. Load
/frontend/api-client.js before either bridge. Load one bridge, not both.

## Run and test

Inside backend:

```powershell
npm.cmd install --ignore-scripts
Copy-Item .env.example .env
# Edit .env with your actual MongoDB URI before starting.
npm.cmd start
```

If .env already exists, keep it and edit it rather than running Copy-Item again.

Open http://localhost:3000/frontend/index.html and /api/health.
Tests: npm.cmd test. The real MongoDB integration test uses a disposable local
MongoDB instance, never your Atlas credentials. It downloads a MongoDB binary on
its first run; this requires internet access and may take several minutes.

## Configuration

Keep .env on your computer. Commit .env.example and package-lock.json.
Use Node.js 22 or 24 with the supplied MongoDB 7.x driver. No Node uninstall is
required for the Node 24 installation shown earlier. TLS validation stays enabled.
Atlas must still permit your current public IP and your network must reach it.
Use a database user (not your Atlas website login) with readWrite permission on mtow.

Primary references:
- https://www.mongodb.com/docs/drivers/node/current/connect/mongoclient/
- https://www.mongodb.com/docs/drivers/node/current/reference/upgrade/
- https://www.mongodb.com/docs/atlas/troubleshoot-connection/
