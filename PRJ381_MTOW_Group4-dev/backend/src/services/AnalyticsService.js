// src/services/AnalyticsService.js
// Analytics System (Sprint 3 - Member 6)
//
// What it does:
//   1. RECORDS every answered question and every game session (live games + sample data)
//   2. CALCULATES the numbers teachers need: accuracy, speed, learning gaps,
//      progress over time, per-learner stats
//   3. PACKAGES them for the dashboard (one call) and for the teacher report
//
// The dashboard team (Members 1 & 2) only needs GET /api/analytics/dashboard.
// See docs/analytics-api.md for every endpoint and the response shapes.

const { analyticsStore } = require('../models/InMemoryAnalyticsStore');

const OPERATIONS = [
    { symbol: '+', name: 'Addition' },
    { symbol: '-', name: 'Subtraction' },
    { symbol: '×', name: 'Multiplication' },
    { symbol: '÷', name: 'Division' }
];

const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5];

// Thresholds used to label performance (easy to tweak in one place)
const THRESHOLDS = {
    strongAccuracy: 80,       // % and above = "Strong"
    developingAccuracy: 60,   // % and above = "Developing", below = "Needs support"
    minAnswersForLabel: 10,   // don't label anything with fewer answers than this
    minAnswersPerOpForPlayer: 5,
    trendChangePoints: 5      // accuracy change (in % points) that counts as improving/declining
};

const RESPONSE_TIME_BUCKETS = [
    { label: 'Under 2s', min: 0, max: 2000 },
    { label: '2–4s', min: 2000, max: 4000 },
    { label: '4–6s', min: 4000, max: 6000 },
    { label: '6–8s', min: 6000, max: 8000 },
    { label: '8s+', min: 8000, max: Infinity }
];

const TIMEZONE = process.env.ANALYTICS_TIMEZONE || 'Africa/Johannesburg';

class AnalyticsService {
    constructor(store = analyticsStore) {
        this.store = store;
        this.eventCounter = 0;
    }

    // =====================================================================
    // 1. RECORDING (called by the answer + session flows)
    // =====================================================================

    /**
     * Record one answered question. Call this AFTER session.updateStats(...)
     * so the session already holds the new score / rope position.
     */
    recordAnswer(session, { question, submittedAnswer, isCorrect, responseTime, scoreEarned = 0 }) {
        try {
            const q = question || session.currentQuestion || {};
            const event = {
                eventId: `evt_${Date.now()}_${++this.eventCounter}`,
                sessionId: session.sessionId,
                playerName: session.playerName,
                questionId: q.id || null,
                questionText: q.text || null,
                operation: q.operation || null,
                operand1: q.operand1 ?? null,
                operand2: q.operand2 ?? null,
                correctAnswer: q.answer ?? null,
                submittedAnswer: submittedAnswer === undefined ? null : Number(submittedAnswer),
                isCorrect: Boolean(isCorrect),
                responseTimeMs: Number(responseTime) > 0 ? Math.round(Number(responseTime)) : null,
                difficulty: q.difficulty ?? session.difficulty,
                questionNumber: session.totalQuestions,
                scoreEarned: scoreEarned || 0,
                streakAfter: session.streak,
                ropePositionAfter: round(session.ropePosition, 2),
                answeredAt: new Date().toISOString(),
                isSample: false
            };
            this.store.addAnswerEvent(event);
            this.store.upsertSessionRecord(this.toSessionRecord(session));

            if (session.isGameOver) {
                this.recordSessionEnd(session, session.gameOverReason);
            }
            return event;
        } catch (err) {
            // Analytics must NEVER break the game, so we only log.
            console.error('[Analytics] Failed to record answer:', err.message);
            return null;
        }
    }

    /** Record a session when the game is won/lost or the teacher ends it. */
    recordSessionEnd(session, reason = 'ended_by_user') {
        try {
            const existing = this.store.getSessionRecord(session.sessionId);
            const record = this.toSessionRecord(session);
            // Keep the first end time (e.g. game won, then teacher closes the session later)
            record.endedAt = (existing && existing.endedAt) || new Date().toISOString();
            record.endReason = (existing && existing.endReason) || session.gameOverReason || reason;
            if (!session.isGameOver) record.status = 'ended';
            record.durationSeconds = Math.max(
                0,
                Math.round((new Date(record.endedAt) - new Date(record.startedAt)) / 1000)
            );
            return this.store.upsertSessionRecord(record);
        } catch (err) {
            console.error('[Analytics] Failed to record session end:', err.message);
            return null;
        }
    }

