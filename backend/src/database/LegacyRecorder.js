// The room-code bridge uses a separate legacy game model. Keep its wire protocol
// while recording its results through the same MongoDB collections.
class LegacyRecorder {
    constructor(db, players) { this.db = db; this.players = players; this.pending = new Map(); }
    capture(room, question, player, submittedAnswer, isCorrect, responseTime, scoreEarned) {
        room.storageId ||= require('node:crypto').randomUUID();
        const snapshot = structuredClone({ ...room, players: room.players });
        const event = question && player ? structuredClone({ question, player, submittedAnswer, isCorrect, responseTime, scoreEarned }) : null;
        const now = new Date().toISOString();
        const prior = this.pending.get(room.roomId) || Promise.resolve();
        const work = prior.then(async () => {
            await this.db.collection('legacyRooms').replaceOne({ _id: snapshot.storageId }, { ...snapshot, _id: snapshot.storageId }, { upsert: true });
            for (const p of Object.values(snapshot.players)) {
                if (!p.playerId) continue;
                const sessionId = `${snapshot.storageId}:${p.playerId}`;
                const won = snapshot.winner?.id === p.id;
                const record = { sessionId, playerId: p.playerId, playerName: p.name, classId: p.classId || 'PUBLIC',
                    startedAt: new Date(snapshot.createdAt).toISOString(), lastActivityAt: now,
                    totalQuestions: p.totalQuestions || 0, correctAnswers: p.correctAnswers || 0,
                    incorrectAnswers: (p.totalQuestions || 0) - (p.correctAnswers || 0),
                    accuracy: p.totalQuestions ? p.correctAnswers * 100 / p.totalQuestions : 0,
                    score: p.score, xp: p.xp, level: p.level, bestStreak: p.bestStreak || 0,
                    finalDifficulty: snapshot.difficulty, averageResponseTimeMs: p.totalQuestions ? p.responseTotal / p.totalQuestions : 0,
                    ropePosition: snapshot.ropePosition * p.side, playerWon: snapshot.isGameOver ? won : null,
                    status: snapshot.isGameOver ? (won ? 'won' : 'lost') : 'in_progress', isSample: false,
                    ...(snapshot.isGameOver ? { endedAt: now, endReason: snapshot.gameOverReason,
                        durationSeconds: Math.max(0, Math.round((new Date(now) - new Date(snapshot.createdAt)) / 1000)) } : {}) };
                await this.db.collection('sessionRecords').updateOne({ _id: sessionId }, { $set: record }, { upsert: true });
                if (snapshot.isGameOver) {
                    await this.players.get(p.playerId, p.name, p.classId);
                    await this.players.awardMatch(p.playerId, snapshot.storageId, p.xp);
                    await this.players.addMatch(p.playerId, { matchId: snapshot.storageId, mode: 'legacy', result: won ? 'win' : 'lose',
                        score: p.score, xpEarned: p.xp, endedAt: now });
                }
                if (event?.player.id === p.id) {
                    const q = event.question;
                    await this.db.collection('answerEvents').updateOne({ _id: `${sessionId}:${q.id}` }, { $setOnInsert: {
                        eventId: `${sessionId}:${q.id}`, sessionId, playerId: p.playerId, classId: record.classId,
                        playerName: p.name, questionId: q.id, questionText: q.text, operation: q.operation,
                        operand1: q.operand1, operand2: q.operand2, correctAnswer: q.answer,
                        submittedAnswer: Number(event.submittedAnswer), isCorrect: event.isCorrect,
                        responseTimeMs: event.responseTime, scoreEarned: event.scoreEarned, difficulty: q.difficulty,
                        questionNumber: p.totalQuestions, streakAfter: p.streak, ropePositionAfter: record.ropePosition,
                        answeredAt: now, isSample: false
                    } }, { upsert: true });
                }
            }
        });
        this.pending.set(room.roomId, work);
        work.catch(() => console.error('[Legacy database] Save failed'));
        work.finally(() => { if (this.pending.get(room.roomId) === work) this.pending.delete(room.roomId); }).catch(() => {});
        return work;
    }
    async flush() { await Promise.all([...this.pending.values()]); }
}
module.exports = { LegacyRecorder };
