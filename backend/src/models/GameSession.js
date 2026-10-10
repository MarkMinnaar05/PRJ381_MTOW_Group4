
class GameSession {
    constructor(roomId, hostId, hostName, initialDifficulty = 1) {
        this.roomId = roomId;
        this.createdAt = new Date();
        this.isActive = true;
        this.difficulty = initialDifficulty;

        // Multiplayer State
        this.players = {
            [hostId]: {
                id: hostId,
                name: hostName,
                score: 0,
                xp: 0,
                level: 1,
                streak: 0,
                side: 1 
            }
        };
        this.hostId = hostId;

        // Shared Game State
        this.ropePosition = 0;
        this.winThreshold = 1.0;
        this.currentQuestion = null;
        this.totalQuestions = 0;
        this.isGameOver = false;
        this.winner = null;
        this.gameOverReason = null;
    }

    addPlayer(playerId, playerName) {
        if (Object.keys(this.players).length >= 2) {
            return false; 
        }
        this.players[playerId] = {
            id: playerId,
            name: playerName,
            score: 0,
            xp: 0,
            level: 1,
            streak: 0,
            side: -1 
        };
        return true;
    }

    removePlayer(playerId) {
        delete this.players[playerId];

        if (playerId === this.hostId) {
            const remaining = Object.keys(this.players);
            this.hostId = remaining.length > 0 ? remaining[0] : null;
        }

        if (Object.keys(this.players).length === 0) {
            this.isActive = false;
        }
    }

    processAnswer(playerId, isCorrect, scoreEarned, xpEarned) {
        if (this.isGameOver) return;

        const player = this.players[playerId];
        if (!player) return;

        this.totalQuestions++;

        if (isCorrect) {
            player.streak++;
            player.score += scoreEarned;
            player.xp += xpEarned;
            this.ropePosition += (0.1 * player.side);
        } else {
            player.streak = 0;
            this.ropePosition -= (0.1 * player.side);
        }

        this.ropePosition = Math.max(-1, Math.min(1, this.ropePosition));
        this.checkGameOver();
    }

    // Was missing entirely — this is what server.js's submit_answer handler
    // calls after every processAnswer(). Any streak of 3+ from either
    // player bumps difficulty up; a cold streak (no one's answered
    // correctly in the last 5 questions) eases it back down.
    adjustDifficulty() {
        const streaks = Object.values(this.players).map(p => p.streak);
        const maxStreak = streaks.length > 0 ? Math.max(...streaks) : 0;

        if (maxStreak >= 3 && this.difficulty < 5) {
            this.difficulty++;
        } else if (maxStreak === 0 && this.difficulty > 1 && this.totalQuestions % 5 === 0) {
            this.difficulty--;
        }
    }

    checkGameOver() {
        if (this.ropePosition >= this.winThreshold) {
            this.isGameOver = true;
            this.winner = this.getSideOwner(1);
            this.gameOverReason = 'rope_reached_host_side';
        } else if (this.ropePosition <= -this.winThreshold) {
            this.isGameOver = true;
            this.winner = this.getSideOwner(-1);
            this.gameOverReason = 'rope_reached_guest_side';
        }
    }

    getSideOwner(sideValue) {
        return Object.values(this.players).find(p => p.side === sideValue) || null;
    }

    getSummary() {
        return {
            roomId: this.roomId,
            ropePosition: this.ropePosition,
            currentQuestion: this.currentQuestion,
            players: Object.values(this.players),
            isGameOver: this.isGameOver,
            winner: this.winner,
            gameOverReason: this.gameOverReason,
            totalQuestions: this.totalQuestions
        };
    }
}

const sessions = new Map();

module.exports = {
    GameSession,
    sessions
};