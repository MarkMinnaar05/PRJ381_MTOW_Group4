const { wrap, ApiError } = require('../database/errors');
exports.getNextQuestion = wrap(async (req, res) => res.json(await req.app.locals.games.next(req.params.sessionId, req.user)));
exports.getBatchQuestions = wrap(async (req, res) => {
    const count = Number(req.query.count ?? 5);
    if (!Number.isInteger(count) || count < 1 || count > 20) throw new ApiError(400, 'Count must be 1–20');
    res.json(await req.app.locals.games.next(req.params.sessionId, req.user, count));
});