    /** Record that a session started (so it shows up even before the first answer). */
    recordSessionStart(session) {
        try {
            return this.store.upsertSessionRecord(this.toSessionRecord(session));
        } catch (err) {
            console.error('[Analytics] Failed to record session start:', err.message);
            return null;
        }
    }

    toSessionRecord(session, isSample = false) {
        let status = 'in_progress';
        if (session.isGameOver) status = session.playerWon ? 'won' : 'lost';

        return {
            sessionId: session.sessionId,
            playerName: session.playerName,
            startedAt: toISO(session.createdAt),
            lastActivityAt: toISO(session.lastActivityAt),
            status,
            playerWon: session.playerWon,
            totalQuestions: session.totalQuestions,
            correctAnswers: session.correctAnswers,
            incorrectAnswers: session.incorrectAnswers,
            accuracy: round(session.accuracy, 1),
            score: session.score,
            xp: session.xp,
            level: session.level,
            bestStreak: session.bestStreak,
            finalDifficulty: session.difficulty,
            averageResponseTimeMs: Math.round(session.averageResponseTime || 0),
            ropePosition: round(session.ropePosition, 2),
            isSample
        };
    }

    // =====================================================================
    // 2. CALCULATIONS
    // =====================================================================

    getOverview(filters = {}) {
        const events = this.store.getAnswerEvents(filters);
        const sessions = this.getSessions(filters);
        const stats = summarise(events);

        const finished = sessions.filter(s => s.status === 'won' || s.status === 'lost');
        const wins = finished.filter(s => s.status === 'won').length;
        const players = new Set(events.map(e => e.playerName));
        sessions.forEach(s => players.add(s.playerName));

        const times = events.map(e => new Date(e.answeredAt).getTime());

        return {
            totalPlayers: players.size,
            totalSessions: sessions.length,
            completedGames: finished.length,
            gamesInProgress: sessions.filter(s => s.status === 'in_progress').length,
            wins,
            losses: finished.length - wins,
            winRate: finished.length ? round((wins / finished.length) * 100, 1) : 0,
            totalQuestionsAnswered: stats.answered,
            correctAnswers: stats.correct,
            incorrectAnswers: stats.incorrect,
            overallAccuracy: stats.accuracy,
            averageResponseTimeMs: stats.averageResponseTimeMs,
            averageQuestionsPerSession: sessions.length
                ? round(sessions.reduce((sum, s) => sum + (s.totalQuestions || 0), 0) / sessions.length, 1)
                : 0,
            bestStreak: sessions.reduce((best, s) => Math.max(best, s.bestStreak || 0), 0),
            firstActivity: times.length ? new Date(Math.min(...times)).toISOString() : null,
            lastActivity: times.length ? new Date(Math.max(...times)).toISOString() : null,
            dataSource: describeSource(events)
        };
    }

    /** Accuracy + speed per operation. This is where learning gaps show up. */
    getOperationBreakdown(filters = {}) {
        const events = this.store.getAnswerEvents(filters);
        return OPERATIONS.map(op => {
            const stats = summarise(events.filter(e => e.operation === op.symbol));
            return {
                operation: op.symbol,
                name: op.name,
                ...stats,
                masteryLevel: masteryLabel(stats.accuracy, stats.answered)
            };
        });
    }

    getDifficultyBreakdown(filters = {}) {
        const events = this.store.getAnswerEvents(filters);
        return DIFFICULTY_LEVELS.map(level => ({
            difficulty: level,
            ...summarise(events.filter(e => Number(e.difficulty) === level))
        }));
    }

    getResponseTimeDistribution(filters = {}) {
        const times = this.store.getAnswerEvents(filters)
            .map(e => e.responseTimeMs)
            .filter(t => t !== null && t !== undefined);
        return RESPONSE_TIME_BUCKETS.map(b => {
            const count = times.filter(t => t >= b.min && t < b.max).length;
            return {
                label: b.label,
                minMs: b.min,
                maxMs: b.max === Infinity ? null : b.max,
                count,
                percentage: times.length ? round((count / times.length) * 100, 1) : 0
            };
        });
    }

