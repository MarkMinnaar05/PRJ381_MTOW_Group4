# Changes against the latest supplied ZIP

Source: `PRJ381_MTOW_Group4-dev (2).zip`, reviewed 26 October 2026. This patch is based on that upload, not the older MongoDB update package. It has not been pushed or merged to GitHub.

## Files to copy or review

All paths start at the outer repository root containing `backend` and `frontend`.

| File | Status | Change |
|---|---|---|
| `README.md` | Edited | Correct Node requirement, private configuration, sign-in, class identity and website URLs. Links the team setup guide. |
| `backend/.env.example` | Edited | Explains local-versus-Atlas URI and documents the optional evidence-based IPv4 setting. No credentials included. |
| `backend/package.json` | Edited | Adds `npm.cmd run diagnose`. Direct dependency ranges are unchanged. |
| `backend/package-lock.json` | Edited | Updates only `body-parser` from 1.20.8 to the patched 1.20.9, addressing GHSA-27r3-jxmh-p828. |
| `backend/server.js` | Edited | Reports the startup stage and masked detailed error; recognises occupied ports and cleans up a failed startup. |
| `backend/src/config/database.js` | Edited | Uses shared, validated MongoDB connection options. |
| `backend/src/config/connectionDiagnostics.js` | Added | Masks connection strings/passwords, extracts nested driver errors and validates optional IP-family configuration. |
| `backend/scripts/diagnose-connection.js` | Added | Read-only DNS/TCP/TLS/driver diagnostic with an IPv4 comparison after failure. |
| `frontend/api-client.js` | Edited | Uses the website origin by default, explains fetch/non-API responses and handles expired sessions without silently creating PUBLIC guests. |
| `frontend/pages/Leaderboard.js` | Edited | Retains the new competition design; requires current identity, shows class, retry and sign-in status, and clears expired protected results. |
| `frontend/pages/TeacherDashboard.js` | Edited | Uses current identity and shows a direct re-login link when a token expires. |
| `backend/tests/team-access.integration.test.js` | Added | Tests class/PvP/XP/dashboard persistence, expired identity, origin, diagnostic redaction and occupied-port reporting. |
| `backend/tests/mongodb.integration.test.js` | Edited | Omits the Unix-only `--nounixsocket` test-server flag on Windows, as does the new team integration test. |
| `docs/TEAM-DATABASE-SETUP.md` | Added | Windows/VS Code setup, teammate credentials and class requirements, exact page URLs, Wi-Fi diagnostics and Git workflow. |
| `docs/TEAM-CONNECTION-CHANGES.md` | Added | This change register and validation record. |

The full project archive preserves the uploaded source, including the older nested folder. The patch archive contains only these 15 files. Copy its **contents** into the outer repository root, merge folders, and replace the listed files only. It does not include or overwrite `backend/.env`, `node_modules`, a Unity build or private data. Review any subsequent GitHub changes to the same files before copying.

## Validation completed

- Before edits: all **22** tests in the uploaded active backend passed.
- After edits: **24 tests passed, 0 failed**, using Node.js 24.22.1, locked MongoDB Node driver 7.7.0 and a disposable real MongoDB 8.2.6 instance.
- New integration coverage: same-class visibility and isolation; completed practice XP with zero PvP wins; an actual two-client Socket.IO PvP answer/forfeit yielding saved win/loss and recent-battle records; dashboard and leaderboard results after backend restart; expired tokens never silently creating PUBLIC users; correct custom-port API origin; clear network and wrong-server errors; safe diagnostic output; occupied-port startup reporting.
- Separate DOM checks executed the actual served HTML and JavaScript against the real temporary API/database: practice submit/finish; learner XP; teacher class activity; new leaderboard/class label; network failure/retry; expiry/sign-in; report download; sample exclusion and signed-out state. These checks used jsdom, not a full interactive browser or Unity runtime, and are separate from the 24 tests.
- `git diff --check` and changed-script syntax checks passed.
- The first Windows test run reported 22 passed and 2 failed: both temporary MongoDB processes exited with code 2 before the integration checks. Both test files passed the Unix-only `--nounixsocket` flag. The follow-up conditionally omits that flag on Windows and retains it on Unix. After this correction and the targeted dependency update, the Linux suite again passed 24/24 with no skips. The corrected Windows result must be confirmed on the user's computer. No test was skipped or removed.
- The observed high-severity npm notice was traced to `body-parser` 1.20.8 (GHSA-27r3-jxmh-p828). A targeted update to 1.20.9 changes only its version, download URL and integrity in the lockfile. The post-update npm audit reports 0 vulnerabilities as of 26 October 2026; that is not a full security audit.
- The next Windows run passed 23/24, including the original real-MongoDB integration test. The remaining failure was the new test's child-process timeout; its original message did not identify which child. The occupied-port check assumed that an IPv4 loopback server also occupied a child's default IPv6/wildcard port. The new follow-up reserves a dedicated port with the same default bind address as server.js, keeps the real EADDRINUSE assertions and includes the child filename/output in any timeout. Its Windows result remains pending; this is a test-harness correction, not a confirmed diagnosis of that timeout.
- Existing competition leaderboard service, its two tests, updated `MtowMatch.js` and `ApiGameSession.js`, and all other unlisted source files remain byte-for-byte unchanged from the uploaded ZIP. No nested source files were edited.

## Remaining checks on the team's equipment

The user's screenshots now show a successful diagnostic labelled Wi-Fi (DNS, all three TCP/TLS probes and the configured driver passed, MongoDB 8.0.34), application startup, a teacher class with 1 learner/3 questions/100% accuracy/1 session and a leaderboard with 30 XP. The user confirmed both pages retained the values after a backend restart. This verifies the reported application flow, but does not identify why the earlier Wi-Fi connection failed or independently establish the active network. TLS verification remains enabled.

There is no direct remote access to the user's network, teammates' computers or private Atlas account. The provided ZIP's Git archive marker and the user's fetched dev both identify commit `6516b1d0830ae7d7f45e3ab2d9eedbea93c6d7fe`. No changes have been pushed by this assistant. Complete the corrected Windows tests and a teammate setup check before merging the PR.

The ZIP contains no Unity WebGL build; socket PvP integration was tested, but no actual Unity build or hosted deployment was exercised.
