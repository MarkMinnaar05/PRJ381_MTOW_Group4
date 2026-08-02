// src/services/ScoringService.js
class ScoringService {
    constructor() {
        this.SCORE_PER_CORRECT = 10; // ✅ flat score per correct answer
        this.XP_PER_CORRECT = 10;    // ✅ flat XP per correct answer
        this.LEVEL_XP_BASE = 100;
        this.LEVEL_XP_MULTIPLIER = 1.5;
    }

    calculateScore(isCorrect, responseTime, streak = 0, difficulty = 1) {
        if (!isCorrect) {
            return {
                scoreEarned: 0,
                xpEarned: 0,
                bonusBreakdown: {
                    base: 0,
                    speedBonus: 0,
                    streakBonus: 0,
                    difficultyBonus: 0
                }
            };
        }

        // ✅ Both score and XP are flat for every correct answer —
        // no speed, streak, or difficulty bonuses applied.
        return {
            scoreEarned: this.SCORE_PER_CORRECT,
            xpEarned: this.XP_PER_CORRECT,
            bonusBreakdown: {
                base: this.SCORE_PER_CORRECT,
                speedBonus: 0,
                streakBonus: 0,
                difficultyBonus: 0
            }
        };
    }

    getXPForLevel(currentLevel) {
        return Math.floor(this.LEVEL_XP_BASE * Math.pow(this.LEVEL_XP_MULTIPLIER, currentLevel - 1));
    }

    checkLevelUp(currentXP, currentLevel) {
        const xpNeeded = this.getXPForLevel(currentLevel);
        if (currentXP >= xpNeeded) {
            return {
                leveledUp: true,
                newLevel: currentLevel + 1,
                xpRemaining: currentXP - xpNeeded
            };
        }
        return {
            leveledUp: false,
            newLevel: currentLevel,
            xpRemaining: currentXP,
            xpNeeded: xpNeeded
        };
    }

    getPlayerStats(session) {
        return {
            totalScore: session.score,
            totalXP: session.xp,
            currentLevel: session.level,
            nextLevelXP: this.getXPForLevel(session.level),
            streak: session.streak,
            bestStreak: session.bestStreak,
            accuracy: session.accuracy,
            totalQuestions: session.totalQuestions,
            correctAnswers: session.correctAnswers,
            incorrectAnswers: session.incorrectAnswers,
            currentDifficulty: session.difficulty,
            averageResponseTime: session.averageResponseTime
        };
    }
}

module.exports = new ScoringService();