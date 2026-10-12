# Math Tug-of-War (MTOW)

A competitive maths game for kids aged 6 to 9. Two players answer addition and subtraction questions, and every right answer pulls the rope their way. Students play against a classmate or the computer; teachers see how their class is doing.

VIR-BCOM Group 4 (PRJ381).

---

## ⚠️ The 3 rules (read these first)

1. **Never push to `main`.** Never open a pull request into `main`. Only Mark merges into `main`.
2. **Every piece of work gets its own branch**, made from `dev`, named `feature/<what-you-are-doing>`.
3. **Your work goes into `dev` through a pull request.** Before you click "Create pull request", check that the **base** says **`dev`**.

If you are unsure about anything, ask in the group chat **before** you push.

---

## Contents

1. [Team and branches](#1-team-and-branches)
2. [What is in this repo](#2-what-is-in-this-repo)
3. [First-time setup](#3-first-time-setup)
4. [Running the project](#4-running-the-project)
5. [How to do your work and submit it](#5-how-to-do-your-work-and-submit-it)
6. [Keeping your branch up to date](#6-keeping-your-branch-up-to-date)
7. [Commit messages](#7-commit-messages)
8. [What never goes into git](#8-what-never-goes-into-git)
9. [How the parts fit together](#9-how-the-parts-fit-together)
10. [Problems and fixes](#10-problems-and-fixes)

---

## 1. Team and branches

| Member | Role | Branch examples |
|---|---|---|
| Mark | Unity (the game) | `feature/unity-build` |
| Jesse | Backend | `feature/backend-matchmaking`, `feature/backend-scoring` |
| Davidzo | Frontend (website) | `feature/frontend-play-page`, `feature/frontend-auth` |
| Kudzai/Mahlatse | API & Database | `feature/api-endpoints`, `feature/database` |
| Dominic | Gamification | `feature/xp-system`, `feature/leaderboard` |
| Elaine | Dashboard | `feature/teacher-dashboard`, `feature/analytics` |
| Keletso | Unit Testing | `feature/unit-tests` |
| Gina | System Testing | `feature/system-tests` |

Branch names: lowercase, words joined with `-`, always starting with `feature/`. One branch per task; a new task gets a new branch.

**How the branches work:**

| Branch | What it is | Who puts work in it |
|---|---|---|
| `main` | The stable, working version we hand in. | **Only Mark**, after `dev` has been tested. |
| `dev` | Where everyone's finished work comes together. | Everyone, **only through pull requests**. |
| `feature/...` | Your own work in progress. | You. |

```
feature/your-task  ──PR──►  dev  ──(Mark, after testing)──►  main
```

---

## 2. What is in this repo

```
PRJ381_MTOW_Group4/
├── backend/                  The server (Node.js)
│   ├── server.js             Starts everything: game server, API and the game page
│   ├── src/mtow/             Game server: matchmaking, matches, questions, scoring, player data
│   ├── src/routes/           API routes (analytics, more to come)
│   ├── src/controllers/      What each API route does
│   ├── src/services/         Shared logic (matchmaking queue, analytics)
│   ├── test/  tests/         Automated tests (run with npm test)
│   ├── docs/                 Analytics documentation
│   ├── public/               The game build goes here (you add it; not in git)
│   └── data/                 Saved player data (created automatically; not in git)
├── frontend/                 The website
│   ├── index.html            Home page
│   ├── pages/                All other pages (Play, Dashboard, Leaderboard, ...)
│   ├── styles/main.css       Website styling
│   └── mtow-bridge.js        Connects the game to the server (don't change without asking Mark)
└── README.md                 This file
```

The **Unity project is not in this repo** because it is too big. Mark publishes ready-to-run builds of the game under **Releases** (right side of the repo's home page).

`frontend/game-bridge.js` and `frontend/MULTIPLAYER-TESTING.md` are from an old version of the game. Nothing uses them. Ignore them.

---

## 3. First-time setup

You only do this once per computer. The commands are for Windows.

### 3.1 Install the tools

| Tool | Download | Check it works (should print a version) |
|---|---|---|
| Node.js (LTS, version 18 or newer) | https://nodejs.org | `node -v` |
| Git | https://git-scm.com | `git --version` |

Then tell Git who you are (use the email of your GitHub account):

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

And turn on Git LFS (handles big files like images and audio):

```bash
git lfs install
```

### 3.2 Open a terminal in the right place

Go to the folder where you keep projects in File Explorer, **Shift + right-click** an empty area, and choose **Open PowerShell window here** (or **Open in Terminal**).

### 3.3 Download the code

```bash
git clone https://github.com/MarkMinnaar05/PRJ381_MTOW_Group4.git
cd PRJ381_MTOW_Group4
git checkout dev
```

GitHub may ask you to sign in, because the repo is private.

### 3.4 Install the server's packages

```bash
cd backend
npm install
```

### 3.5 Check everything works

```bash
npm test
```

It should end with `fail 0`. If anything fails, tell the group before changing code.

### 3.6 Add the game

1. Download the newest game zip from **Releases** (for example `MTOW-WebGL-2026-10-09.zip`).
2. In the `backend` folder, make a folder called `public`:
   ```bash
   mkdir public
   ```
3. Extract the zip into it (change the path to where your zip is):
   ```bash
   tar -xf C:\Users\YOUR-NAME\Downloads\MTOW-WebGL-2026-10-09.zip -C public
   ```
4. Check that `backend\public\index.html` exists. `index.html` must be directly inside `public`, not in another folder.

---

## 4. Running the project

From the `backend` folder:

```bash
npm start
```

You should see `Multiplayer Tug-of-War Server running on port 3000`. Leave this window open. **Ctrl + C** stops the server.

**To play**, open these in **two different browser windows**, then press **Play a friend** in both:

- http://localhost:3000/?name=Alice&class=TEST
- http://localhost:3000/?name=Bob&class=TEST

Both windows need the same `class=` to be matched. Change `name=` to anything. **Play the computer** works with just one window.

**Other useful addresses:**

| Address | What it is |
|---|---|
| http://localhost:3000/api/analytics/overview | Analytics API (see `backend/docs/analytics-api.md`) |

**When there is a new game build:** empty `backend\public` and extract the new zip into it. The server does not need a restart; just refresh the browser.

---

## 5. How to do your work and submit it

Follow these steps **every time** you start a new task.

### Step 1. Start from the newest `dev`

```bash
git checkout dev
git pull origin dev
```

### Step 2. Make your branch

```bash
git checkout -b feature/your-task-name
```

Check you are on it:

```bash
git branch
```

The branch with the `*` is the one you are on. **If it says `main` or `dev`, stop and redo step 2.**

### Step 3. Do your work, and save it in commits as you go

See what you changed:

```bash
git status
```

Add the files you changed and commit them:

```bash
git add .
git commit -m "[Backend] Add class leaderboard endpoint"
```

Before `git add .`, read the `git status` list. Only commit files you meant to change. If you see `node_modules`, `public`, `data` or `.env` files in the list, stop and ask.

Commit small and often. Run `npm test` in `backend` before you push.

### Step 4. Push your branch to GitHub

The first time for this branch:

```bash
git push -u origin feature/your-task-name
```

After that, just:

```bash
git push
```

### Step 5. Open a pull request into `dev`

1. Go to the repo on GitHub. A yellow bar says **"feature/your-task-name had recent pushes"**. Click **Compare & pull request**.
2. **At the top, check the two boxes: `base: dev` ← `compare: feature/your-task-name`.**
   **If base says `main`, click it and change it to `dev`.** This is the most important step.
3. Title: what you did, for example *Add class leaderboard endpoint*.
4. Description: what changed, how to test it, and anything unfinished.
5. On the right, under **Reviewers**, pick at least one teammate.
6. Click **Create pull request**.

### Step 6. After it is merged

The reviewer merges it into `dev`. Then:

```bash
git checkout dev
git pull origin dev
```

and start your next task from **Step 2** with a new branch name.

### Reviewing someone else's pull request

- Open it, go to **Files changed**, and read the changes.
- Pull their branch and run `npm test`. For website or game changes, try it in the browser.
- If it's good: **Review changes → Approve**, then **Merge pull request** (into `dev`).
- If something's wrong: **Review changes → Request changes**, and explain what.

---

## 6. Keeping your branch up to date

If `dev` changed while you were working (someone else's pull request got merged), bring those changes into your branch:

```bash
git checkout dev
git pull origin dev
git checkout feature/your-task-name
git merge dev
```

**If you get a merge conflict:** Git marks the clashing parts in the files with `<<<<<<<`, `=======` and `>>>>>>>`. Keep the right code, delete the markers, then:

```bash
git add .
git commit
```

**If you're not sure which code to keep, ask in the group chat. Never just delete someone else's code to make a conflict go away.**

---

## 7. Commit messages

Start with the area in square brackets, then say what you did:

```
[Backend] Add answer validation for subtraction
[Frontend] Embed the game on the Play page
[API] Add login endpoint for students
[DB] Create classes and students tables
[Dashboard] Show missed questions per student
[Tests] Add tests for the leaderboard
[Fix] Stop the timer going negative
```

---

## 8. What never goes into git

These are already in `.gitignore`, but check `git status` anyway:

| Never commit | Why |
|---|---|
| `node_modules/` | Packages; everyone gets them with `npm install`. |
| `backend/public/` | The game build; too big, and it comes from Releases. |
| `backend/data/` | Real player data. |
| `.env` files, passwords, API keys, database connection strings | Secrets. Anyone with access to the repo could see them. |
| Unity project files and builds | Too big; Mark handles these. |

Only `backend/package.json` and `backend/package-lock.json` **should** be committed. If you add a package with `npm install <name>`, commit those two files too.

---

## 9. How the parts fit together

```
 Website (frontend/)          Game (Unity, in backend/public)        Server (backend/)
 ───────────────────          ───────────────────────────────        ─────────────────
 Login, dashboards,   ──►     Mode select, VS screen, match,  ◄──►   Matchmaking, questions,
 Play page                    results, practice                       scoring, XP, history
                                    ▲                                 (src/mtow)
                                    │ frontend/mtow-bridge.js         Analytics API
                                    └──── Socket.IO ──────────────►   (/api/analytics)
```

- **The server runs every match.** It pairs classmates, sends both players the same questions, checks answers, moves the rope, and saves XP and match history. The game only shows things and sends the player's answers.
- **Matchmaking is automatic.** There are no room codes. Players are only matched with someone in the same class.
- **Who is playing** comes from the page: `window.MTOWPlayer = { playerId, name, classId, avatarId }`. For testing, the URL works too: `?name=...&class=...&id=...`.
- **Player data** is saved in `backend/data/players.json` by `backend/src/mtow/PlayerStore.js`. That file is the single place to swap in a real database.
- **The full list of messages** between the game and the server is at the top of `backend/src/mtow/registerMtow.js`.

**Still to build:**

| Owner | Task |
|---|---|
| Kudzai | Teacher accounts, classes, student logins, and a database to replace `PlayerStore` |
| Davidzo | Play page that loads the game and sets `window.MTOWPlayer` from the logged-in student |
| Elaine | Dashboard reading real match data instead of sample data |
| Dominic | Leaderboard and XP display |
| Keletso & Gina | Tests for all of the above |

---

## 10. Problems and fixes

| Problem | Fix |
|---|---|
| `'node' is not recognized` / `'git' is not recognized` | Install it (section 3.1), then **close and reopen** the terminal. |
| `Cannot find module 'express'` (or any module) | Run `npm install` inside the `backend` folder. |
| `EADDRINUSE: address already in use :::3000` | The server is already running in another window. Close that one first. |
| The game page is blank or shows "Cannot GET /" | The game isn't in `backend/public`, or it's in a subfolder. `backend/public/index.html` must exist. |
| The game says **Offline demo** | The server isn't running, or the page wasn't opened from http://localhost:3000. |
| Two windows don't get matched | Both need the same `class=` in the address, and both must press **Play a friend**. |
| `git push` says "rejected" | Run `git pull`, fix any conflicts (section 6), then push again. |
| I committed to `dev` or `main` by mistake | **Don't push.** Ask in the group chat and someone will help move it to a branch. |
| I pushed to the wrong branch | Tell Mark straight away. Don't try to fix it with force pushes. |
