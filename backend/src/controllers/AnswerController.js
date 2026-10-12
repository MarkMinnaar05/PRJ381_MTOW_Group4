const { wrap } = require('../database/errors');
exports.submitAnswer = wrap(async (req, res) => res.json(await req.app.locals.games.answer(req.user, req.body)));
