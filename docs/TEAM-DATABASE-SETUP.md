# Team setup: MongoDB, dashboard and leaderboard

Updated 26 October 2026 for the supplied `PRJ381_MTOW_Group4-dev (2).zip`.

## 1. Use the correct project and branch

The active repository root contains `README.md`, `backend`, `frontend` and `docs` directly inside it. The uploaded ZIP also contains an older nested `PRJ381_MTOW_Group4-dev` folder. Do not open or run that nested backend. It was left unchanged to preserve the uploaded source.

For an existing Git clone, save/commit your current work first. With a clean working tree, run from its root:

```powershell
git status
git switch dev
git pull origin dev
git switch -c feature/team-database-access
```

If that branch already exists, switch to it instead of creating it again. Apply the patch at this root, review the diff, and submit a PR into **dev**. Mark controls main. A downloaded ZIP has no Git history; use the real clone for the PR. No live GitHub state was checked by this ZIP review.

## 2. Open the current code in VS Code

1. In File Explorer, right-click the downloaded ZIP and choose **Extract All**. Do not edit files while still inside the ZIP.
2. Open VS Code, choose **File > Open Folder**, and select the folder with `backend`, `frontend` and this `README.md` directly inside it.
3. Choose **Select Folder**. Trust the folder if this is your own team's code.
4. In Explorer, verify the outer backend contains `src/database` and `src/config/database.js`. The older nested backend does not have these MongoDB adapters.
5. Right-click the outer **backend** folder and choose **Open in Integrated Terminal**. Its prompt should end in `\backend>`.
6. To open a specific file, press **Ctrl+P**, type a repository-relative path such as `backend/.env.example`, and press Enter.

If you already have a Git clone, open that clone's root and copy only the patch files into it. Do not put the entire extracted project inside an existing project folder.

## 3. What the database owner must give each teammate

Browser pages call the backend API. Only the backend talks to MongoDB. The MongoDB URI must never go in frontend JavaScript, HTML, a screenshot or a Git commit.

For teammates running their own local backend, provide:

| Item | How to provide it |
|---|---|
| Current code | Same reviewed branch/commit containing the API, dashboard and new competition leaderboard. |
| Atlas cluster connection URI | A private credential channel. Prefer a separate database user per developer, with `readWrite` on `mtow`. A database user is separate from an Atlas website account and from an application teacher login. |
| Database name | `mtow`, with the same spelling on every backend. |
| Network access | The Atlas project owner/network access manager must allow each developer's current public IP. Switching networks may change it. |
| Teacher/class context | A designated demo teacher account (shared only if appropriate for that account) and its class code; learners join that exact class. Each new teacher registration creates a different class. |

Alternatively host one shared backend and give teammates its **website URL** plus application sign-ins/class code. In that arrangement only the backend host needs MongoDB credentials and Atlas network access; teammates' browsers do not connect to port 27017. This ZIP does not deploy a shared backend or include a hosting account.

Never give someone your personal Atlas website password just to run the application.

## 4. Configure each local backend

Install Node.js 22 or later (a supported LTS release). In the **backend** terminal:

```powershell
node --version
npm.cmd ci
```

If `backend/.env` does not exist, make it:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Do not overwrite an existing working `.env`. Press Ctrl+P, open `backend/.env`, and set:

```dotenv
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
MONGODB_URI=PASTE_THE_PRIVATE_ATLAS_CONNECTION_STRING_HERE
MONGODB_DB_NAME=mtow
SESSION_TIMEOUT=3600
```

The `MONGODB_URI` line above is a placeholder, not a usable URI. Replace its entire value with Atlas's connection string using that developer's database username and password. Keep the actual cluster hostname; do not rename `cluster0...mongodb.net` to `mtow`. Percent-encode reserved password characters when inserting them into a URI. The database name is selected separately by `MONGODB_DB_NAME`.

In Atlas, open the correct project and its Database & Network Access / Network Access IP list. Add the developer's current public IP, save, and wait for **Active**. Do this while the computer is on the network it will use to run the backend. Do not change your router's inbound port forwarding.

Then run:

```powershell
npm.cmd start
```

Leave that terminal running. Open:

```text
http://localhost:3000/api/health
```

Expected:

```json
{"success":true,"database":"connected","databaseName":"mtow"}
```

This checks that backend's configured database. It does not prove every teammate selected the same cluster; compare cluster hostname privately and database name if the records differ.

Use the website at `http://localhost:3000/frontend/index.html`. Do not double-click HTML files or use Live Server for this setup. The default is now the same website/API origin; an intentionally separate frontend host may set `window.MTOW_API_BASE` to the backend URL before loading `api-client.js`, and the backend's `FRONTEND_URL` must allow that origin. Keep secrets on the backend.

## 5. Make both pages show the same class

