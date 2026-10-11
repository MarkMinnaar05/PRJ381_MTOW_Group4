const { GameSession } = require('./ApiGameSession');
const questions = require('../services/QuestionService');
const scoring = require('../services/ScoringService');
const { AnalyticsService } = require('../services/AnalyticsService');
const { ApiError } = require('./errors');
function publicQuestion(q) { const { answer, issuedAt, ...rest } = q; return rest; }
class ApiGameService {
    constructor(db, players) { this.db = db; this.sessions = db.collection('gameSessions'); this.players = players; }
    async start(user, data) {
        const difficulty = Number(data.difficulty ?? 1);
        if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) throw new ApiError(400, 'Difficulty must be 1–5');
        const profile = await this.players.get(user.id, user.name, user.classId);
        const s = new GameSession(profile.nickname, difficulty);
        s.ownerId = user.id; s.classId = user.classId; s.version = 0;
        await this.sessions.insertOne({ ...s, _id: s.sessionId });
        await this.syncAnalytics(s);
        return { success: true, sessionId: s.sessionId, gameState: s.getSummary() };
    }
    async load(id, user) {
        const d = await this.sessions.findOne({ _id: id, ownerId: user.id });
        if (!d) throw new ApiError(404, 'Session not found');
        const { _id, ...fields } = d;
        return Object.assign(Object.create(GameSession.prototype), fields);
    }
    async save(s) {
        const version = s.version;
        s.version++;
        const result = await this.sessions.replaceOne({ _id: s.sessionId, version }, { ...s, _id: s.sessionId });
        if (!result.matchedCount) throw new ApiError(409, 'Session changed. Reload its status and retry.');
        await this.syncAnalytics(s);
    }
    active(s) {
        if (!s.isActive || s.isGameOver) throw new ApiError(409, 'Session has ended');
        const timeout = Number(process.env.SESSION_TIMEOUT || 3600) * 1000;
        if (Date.now() - new Date(s.lastActivityAt).getTime() > timeout) throw new ApiError(409, 'Session expired. Start a new one.');
    }
    async status(id, user) {
        const s = await this.load(id, user);
        await this.syncAnalytics(s);
        return { success: true, session: s.getSummary() };
    }
    async next(id, user, count = 1) {
        const s = await this.load(id, user); this.active(s);
        if (!s.currentQuestion) {
            s.currentQuestion = s.pendingQuestions.shift() || questions.getQuestion(s.difficulty).toJSON();
            s.currentQuestion.issuedAt = new Date();
            s.lastActivityAt = new Date();
        }
        const selected = [s.currentQuestion, ...s.pendingQuestions];
        while (selected.length < count) {
            const q = questions.getQuestion(s.difficulty).toJSON(); s.pendingQuestions.push(q); selected.push(q);
        }
        await this.save(s);
        return count === 1 ? { success: true, ...publicQuestion(s.currentQuestion), questionNumber: s.totalQuestions + 1,
            currentScore: s.score, difficulty: s.difficulty, ropePosition: s.ropePosition }
            : { success: true, questions: selected.slice(0, count).map(publicQuestion), difficulty: s.difficulty };
    }
    async answer(user, data) {
        const s = await this.load(data.sessionId, user);
        const prior = s.answers.find(a => a.questionId === data.questionId);
        if (prior) { await this.syncAnalytics(s); return { ...prior.result, duplicate: true }; }
        this.active(s);
        const q = s.currentQuestion;
        if (!q || data.questionId !== q.id) throw new ApiError(409, 'Answer the current question using its questionId');
        if (!['string', 'number'].includes(typeof data.submittedAnswer) || String(data.submittedAnswer).trim() === '' || !Number.isFinite(Number(data.submittedAnswer))) {
            throw new ApiError(400, 'Submitted answer must be a finite number');
        }
        const responseTime = Math.max(0, Date.now() - new Date(q.issuedAt).getTime());
        const isCorrect = Number(data.submittedAnswer) === q.answer;
        const score = scoring.calculateScore(isCorrect, responseTime, s.streak, s.difficulty);
        const levelUp = s.updateStats(isCorrect, responseTime, score.scoreEarned, score.xpEarned);
        if (!s.isGameOver) s.adjustDifficulty();
        const result = { success: true, isCorrect, correctAnswer: q.answer, scoreEarned: score.scoreEarned,
            xpEarned: score.xpEarned, newScore: s.score, newXP: s.xp, newLevel: s.level, levelUp,
            newDifficulty: s.difficulty, streak: s.streak, ropePosition: s.ropePosition,
            totalQuestions: s.totalQuestions, correctAnswers: s.correctAnswers, accuracy: s.accuracy,
            isGameOver: s.isGameOver, playerWon: s.playerWon, gameOverReason: s.gameOverReason };
        s.answers.push({ questionId: q.id, question: q, submittedAnswer: Number(data.submittedAnswer),
            responseTime, answeredAt: new Date().toISOString(), questionNumber: s.totalQuestions, result });
        s.currentQuestion = null;
        await this.save(s);
        return result;
    }
    async end(id, user) {
        const s = await this.load(id, user);
        s.isActive = false; s.endedAt ||= new Date(); s.endReason ||= 'ended_by_user';
        await this.save(s);
        return { success: true, finalStats: s.getSummary() };
    }
    async syncAnalytics(s) {
        const record = new AnalyticsService().toSessionRecord(s);
        record.classId = s.classId; record.playerId = s.ownerId;
        if (s.endedAt) {
            record.endedAt = new Date(s.endedAt).toISOString(); record.endReason = s.endReason;
            if (!s.isGameOver) record.status = 'ended';
            record.durationSeconds = Math.max(0, Math.round((new Date(s.endedAt) - new Date(s.createdAt)) / 1000));
        }
        // The embedded answers are the durable source of truth; upserts repair a interrupted projection.
        if (s.answers.length) await this.db.collection('answerEvents').bulkWrite(s.answers.map(a => ({
            updateOne: { filter: { _id: `${s.sessionId}:${a.questionId}` }, update: { $setOnInsert: {
                eventId: `${s.sessionId}:${a.questionId}`, sessionId: s.sessionId, classId: s.classId,
                playerId: s.ownerId, playerName: s.playerName, questionId: a.questionId,
                questionText: a.question.text, operation: a.question.operation, operand1: a.question.operand1,
                operand2: a.question.operand2, correctAnswer: a.question.answer, submittedAnswer: a.submittedAnswer,
                isCorrect: a.result.isCorrect, responseTimeMs: a.responseTime, difficulty: a.question.difficulty,
                questionNumber: a.questionNumber, scoreEarned: a.result.scoreEarned, streakAfter: a.result.streak,
                ropePositionAfter: a.result.ropePosition, answeredAt: a.answeredAt, isSample: false
            } }, upsert: true }
        })));
        // Version guard stops a late writer overwriting newer analytics.
        const target = this.db.collection('sessionRecords');
        try {
            await target.updateOne({ _id: s.sessionId, $or: [{ version: { $lte: s.version } }, { version: { $exists: false } }] },
                { $set: { ...record, version: s.version } }, { upsert: true });
        } catch (e) { if (e.code !== 11000) throw e; }
        if (!s.isActive) {
            await this.players.awardMatch(s.ownerId, s.sessionId, s.xp);
            await this.players.addMatch(s.ownerId, { matchId: s.sessionId, mode: 'api', result: s.playerWon === true ? 'win' : s.playerWon === false ? 'lose' : 'ended',
                score: s.score, xpEarned: s.xp, endedAt: new Date(s.endedAt).toISOString(), classId: s.classId });
        }
    }
}
module.exports = { ApiGameService };
