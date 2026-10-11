# Analytics Storage Contract

## Purpose

This document defines the data required by the analytics system.

Member 6 defines the analytics requirements.

Member 4 is responsible for permanent database storage.

## Current Storage

The system currently uses `InMemoryAnalyticsStore.js`.

This temporary store allows the analytics system to work before the database is available.

The data resets when the server restarts.

## Answer Events

One answer event must be stored whenever a learner answers a question.

| Field | Description |
|---|---|
| `eventId` | Unique answer identifier |
| `sessionId` | Related game-session identifier |
| `playerName` | Learner display name |
| `questionId` | Question identifier |
| `questionText` | Question shown |
| `operation` | Mathematical operation |
| `operand1` | First number |
| `operand2` | Second number |
| `correctAnswer` | Correct answer |
| `submittedAnswer` | Learner's answer |
| `isCorrect` | Correct or incorrect result |
| `responseTimeMs` | Answer time in milliseconds |
| `difficulty` | Question difficulty |
| `questionNumber` | Position in the game |
| `scoreEarned` | Score earned |
| `streakAfter` | Streak after answering |
| `ropePositionAfter` | Rope position after answering |
| `answeredAt` | Date and time answered |
| `isSample` | Sample or real record |

## Session Records

One session record must be stored for every game.

| Field | Description |
|---|---|
| `sessionId` | Unique session identifier |
| `playerName` | Learner display name |
| `startedAt` | Game start date and time |
| `lastActivityAt` | Latest activity date and time |
| `endedAt` | Game end date and time |
| `status` | In progress, won, lost or ended |
| `playerWon` | Whether the learner won |
| `totalQuestions` | Questions answered |
| `correctAnswers` | Correct answers |
| `incorrectAnswers` | Incorrect answers |
| `accuracy` | Accuracy percentage |
| `score` | Game score |
| `xp` | Experience points |
| `level` | Learner level |
| `bestStreak` | Highest answer streak |
| `finalDifficulty` | Final difficulty level |
| `averageResponseTimeMs` | Average answer time |
| `ropePosition` | Final rope position |
| `durationSeconds` | Game duration |
| `endReason` | Reason the game ended |
| `isSample` | Sample or real record |

## Required Storage Methods

A future database store should provide equivalent methods for:

- `addAnswerEvent(event)`
- `upsertSessionRecord(record)`
- `getAnswerEvents(filters)`
- `getSessionRecords(filters)`
- `getSessionRecord(sessionId)`
- `clear({ sampleOnly })`
- `describe()`
- `counts()`

Database methods may be asynchronous. If they return promises, the analytics service and controller must use `await`.

## Filters

The storage layer should support:

- Include or exclude sample data
- Sample data only
- Learner name
- Start date
- End date

## Duplicate Protection

The database should prevent duplicate answer records.

A recommended unique combination is:

`sessionId + questionNumber`

## Sample Data

Sample records use `isSample: true`.

Real game records use `isSample: false`.

Removing sample data must not remove real data.

## Privacy

Learner analytics is private classroom information.

The final system should:

- Use learner display names where possible
- Restrict reports and exports to authorised users
- Avoid unnecessary personal information
- Follow POPIA requirements