### Teacher window

1. Open `http://localhost:3000/frontend/pages/Auth.html`.
2. Use **Teacher > Log in** for the existing demo teacher. Register once only if creating a new demo class.
3. Open `http://localhost:3000/frontend/pages/TeacherDashboard.html`.
4. Copy the class code shown by that account. Its data belongs to that class only.

### Learner window

1. Use a separate browser profile or a private window. A second ordinary tab shares the teacher's token and is not a second identity.
2. Open the same sign-in URL. Select **Student**.
3. Enter a display name and the teacher's exact class code. Join.
4. Open `http://localhost:3000/frontend/practice.html`.
5. Click **Start a round**, answer several questions, then click **Finish and save** (or let the round finish naturally).
6. Open **My progress** to see saved XP. Keep this learner window signed in; signing out, clearing storage or expiry can require a new guest identity. Same display name does not restore the old learner ID.

### Check the two pages

1. In the teacher window click **Refresh analytics**. Its learner table, questions, accuracy and sessions should reflect the learner's activity.
2. Open the leaderboard in the signed-in teacher or learner window:
   `http://localhost:3000/frontend/pages/Leaderboard.html`.
3. Confirm its class label matches the teacher code. The learner's total XP appears after a completed practice round.
4. The new competition leaderboard counts wins/losses/draws/accuracy and recent battles from **completed PvP matches**. REST practice and CPU games do not become PvP victories. Zero PvP wins alongside saved XP is valid.
5. After an actual Unity PvP game, wait for the server's completion event before checking rankings. This ZIP has no Unity build, so this guide's browser flow uses practice; automated tests separately exercise the socket PvP protocol.
6. Stop the backend with Ctrl+C, run `npm.cmd start`, and refresh both pages. MongoDB records should remain.

Application sessions currently last seven days. The new client displays a sign-in prompt on expiry and does not silently move the user to PUBLIC. A signed-out leaderboard asks you to sign in. If an older copy already moved you to PUBLIC, sign in again with the teacher account or class code. A teacher who creates a new account sees an empty new class; that is not a connection fault.

## 6. Wi-Fi versus hotspot: get a precise result

The earlier tests showed the code connecting through the hotspot while normal Wi-Fi failed. DNS and TCP checks had passed in some Wi-Fi attempts, with a TLS alert from the full driver. That history does not identify the router, ISP or antivirus as the proven cause. A successful raw TCP or TLS probe alone is not a successful authenticated MongoDB connection.

Update from 26 October: the user supplied a diagnostic labelled Wi-Fi with all checks passing, then successfully loaded class analytics and 30 XP on the leaderboard and confirmed both survived a restart. That is evidence of a working connection on that run; the original network failure's cause remains unconfirmed.

The new diagnostic reads `.env`, probes DNS/TCP/certificate-verified TLS, and runs the actual MongoDB driver ping. It prints error details with the configured URI/password masked. It does not change Windows settings, disable certificates, read learner records, or insert test data. The ping also needs a free outgoing connection; it does not start the website or use port 3000.

1. Connect to **normal Wi-Fi**, keep the VPN off, and verify that network's current public IP is Active in Atlas.
2. Open a second integrated terminal in the outer backend folder (or stop the running server with Ctrl+C). Run:

```powershell
npm.cmd run diagnose -- --label=wifi
```

3. Send the output (not `.env`). If you want a local text file:

```powershell
npm.cmd run diagnose -- --label=wifi 2>&1 | Tee-Object -FilePath "$env:TEMP\mtow-wifi-diagnostic.txt"
```

4. Switch to **hotspot**, allow its current public IP in Atlas, and run:

```powershell
npm.cmd run diagnose -- --label=hotspot
```

### Interpret the comparison

| Result | Next step |
|---|---|
| Missing URI / invalid database name | Correct that local `.env`. |
| Authentication failure / code 18 | Check the Atlas **database user**, its password encoding and permissions. |
| System SRV fails but public DNS comparison passes | Investigate the Wi-Fi DNS resolver or use Atlas's standard non-SRV connection string. This does not diagnose TLS. |
| TCP/IPv4 fails on Wi-Fi but passes on hotspot | Ask the network administrator/ISP about outbound Atlas traffic on port 27017, after verifying the IP allow list. |
| TLS/IPv4 fails only on Wi-Fi | Investigate TLS interception/filtering or the network path. An access-list problem must also be ruled out. Keep certificate verification enabled. |
| Configured driver fails, IPv4-only driver passes | Add `MONGODB_FAMILY=4` to `.env`, save, restart, and verify `/api/health`. This option changes only this application's address-family choice. |
| Both driver attempts fail | Send both logs. Do not claim IPv4 or DNS fixed the issue. |
| Driver passes but dashboard fails | Check correct running backend, sign-in, class and frontend URL. Network-to-database access is working in this test. |

