const { wrap } = require('../database/errors');
exports.startSession = wrap(async (req, res) => res.status(201).json(await req.app.locals.games.start(req.user, req.body)));
exports.getSessionStatus = wrap(async (req, res) => res.json(await req.app.locals.games.status(req.params.sessionId, req.user)));
exports.endSession = wrap(async (req, res) => res.json(await req.app.locals.games.end(req.params.sessionId, req.user)));
