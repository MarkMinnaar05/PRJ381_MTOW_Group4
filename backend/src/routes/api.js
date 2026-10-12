const express = require('express');
const { wrap } = require('../database/errors');
const router = express.Router();
router.get('/test', (_req, res) => res.json({ success: true, message: 'API is working!' }));
router.get('/health', wrap(async (req, res) => {
    await req.app.locals.db.command({ ping: 1 });
    res.json({ success: true, database: 'connected', databaseName: req.app.locals.db.databaseName });
}));
for (const [path, method] of [['register', 'register'], ['login', 'login'], ['guest', 'guest']]) {
    router.post(`/auth/${path}`, wrap(async (req, res) => res.status(method === 'login' ? 200 : 201).json(await req.app.locals.auth[method](req.body))));
}
router.use((req, _res, next) => {
    req.token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    req.app.locals.auth.authenticate(req.token).then(user => { req.user = user; next(); }).catch(next);
});
router.get('/auth/me', (req, res) => res.json({ success: true, user: req.user }));
router.post('/auth/logout', wrap(async (req, res) => { await req.app.locals.auth.logout(req.token); res.json({ success: true }); }));
router.get('/players/me', wrap(async (req, res) => res.json({ success: true, player: await req.app.locals.players.get(req.user.id, req.user.name, req.user.classId) })));
router.patch('/players/me', wrap(async (req, res) => {
    await req.app.locals.players.get(req.user.id, req.user.name, req.user.classId);
    res.json({ success: true, player: await req.app.locals.players.update(req.user.id, req.body) });
}));
router.get('/players/me/history', wrap(async (req, res) => {
    const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 20));
    res.json({ success: true, ...await req.app.locals.players.history(req.user.id, limit) });
}));
router.get('/players/me/stats', wrap(async (req, res) => {
    const rows = await req.app.locals.db.collection('sessionRecords').aggregate([
        { $match: { playerId: req.user.id, isSample: false } },
        { $group: { _id: null, games: { $sum: 1 }, wins: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
            questions: { $sum: '$totalQuestions' }, correct: { $sum: '$correctAnswers' } } }
    ]).toArray();
    const stats = rows[0] || { games: 0, wins: 0, questions: 0, correct: 0 };
    delete stats._id;
    res.json({ success: true, stats: { ...stats, winRate: stats.games ? Math.round(stats.wins * 100 / stats.games) : 0,
        accuracy: stats.questions ? Math.round(stats.correct * 100 / stats.questions) : 0 } });
}));
router.get('/leaderboard', wrap(async (req, res) => {
    const players = await req.app.locals.db.collection('players').find({ classId: req.user.classId },
        { projection: { _id: 0, nickname: 1, totalXp: 1, avatarId: 1 } }).sort({ totalXp: -1 }).limit(20).toArray();
    res.json({ success: true, players });
}));
const session = require('../controllers/SessionController');
const question = require('../controllers/QuestionController');
const answer = require('../controllers/AnswerController');
router.post('/session/start', session.startSession);
router.get('/session/status/:sessionId', session.getSessionStatus);
router.delete('/session/end/:sessionId', session.endSession);
router.get('/question/next/:sessionId', question.getNextQuestion);
router.get('/question/batch/:sessionId', question.getBatchQuestions);
router.post('/answer/submit', answer.submitAnswer);
module.exports = router;
