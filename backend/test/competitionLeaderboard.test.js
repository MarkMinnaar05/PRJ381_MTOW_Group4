
const test = require('node:test');
const assert = require('node:assert/strict');

const {
    CompetitionLeaderboardService
} = require('../src/services/CompetitionLeaderboardService');

test(
    'summarises completed PvP matches without counting CPU games',
    () => {
        const player = {
            _id: 'p1',
            nickname: 'Alex',
            totalXp: 250
        };

        const result =
            CompetitionLeaderboardService.summarise(
                player,
                [
                    {
                        mode: 'pvp',
                        result: 'win',
                        score: 30,
                        correctAnswers: 3,
                        totalQuestions: 4,
                        longestStreak: 3
                    },
                    {
                        mode: 'pvp',
                        result: 'lose',
                        score: 10,
                        correctAnswers: 1,
                        totalQuestions: 2,
                        longestStreak: 1
                    },
                    {
                        mode: 'pvp',
                        result: 'draw',
                        score: 20,
                        correctAnswers: 2,
                        totalQuestions: 2,
                        longestStreak: 2
                    },
                    {
                        mode: 'cpu',
                        result: 'win',
                        score: 100,
                        correctAnswers: 10,
                        totalQuestions: 10,
                        longestStreak: 10
                    }
                ]
            );

        assert.equal(result.wins, 1);
        assert.equal(result.losses, 1);
        assert.equal(result.draws, 1);
        assert.equal(result.matchesPlayed, 3);
        assert.equal(result.totalScore, 60);
        assert.equal(result.accuracy, 75);
        assert.equal(result.bestStreak, 3);
        assert.equal(result.totalXp, 250);
    }
);

test(
    'handles players with no completed matches',
    () => {
        const result =
            CompetitionLeaderboardService.summarise(
                {
                    _id: 'p2',
                    totalXp: 0
                },
                []
            );

        assert.equal(result.winRate, 0);
        assert.equal(result.accuracy, 0);
        assert.equal(result.matchesPlayed, 0);
    }
);