    /** Day-by-day activity and accuracy (includes empty days so charts don't skip). */
    getTrend(filters = {}) {
        const days = clampInt(filters.days, 1, 90, 14);
        const events = this.store.getAnswerEvents(filters);

        const end = filters.to ? new Date(filters.to) : new Date();
        const dayKeys = [];
        for (let i = days - 1; i >= 0; i--) {
            dayKeys.push(dayKey(new Date(end.getTime() - i * 86400000)));
        }

        const byDay = groupBy(events, e => dayKey(new Date(e.answeredAt)));
        return dayKeys.map(date => {
            const dayEvents = byDay.get(date) || [];
            const stats = summarise(dayEvents);
            return {
                date,
                questionsAnswered: stats.answered,
                correctAnswers: stats.correct,
                accuracy: stats.answered ? stats.accuracy : null, // null = no games that day
                averageResponseTimeMs: stats.answered ? stats.averageResponseTimeMs : null,
                sessions: new Set(dayEvents.map(e => e.sessionId)).size,
                activePlayers: new Set(dayEvents.map(e => e.playerName)).size
            };
        });
    }

    /** One row per learner, for the class table on the dashboard. */
    getPlayerStats(filters = {}) {
        const events = this.store.getAnswerEvents(filters);
        const sessions = this.getSessions(filters);
        const eventsByPlayer = groupBy(events, e => e.playerName);
        const sessionsByPlayer = groupBy(sessions, s => s.playerName);
        const names = new Set([...eventsByPlayer.keys(), ...sessionsByPlayer.keys()]);

        return [...names]
            .map(name => this.buildPlayerRow(
                name,
                eventsByPlayer.get(name) || [],
                sessionsByPlayer.get(name) || []
            ))
            .sort((a, b) => a.playerName.localeCompare(b.playerName));
    }

    /** Everything about one learner (for a "click a learner" drill-down). */
    getPlayerDetail(playerName, filters = {}) {
        const playerFilters = { ...filters, playerName };
        const events = this.store.getAnswerEvents(playerFilters);
        const sessions = this.getSessions(playerFilters);
        if (!events.length && !sessions.length) return null;

        const row = this.buildPlayerRow(events[0]?.playerName || sessions[0].playerName, events, sessions);
        return {
            ...row,
            operations: this.getOperationBreakdown(playerFilters),
            difficulty: this.getDifficultyBreakdown(playerFilters),
            trend: this.getTrend(playerFilters),
            sessions: sessions
                .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
                .map(s => pick(s, [
                    'sessionId', 'startedAt', 'endedAt', 'status', 'totalQuestions',
                    'accuracy', 'score', 'bestStreak', 'finalDifficulty', 'averageResponseTimeMs'
                ])),
            recentMistakes: events
                .filter(e => !e.isCorrect)
                .slice(-10)
                .reverse()
                .map(e => pick(e, ['questionText', 'correctAnswer', 'submittedAnswer', 'operation', 'answeredAt']))
        };
    }

    getTopPerformers(filters = {}) {
        const limit = clampInt(filters.limit, 1, 50, 5);
        const eligible = this.getPlayerStats(filters)
            .filter(p => p.questionsAnswered >= THRESHOLDS.minAnswersForLabel);

        const top = (key) => [...eligible]
            .sort((a, b) => b[key] - a[key])
            .slice(0, limit)
            .map(p => ({ playerName: p.playerName, value: p[key] }));

        return {
            highestAccuracy: top('accuracy'),
            highestScore: top('highScore'),
            longestStreak: top('bestStreak'),
            mostImproved: [...eligible]
                .filter(
                    player =>
                    player.accuracyChange !== null &&
                    player.accuracyChange > 0
                )
                .sort((a, b) => b.accuracyChange - a.accuracyChange)
                .slice(0, limit)
                .map(p => ({ playerName: p.playerName, value: p.accuracyChange }))
        };
    }