Do not disable Windows Firewall or use `tlsAllowInvalidCertificates`, `tlsInsecure`, `NODE_TLS_REJECT_UNAUTHORIZED=0` or an unrestricted Atlas IP entry as a fix. No such bypass is included.

A shared hosted backend can also let browsers use the normal Wi-Fi over HTTPS while the host maintains the Atlas connection. That avoids requiring every learner's Wi-Fi to reach MongoDB directly, but requires a real configured backend deployment; changing a frontend URL alone does not deploy one.

## 7. Other errors and checks

| Symptom | Meaning/action |
|---|---|
| `EADDRINUSE ... 3000` | Another app already listens on port 3000. Check its `/api/health` or stop the old backend terminal with Ctrl+C before starting another copy. |
| Need to identify port owner | `Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess`, then `Get-Process -Id THE_NUMBER`. Stop only the identified backend. |
| Sign in again / 401 | Application token expired/missing; use the sign-in page. Database credentials are separate. |
| Teacher access required / 403 | Learner identity used for teacher analytics. Use the teacher window. |
| Empty class with connected health | Check teacher account, learner class code, cluster and database name. |
| Live Server returns HTML/404 for API | Open the website through the backend on port 3000. |
| Failed fetch | Backend URL, server availability or browser CORS/HTTPS issue; see the address instructions. |
| Unity plays offline but no records appear | Offline play cannot record to this API. Load the supplied API client/bridge, sign in, and verify server connectivity in the game host. |

Local `localhost` always means the computer running that browser. It is not a shareable URL for teammates on other computers.

## 8. Tests and contribution files

Run from backend:

```powershell
npm.cmd test
```

Database integration tests start a disposable real MongoDB process, separate from Atlas and the `mtow` database. A first run may download the test binary; run before recording. The uploaded baseline has 22 tests and passed before this patch. Added tests cover the team class/leaderboard/persistence flow, expiry behaviour, backend-origin handling and diagnostic redaction. See the accompanying handoff guide for the exact final test result and browser checks.

### Windows test-server follow-up

The first Windows run reported 22 passed and 2 failed, with a temporary MongoDB process exiting with code 2. Both integration files included `--nounixsocket`, which applies only on Unix. The corrected configuration in **both** `backend/tests/mongodb.integration.test.js` and `backend/tests/team-access.integration.test.js` is:

```javascript
instance: {
    args: [
        ...(process.platform === 'win32' ? [] : ['--nounixsocket']),
        '--wiredTigerCacheSizeGB',
        '0.25'
    ]
}
```

If you already applied the original 13-file patch, apply **MTOW-Windows-Test-Fix.zip** on the same feature branch. Copy its `backend` and `docs` folders into the outer repository root, replacing the listed files. This follow-up contains the two test files, `backend/package-lock.json` and the two team documentation files. The current complete patch has 15 files total.

In the backend terminal run `npm.cmd ci`, then `npm.cmd test`. The lockfile also contains the targeted `body-parser` 1.20.9 security fix for the observed high-severity notice. No test is skipped and no Atlas settings need changing for this correction. The corrected Windows result must be checked on the user's computer.

### Follow-up for the 23-pass / 1-timeout result

The next Windows run passed the original database integration test but timed out in the new team's child-process checks. Apply **MTOW-Test-Process-Fix.zip** if you already applied the previous Windows patch: copy its `backend` and `docs` folders into the same repository root. In the backend terminal run `npm.cmd test` again; no dependency reinstall is needed for this test-only follow-up.

The occupied-port check now reserves a dedicated port with the same default listening address used by the child server, instead of assuming IPv4 loopback and default IPv6 listeners always conflict. A future timeout also identifies the child script and prints captured output. The timeout is still 20 seconds and the startup-error assertions remain. A further failure needs that exact output; the prior generic timeout alone did not establish which child hung.

If the same temporary-server failure remains, capture its startup output with:

```powershell
$env:DEBUG = 'MongoMS:MongoInstance'
npm.cmd run test:database
Remove-Item Env:DEBUG
```

This debug command is for the disposable integration-test MongoDB process. Send its detailed startup error; keep `.env` private.

The updated files are listed in `docs/TEAM-CONNECTION-CHANGES.md`. The existing competition leaderboard service, its two tests and its visual layout are retained. The old nested source copy and other teammates' game changes are retained.

## Primary references

- MongoDB Atlas connection troubleshooting: https://www.mongodb.com/docs/atlas/troubleshoot-connection/
- Atlas IP access list: https://www.mongodb.com/docs/atlas/security/ip-access-list/
- Node.js driver connection troubleshooting and IPv4 option: https://www.mongodb.com/docs/drivers/node/current/connect/connection-troubleshooting/
