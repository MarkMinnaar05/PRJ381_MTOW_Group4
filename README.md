# Math Tug-of-War (MTOW)

Interactive competitive mathematics learning platform — VIR-BCOM Group 4.

## Project Structure

```
mtow-platform/
  unity-client/   ← Unity project (game UI/interface)
  backend/        ← Node.js / Express server, database logic
  docs/           ← Project documentation, diagrams, reports
  README.md
```

## Getting Started

### Cloning the repo
```bash
git clone <repo-url>
cd mtow-platform
```

### Git LFS (required before pulling Unity assets)
This project uses Git LFS to handle large binary files (images, audio, etc.). Install it once per machine:
```bash
git lfs install
```

### Working on the Unity client
1. Open Unity Hub → Add Project → select the `unity-client/` folder.
2. Make sure your Unity version matches the one specified in `unity-client/ProjectVersion.txt` (avoids compatibility issues).
3. Do not commit the `Library/`, `Temp/`, or `obj/` folders — these are already covered by `.gitignore`.

### Working on the backend
1. `cd backend`
2. `npm install`
3. `npm run dev` to start the local server

## Branching Strategy

- **`main`** — stable, always working. Only merged into once tested.
- **`dev`** — integration branch. All finished feature work gets merged here first.
- **`feature/<short-description>`** — one branch per task, created off `dev`.

Example workflow:
```bash
git checkout dev
git pull
git checkout -b feature/ui-homescreen

# ... do your work, commit as you go ...

git push origin feature/ui-homescreen
# then open a Pull Request into dev on GitHub
```

Suggested feature branch names by role:
| Member | Branch example |
|---|---|
| Mark (UI) | `feature/ui-homescreen`, `feature/ui-gameplay` |
| Davidzo (Frontend Logic) | `feature/frontend-integration` |
| Jesse (Backend Logic) | `feature/backend-scoring`, `feature/multiplayer-logic` |
| Thabiso (API & DB) | `feature/api-endpoints`, `feature/database-schema` |
| Dominic (Gamification) | `feature/xp-system`, `feature/leaderboard` |
| Elaine (Analytics) | `feature/analytics-dashboard` |
| Keletso (Unit Testing) | `feature/unit-tests` |
| Gina (System Testing) | `feature/system-tests` |

## Commit Message Convention

Keep commits short and descriptive:
```
[UI] Add home screen buttons and layout
[Backend] Implement answer validation logic
[Fix] Correct rope position calculation bug
```

## Pull Requests

- Open a PR from your `feature/` branch into `dev`.
- Tag at least one teammate to review before merging.
- Do not merge directly into `main` — that only happens at milestone checkpoints once `dev` is tested and stable.

## Notes

- Mock/sample data should be used where a dependency (backend, analytics, etc.) isn't ready yet — see the sprint plan's "flexible rule" for each phase.
- Questions or blockers → raise in the team chat as early as possible so tasks don't stall.