    getRecentActivity(filters = {}) {
        const limit = clampInt(filters.limit, 1, 50, 10);
        return this.getSessions(filters)
            .sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt))
            .slice(0, limit)
            .map(s => pick(s, [
                'sessionId', 'playerName', 'status', 'totalQuestions', 'accuracy',
                'score', 'startedAt', 'lastActivityAt', 'isSample'
            ]));
    }

    /** Plain-language findings + what the teacher can do about them. */
    getInsights(filters = {}) {
        const insights = [];
        const overview = this.getOverview(filters);

        if (overview.totalQuestionsAnswered === 0) {
            return [{
                type: 'no_data',
                severity: 'info',
                title: 'No games played yet',
                detail: 'Once learners start playing, their results will show up here.',
                recommendation: 'Start a game, or load the sample data to preview the dashboard.'
            }];
        }

        // Learning gaps + strengths by operation
        const ops = this.getOperationBreakdown(filters).filter(o => o.answered >= THRESHOLDS.minAnswersForLabel);
        const sortedOps = [...ops].sort((a, b) => a.accuracy - b.accuracy);
        const weakest = sortedOps[0];
        const strongest = sortedOps[sortedOps.length - 1];

        // A gap = below 60%, OR below 70% and clearly under the class average
        sortedOps
            .filter(o => o.accuracy < THRESHOLDS.developingAccuracy ||
                (o.accuracy < THRESHOLDS.developingAccuracy + 10 &&
                 o.accuracy <= overview.overallAccuracy - THRESHOLDS.trendChangePoints))
            .forEach(o => insights.push({
                type: 'learning_gap',
                severity: o.accuracy < THRESHOLDS.developingAccuracy ? 'high' : 'medium',
                title: `${o.name} is a learning gap`,
                detail: `The class gets ${o.accuracy}% of ${o.name.toLowerCase()} questions right ` +
                        `(class average is ${overview.overallAccuracy}%).`,
                recommendation: `Spend extra class time on ${o.name.toLowerCase()} and start the next game ` +
                                `on a lower difficulty so learners can build confidence.`,
                operation: o.operation
            }));

        if (strongest && weakest && strongest !== weakest && strongest.accuracy >= THRESHOLDS.strongAccuracy) {
            insights.push({
                type: 'strength',
                severity: 'info',
                title: `${strongest.name} is a class strength`,
                detail: `${strongest.accuracy}% of ${strongest.name.toLowerCase()} questions are answered correctly.`,
                recommendation: 'Learners are ready for harder questions here.',
                operation: strongest.operation
            });
        }

        // Slowest operation (only if clearly slower than average)
        const slowest = [...ops].sort((a, b) => b.averageResponseTimeMs - a.averageResponseTimeMs)[0];
        if (slowest && slowest.averageResponseTimeMs > overview.averageResponseTimeMs * 1.2) {
            insights.push({
                type: 'speed',
                severity: 'medium',
                title: `${slowest.name} answers are the slowest`,
                detail: `Learners take ${(slowest.averageResponseTimeMs / 1000).toFixed(1)}s on average, ` +
                        `compared with ${(overview.averageResponseTimeMs / 1000).toFixed(1)}s overall.`,
                recommendation: 'Short daily recall drills (e.g. times tables) can help build speed.',
                operation: slowest.operation
            });
        }

        // Learners who need support
        const players = this.getPlayerStats(filters);
        const needSupport = players.filter(p => p.needsSupport);
        if (needSupport.length) {
            insights.push({
                type: 'learners_need_support',
                severity: 'high',
                title: `${needSupport.length} learner${needSupport.length === 1 ? '' : 's'} may need extra support`,
                detail: needSupport
                    .map(p => `${p.playerName} (${p.accuracy}%${p.weakestOperation ? `, weakest: ${opName(p.weakestOperation)}` : ''})`)
                    .join('; '),
                recommendation: 'Check in with these learners one-on-one or pair them with a stronger learner.',
                players: needSupport.map(p => p.playerName)
            });
        }

        // Progress
        const improving = players.filter(p => p.trend === 'improving');
        const declining = players.filter(p => p.trend === 'declining');
        if (improving.length) {
            insights.push({
                type: 'progress',
                severity: 'info',
                title: `${improving.length} learner${improving.length === 1 ? ' is' : 's are'} improving`,
                detail: improving.map(p => `${p.playerName} (+${p.accuracyChange} pts)`).join('; '),
                recommendation: 'Recognise this progress in class to keep motivation high.',
                players: improving.map(p => p.playerName)
            });
        }
        if (declining.length) {
            insights.push({
                type: 'progress',
                severity: 'medium',
                title: `${declining.length} learner${declining.length === 1 ? ' is' : 's are'} slipping`,
                detail: declining.map(p => `${p.playerName} (${p.accuracyChange} pts)`).join('; '),
                recommendation: 'Look at their recent mistakes in the learner view to find the cause.',
                players: declining.map(p => p.playerName)
            });
        }

        // Difficulty
        const diff = this.getDifficultyBreakdown(filters);
        const easyShare = diff[0].answered / overview.totalQuestionsAnswered;
        if (easyShare > 0.6) {
            insights.push({
                type: 'difficulty',
                severity: 'info',
                title: 'Most questions are still at level 1',
                detail: `${Math.round(easyShare * 100)}% of questions were answered at the easiest difficulty.`,
                recommendation: 'Adaptive difficulty moves learners up once they score above 80% — keep playing regularly.'
            });
        }

        const order = { high: 0, medium: 1, info: 2 };
        return insights.sort((a, b) => order[a.severity] - order[b.severity]);
    }

    // =====================================================================
    // 3. PACKAGES FOR THE DASHBOARD AND REPORT
    // =====================================================================

    /** Everything the dashboard needs in ONE call. */
    getDashboard(filters = {}) {
        return {
            generatedAt: new Date().toISOString(),
            filters: cleanFilters(filters),
            overview: this.getOverview(filters),
            operations: this.getOperationBreakdown(filters),
            difficulty: this.getDifficultyBreakdown(filters),
            trend: this.getTrend(filters),
            responseTimes: this.getResponseTimeDistribution(filters),
            players: this.getPlayerStats(filters),
            topPerformers: this.getTopPerformers({ ...filters, limit: 5 }),
            recentActivity: this.getRecentActivity({ ...filters, limit: 10 }),
            insights: this.getInsights(filters)
        };
    }

    /** The teacher report: dashboard data + a written summary. */
    buildReport(filters = {}) {
        const dashboard = this.getDashboard(filters);
        const o = dashboard.overview;
        const ops = dashboard.operations.filter(x => x.answered > 0);
        const best = [...ops].sort((a, b) => b.accuracy - a.accuracy)[0];
        const worst = [...ops].sort((a, b) => a.accuracy - b.accuracy)[0];
        const supportCount = dashboard.players.filter(p => p.needsSupport).length;

        const summary = o.totalQuestionsAnswered === 0
            ? ['No games have been played in this period yet.']
            : [
                `${o.totalPlayers} learners played ${o.totalSessions} games and answered ` +
                `${o.totalQuestionsAnswered.toLocaleString('en-ZA')} questions, getting ${o.overallAccuracy}% right.`,
                `Learners won ${o.winRate}% of finished games, answering in ` +
                `${(o.averageResponseTimeMs / 1000).toFixed(1)} seconds on average.`,
                best && worst && best !== worst
                    ? `${best.name} is the strongest operation (${best.accuracy}%) and ` +
                      `${worst.name.toLowerCase()} is the weakest (${worst.accuracy}%).`
                    : null,
                supportCount
                    ? `${supportCount} learner${supportCount === 1 ? '' : 's'} scored below ` +
                      `${THRESHOLDS.developingAccuracy}% and may need extra support.`
                    : 'No learners are currently below the support threshold.'
            ].filter(Boolean);

        return {
            title: 'Math Tug-of-War — Class Performance Report',
            ...dashboard,
            period: {
                from: filters.from || o.firstActivity,
                to: filters.to || o.lastActivity,
                trendDays: dashboard.trend.length
            },
            summary,
            thresholds: THRESHOLDS
        };
    }

    /** Raw answer data as CSV (for Excel / Power BI). */
    exportCsv(filters = {}) {
        const columns = [
            'answeredAt', 'playerName', 'sessionId', 'questionNumber', 'questionText', 'operation',
            'difficulty', 'correctAnswer', 'submittedAnswer', 'isCorrect', 'responseTimeMs',
            'scoreEarned', 'streakAfter', 'ropePositionAfter', 'isSample'
        ];
        const rows = this.store.getAnswerEvents(filters).map(e =>
            columns.map(c => csvCell(e[c])).join(',')
        );
        return [columns.join(','), ...rows].join('\n');
    }

    getStatus() {
        return {
            storage: this.store.describe ? this.store.describe() : this.store.constructor.name,
            ...this.store.counts(),
            timezone: TIMEZONE,
            thresholds: THRESHOLDS
        };
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    getSessions(filters) {
        // Sessions with zero answers are skipped - they add noise to "games played"
        return this.store.getSessionRecords(filters).filter(s => (s.totalQuestions || 0) > 0);
    }

    buildPlayerRow(name, events, sessions) {
        const stats = summarise(events);

        // Per-operation accuracy for this learner
        const opStats = OPERATIONS
            .map(op => ({ op: op.symbol, ...summarise(events.filter(e => e.operation === op.symbol)) }))
            .filter(o => o.answered >= THRESHOLDS.minAnswersPerOpForPlayer);
        const byAcc = [...opStats].sort((a, b) => a.accuracy - b.accuracy);

        // Trend: compare accuracy of the first half of their answers with the second half
        const ordered = [...events].sort((a, b) => new Date(a.answeredAt) - new Date(b.answeredAt));
        let accuracyChange = null;
        let trend = 'not_enough_data';
        if (ordered.length >= THRESHOLDS.minAnswersForLabel * 2) {
            const mid = Math.floor(ordered.length / 2);
            accuracyChange = round(summarise(ordered.slice(mid)).accuracy - summarise(ordered.slice(0, mid)).accuracy, 1);
            trend = accuracyChange >= THRESHOLDS.trendChangePoints ? 'improving'
                : accuracyChange <= -THRESHOLDS.trendChangePoints ? 'declining'
                : 'steady';
        }

        const finished = sessions.filter(s => s.status === 'won' || s.status === 'lost');
        const lastPlayed = ordered.length
            ? ordered[ordered.length - 1].answeredAt
            : sessions.map(s => s.lastActivityAt).sort().pop() || null;

        return {
            playerName: name,
            sessionsPlayed: sessions.length || new Set(events.map(e => e.sessionId)).size,
            questionsAnswered: stats.answered,
            correctAnswers: stats.correct,
            accuracy: stats.accuracy,
            averageResponseTimeMs: stats.averageResponseTimeMs,
            wins: finished.filter(s => s.status === 'won').length,
            losses: finished.filter(s => s.status === 'lost').length,
            highScore: sessions.reduce((m, s) => Math.max(m, s.score || 0), 0),
            bestStreak: sessions.reduce((m, s) => Math.max(m, s.bestStreak || 0), 0),
            highestLevel: sessions.reduce((m, s) => Math.max(m, s.level || 1), 1),
            highestDifficulty: events.reduce((m, e) => Math.max(m, Number(e.difficulty) || 1), 1),
            strongestOperation: byAcc.length ? byAcc[byAcc.length - 1].op : null,
            weakestOperation: byAcc.length > 1 ? byAcc[0].op : null,
            masteryLevel: masteryLabel(stats.accuracy, stats.answered),
            needsSupport: stats.answered >= THRESHOLDS.minAnswersForLabel &&
                          stats.accuracy < THRESHOLDS.developingAccuracy,
            trend,
            accuracyChange,
            lastPlayed
        };
    }
}

