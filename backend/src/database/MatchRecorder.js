class MatchRecorder {
    constructor(db) { this.db = db; this.pending = new Map(); }
    async flush() { await Promise.all([...this.pending.values()]); }
    record(match, answer) {
        // Capture now: queued writes must never read a later mutable game state.
        const now = new Date().toISOString();
        const state = { matchId: match.matchId, mode: match.mode, phase: match.phase, rope: match.rope,
            difficulty: match.difficulty, startedAt: match.startedAt, endedAt: match.isOver ? now : null,
            seats: structuredClone(match.seats), reason: match.reason, winnerSide: match.winnerSide };
        const events = answer ? [structuredClone(answer)] : [];
        const previous = this.pending.get(match.matchId) || Promise.resolve();
        const work = previous.then(async () => {
            await this.db.collection('matchSnapshots').replaceOne({ _id: match.matchId }, { ...state, _id: match.matchId }, { upsert: true });
            for (const seat of state.seats) {
                const sessionId = `${match.matchId}:${seat.playerId}`;
                const correct = seat.correctAnswers;
                const total = seat.totalQuestions;
                const won = state.winnerSide === seat.side;
                const record = { sessionId, matchId: match.matchId, playerId: seat.playerId, playerName: seat.name,
                    classId: seat.classId || 'PUBLIC', startedAt: state.startedAt, lastActivityAt: now,
                    status: state.endedAt ? (state.winnerSide === 0 ? 'draw' : won ? 'won' : 'lost') : 'in_progress',
                    playerWon: state.endedAt ? won : null, totalQuestions: total, correctAnswers: correct,
                    incorrectAnswers: total - correct, accuracy: total ? correct * 100 / total : 0,
                    score: seat.score, xp: seat.score, level: 1, bestStreak: seat.longestStreak,
                    finalDifficulty: state.difficulty, averageResponseTimeMs: total ? seat.responseTotalMs / total : 0,
                    ropePosition: state.rope * seat.side, isSample: false,
                    ...(state.endedAt ? { endedAt: state.endedAt, endReason: state.reason,
                        durationSeconds: Math.max(0, Math.round((new Date(now) - new Date(state.startedAt)) / 1000)) } : {}) };
                await this.db.collection('sessionRecords').updateOne({ _id: sessionId }, { $set: record }, { upsert: true });
                for (const event of events.filter(e => e.playerId === seat.playerId)) {
                    await this.db.collection('answerEvents').updateOne({ _id: `${sessionId}:${event.questionId}` },
                        { $setOnInsert: { ...event, sessionId, classId: record.classId, playerName: seat.name,
                            eventId: `${sessionId}:${event.questionId}`, answeredAt: now, isSample: false } }, { upsert: true });
                }
            }
        });
        this.pending.set(match.matchId, work);
        work.catch(() => {}); // Caller receives the failure; do not create an unhandled rejection.
        work.finally(() => { if (this.pending.get(match.matchId) === work) this.pending.delete(match.matchId); }).catch(() => {});
        return work;
    }
}
module.exports = { MatchRecorder };
