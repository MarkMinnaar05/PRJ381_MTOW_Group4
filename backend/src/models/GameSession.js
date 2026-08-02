// src/models/GameSession.js
const { v4: uuidv4 } = require('uuid');

class GameSession {
    constructor(playerName = 'Player', initialDifficulty = 1) {
        this.sessionId = uuidv4();
        this.playerName = playerName;
        this.createdAt = new Date();
        this.lastActivityAt = new Date();
        this.isActive = true;
        this.score = 0;
        this.xp = 0;
        this.level = 1;
        this.levelThreshold = 100;
        this.streak = 0;
        this.bestStreak = 0;
        this.ropePosition = 0;
        this.totalQuestions = 0;
        this.correctAnswers = 0;
        this.incorrectAnswers = 0;
        this.accuracy = 0;
        this.difficulty = initialDifficulty;
        this.maxDifficulty = 5;
        this.minDifficulty = 1;
        this.totalResponseTime = 0;
        this.averageResponseTime = 0;
        this.questionsHistory = [];
        this.currentQuestion = null;
        this.badges = [];

        // ✅ Game-over state
        this.isGameOver = false;
        this.playerWon = null;
        this.gameOverReason = null;
        this.winThreshold = 1;
    }

    updateStats(isCorrect, responseTime, scoreEarned, xpEarned) {
        this.totalQuestions++;
        this.lastActivityAt = new Date();
        
        if (isCorrect) {
            this.streak++;
            if (this.streak > this.bestStreak) {
                this.bestStreak = this.streak;
            }
            this.ropePosition += 0.1;
        } else {
            this.streak = 0;
            this.ropePosition -= 0.1;
        }
        this.ropePosition = Math.max(-1, Math.min(1, this.ropePosition));
        
        this.score += scoreEarned;
        this.xp += xpEarned;
        
        if (isCorrect) {
            this.correctAnswers++;
        } else {
            this.incorrectAnswers++;
        }
        this.accuracy = this.totalQuestions > 0 
            ? (this.correctAnswers / this.totalQuestions) * 100 
            : 0;
        
        if (responseTime > 0) {
            this.totalResponseTime += responseTime;
            this.averageResponseTime = this.totalResponseTime / this.totalQuestions;
        }
        
        this.questionsHistory.push({
            isCorrect,
            difficulty: this.difficulty,
            responseTime
        });
        if (this.questionsHistory.length > 20) {
            this.questionsHistory.shift();
        }

        // ✅ Check for win/loss after rope position updates
        this.checkGameOver();
        
        return this.checkLevelUp();
    }

    // ✅ NEW: Determine if the rope has hit either end
    checkGameOver() {
        if (this.isGameOver) return;

        if (this.ropePosition >= this.winThreshold) {
            this.isGameOver = true;
            this.playerWon = true;
            this.gameOverReason = 'rope_reached_player_side';
            this.isActive = false;
        } else if (this.ropePosition <= -this.winThreshold) {
            this.isGameOver = true;
            this.playerWon = false;
            this.gameOverReason = 'rope_reached_opponent_side';
            this.isActive = false;
        }
    }

    checkLevelUp() {
        let leveledUp = false;
        while (this.xp >= this.levelThreshold) {
            this.level++;
            this.levelThreshold = Math.floor(this.levelThreshold * 1.5);
            leveledUp = true;
        }
        return leveledUp;
    }

    adjustDifficulty() {
        const recentQuestions = this.questionsHistory.slice(-10);
        if (recentQuestions.length < 5) {
            return this.difficulty;
        }
        
        const correctCount = recentQuestions.filter(q => q.isCorrect).length;
        const recentAccuracy = correctCount / recentQuestions.length;
        
        if (recentAccuracy > 0.8) {
            this.difficulty = Math.min(this.difficulty + 1, this.maxDifficulty);
        } else if (recentAccuracy < 0.5) {
            this.difficulty = Math.max(this.difficulty - 1, this.minDifficulty);
        }
        
        return this.difficulty;
    }

    getSummary() {
        return {
            sessionId: this.sessionId,
            playerName: this.playerName,
            score: this.score,
            xp: this.xp,
            level: this.level,
            levelThreshold: this.levelThreshold,
            streak: this.streak,
            bestStreak: this.bestStreak,
            totalQuestions: this.totalQuestions,
            correctAnswers: this.correctAnswers,
            incorrectAnswers: this.incorrectAnswers,
            accuracy: Math.round(this.accuracy * 100) / 100,
            difficulty: this.difficulty,
            averageResponseTime: Math.round(this.averageResponseTime),
            badges: this.badges,
            isActive: this.isActive,
            createdAt: this.createdAt,
            lastActivityAt: this.lastActivityAt,
            ropePosition: this.ropePosition,
            isGameOver: this.isGameOver,
            playerWon: this.playerWon,
            gameOverReason: this.gameOverReason
        };
    }
}

const sessions = new Map();

module.exports = {
    GameSession,
    sessions
};