// ---------- small pure helpers ----------

function summarise(events) {
    const answered = events.length;
    const correct = events.filter(e => e.isCorrect).length;
    const times = events.map(e => e.responseTimeMs).filter(t => t !== null && t !== undefined);
    return {
        answered,
        correct,
        incorrect: answered - correct,
        accuracy: answered ? round((correct / answered) * 100, 1) : 0,
        averageResponseTimeMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
        medianResponseTimeMs: times.length ? median(times) : 0
    };
}

function masteryLabel(accuracy, answered) {
    if (answered < THRESHOLDS.minAnswersForLabel) return 'Not enough data';
    if (accuracy >= THRESHOLDS.strongAccuracy) return 'Strong';
    if (accuracy >= THRESHOLDS.developingAccuracy) return 'Developing';
    return 'Needs support';
}

function describeSource(events) {
    if (!events.length) return 'none';
    const sample = events.filter(e => e.isSample).length;
    if (sample === events.length) return 'sample';
    if (sample === 0) return 'live';
    return 'mixed';
}

function opName(symbol) {
    return (OPERATIONS.find(o => o.symbol === symbol) || {}).name || symbol;
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit'
});
function dayKey(date) {
    return dayFormatter.format(date); // YYYY-MM-DD in the school's timezone
}

function groupBy(items, keyFn) {
    const map = new Map();
    for (const item of items) {
        const key = keyFn(item);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
    }
    return map;
}

function median(values) {
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return Math.round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
}

function round(value, dp = 1) {
    const f = Math.pow(10, dp);
    return Math.round((Number(value) || 0) * f) / f;
}

function clampInt(value, min, max, fallback) {
    const n = parseInt(value, 10);
    if (isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

function toISO(d) {
    return d ? new Date(d).toISOString() : null;
}

function pick(obj, keys) {
    const out = {};
    keys.forEach(k => { if (obj[k] !== undefined) out[k] = obj[k]; });
    return out;
}

function cleanFilters(filters) {
    const out = {};
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') out[k] = v; });
    return out;
}

function csvCell(value) {
    if (value === null || value === undefined) return '';
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const analyticsService = new AnalyticsService();

module.exports = analyticsService;
module.exports.AnalyticsService = AnalyticsService;
module.exports.OPERATIONS = OPERATIONS;
module.exports.THRESHOLDS = THRESHOLDS;
module.exports.dayKey = dayKey;
