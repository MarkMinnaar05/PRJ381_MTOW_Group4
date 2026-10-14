
const express = require('express');

const {
    CompetitionLeaderboardService
} = require('../services/CompetitionLeaderboardService');

const router = express.Router();

router.get('/', async (req, res, next) => {
    try {
        const authorization =
            req.get('authorization') || '';

        const token = authorization
            .replace(/^Bearer\s+/i, '')
            .trim();

        if (!token) {
            return res.status(401).json({
                error: 'Sign in to view rankings'
            });
        }

        const user =
            await req.app.locals.auth.authenticate(token);

        if (!user?.classId) {
            return res.status(403).json({
                error: 'Class access required'
            });
        }

        const service =
            new CompetitionLeaderboardService(
                req.app.locals.db,
                xp => req.app.locals.players.levelFor(xp)
            );

        const [players, recentMatches] =
            await Promise.all([
                service.getLeaderboard(user.classId),
                service.getRecentMatches(user.classId)
            ]);

        res.json({
            players,
            recentMatches,
            classId: user.classId
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
