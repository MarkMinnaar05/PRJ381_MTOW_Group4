
class CompetitionLeaderboardService {
    constructor(db, levelFor) {
        this.players = db.collection('players');
        this.matches = db.collection('matches');
        this.levelFor = levelFor;
    }

    static summarise(player, records) {
        const pvp = records.filter(
            record =>
                record.mode === 'pvp' &&
                ['win', 'lose', 'draw'].includes(record.result)
        );

        const wins = pvp.filter(
            record => record.result === 'win'
        ).length;

        const losses = pvp.filter(
            record => record.result === 'lose'
        ).length;

        const draws = pvp.filter(
            record => record.result === 'draw'
        ).length;

        const matchesPlayed = pvp.length;

        const totalScore = pvp.reduce(
            (total, record) =>
                total + (Number(record.score) || 0),
            0
        );

        const correctAnswers = pvp.reduce(
            (total, record) =>
                total + (Number(record.correctAnswers) || 0),
            0
        );

        const totalQuestions = pvp.reduce(
            (total, record) =>
                total + (Number(record.totalQuestions) || 0),
            0
        );

        const bestStreak = pvp.reduce(
            (best, record) =>
                Math.max(
                    best,
                    Number(record.longestStreak) || 0
                ),
            0
        );

        const totalXp = Number(player.totalXp) || 0;

        return {
            playerId: String(player._id),
            nickname: player.nickname || 'Player',
            avatarId: player.avatarId || '',
            totalXp,
            wins,
            losses,
            draws,
            matchesPlayed,
            totalScore,
            correctAnswers,
            totalQuestions,
            bestStreak,
            winRate: matchesPlayed
                ? wins * 100 / matchesPlayed
                : 0,
            accuracy: totalQuestions
                ? correctAnswers * 100 / totalQuestions
                : 0
        };
    }

    async getLeaderboard(classId, limit = 100) {
        const players = await this.players.find(
            { classId },
            {
                projection: {
                    _id: 1,
                    nickname: 1,
                    avatarId: 1,
                    totalXp: 1
                }
            }
        ).limit(1000).toArray();

        const ids = players.map(
            player => String(player._id)
        );

        const records = ids.length
            ? await this.matches.find(
                {
                    playerId: { $in: ids },
                    mode: 'pvp'
                },
                {
                    projection: {
                        _id: 0,
                        playerId: 1,
                        mode: 1,
                        result: 1,
                        score: 1,
                        correctAnswers: 1,
                        totalQuestions: 1,
                        longestStreak: 1
                    }
                }
            ).toArray()
            : [];

        const grouped = new Map();

        for (const record of records) {
            const id = String(record.playerId);

            if (!grouped.has(id)) {
                grouped.set(id, []);
            }

            grouped.get(id).push(record);
        }

        const ranked = players.map(player => {
            const result =
                CompetitionLeaderboardService.summarise(
                    player,
                    grouped.get(String(player._id)) || []
                );

            result.level = this.levelFor(result.totalXp);

            return result;
        });

        ranked.sort(
            (a, b) =>
                b.wins - a.wins ||
                b.winRate - a.winRate ||
                b.totalXp - a.totalXp ||
                b.totalScore - a.totalScore ||
                a.nickname.localeCompare(b.nickname) ||
                a.playerId.localeCompare(b.playerId)
        );

        return ranked
            .slice(0, limit)
            .map((player, index) => ({
                ...player,
                rank: index + 1
            }));
    }

    async getRecentMatches(classId, limit = 15) {
        const players = await this.players.find(
            { classId },
            {
                projection: {
                    _id: 1,
                    nickname: 1
                }
            }
        ).toArray();

        const names = new Map(
            players.map(player => [
                String(player._id),
                player.nickname || 'Player'
            ])
        );

        const ids = [...names.keys()];

        if (!ids.length) {
            return [];
        }

        const records = await this.matches.find(
            {
                playerId: { $in: ids },
                mode: 'pvp'
            },
            {
                projection: {
                    _id: 0,
                    playerId: 1,
                    matchId: 1,
                    opponentPlayerId: 1,
                    opponentNickname: 1,
                    score: 1,
                    opponentScore: 1,
                    result: 1,
                    accuracy: 1,
                    correctAnswers: 1,
                    totalQuestions: 1,
                    longestStreak: 1,
                    endedAt: 1,
                    reason: 1
                }
            }
        ).sort({
            endedAt: -1
        }).limit(limit * 5).toArray();

        const seen = new Set();
        const output = [];

        for (const record of records) {
            if (
                !record.matchId ||
                seen.has(record.matchId) ||
                !['win', 'lose', 'draw'].includes(record.result)
            ) {
                continue;
            }

            seen.add(record.matchId);

            const otherId = record.opponentPlayerId
                ? String(record.opponentPlayerId)
                : null;

            if (otherId && !names.has(otherId)) {
                continue;
            }

            const other = records.find(
                candidate =>
                    candidate.matchId === record.matchId &&
                    String(candidate.playerId) !==
                        String(record.playerId)
            );

            output.push({
                matchId: record.matchId,
                endedAt: record.endedAt || null,
                reason: record.reason || null,

                player1: {
                    nickname:
                        names.get(String(record.playerId)) ||
                        'Player',
                    score: record.score,
                    accuracy: record.accuracy,
                    correctAnswers: record.correctAnswers,
                    totalQuestions: record.totalQuestions,
                    longestStreak: record.longestStreak,
                    result: record.result
                },

                player2: {
                    nickname: other
                        ? names.get(String(other.playerId))
                        : (
                            record.opponentNickname ||
                            'Opponent'
                        ),

                    score: other
                        ? other.score
                        : record.opponentScore,

                    accuracy: other?.accuracy ?? null,

                    correctAnswers:
                        other?.correctAnswers ?? null,

                    totalQuestions:
                        other?.totalQuestions ?? null,

                    longestStreak:
                        other?.longestStreak ?? null,

                    result: other?.result ||
                        (
                            record.result === 'win'
                                ? 'lose'
                                : record.result === 'lose'
                                    ? 'win'
                                    : 'draw'
                        )
                }
            });

            if (output.length >= limit) {
                break;
            }
        }

        return output;
    }
}

module.exports = { CompetitionLeaderboardService };
