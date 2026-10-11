const defaultRules = require('./rules');
const { QuestionGenerator, solve } = require('./questions');

class MtowMatch {
    constructor({ matchId, mode, cpuLevel = 0, seats, send, award, onChange = null, rules = defaultRules }) {
        this.matchId = matchId;
        this.mode = mode;
        this.cpuLevel = cpuLevel;
        this.rules = rules;
        this.send = send;
        this.award = award;
        this.onChange = onChange;
        this.startedAt = new Date().toISOString();
        this.persistence = Promise.resolve();
        this.generator = new QuestionGenerator();

        this.seats = seats.map((seat, index) => ({
            ...seat,
            side: index === 0 ? 1 : -1,
            ready: false,
            score: 0,
            streak: 0,
            longestStreak: 0,
            totalQuestions: 0,
            correctAnswers: 0,
            responseTotalMs: 0,
            missed: []
        }));
        this.cpu = { score: 0, streak: 0 };

        this.phase = 'ready'; 
        this.phaseAge = 0;
        this.rope = 0;
        this.timeRemaining = rules.matchDurationSeconds;
        this.difficulty = rules.startDifficulty;
        this.window = [];
        this.question = null;
        this.questionNumber = 0;
        this.questionAge = 0;
        this.nextQuestionIn = -1;
        this.lastAnswer = null; 
        this.winnerSide = null; 
        this.reason = '';
    }

    get isOver() {
        return this.phase === 'over';
    }

    hasSeat(seatId) {
        return this.seats.some(s => s.id === seatId);
    }

    begin() {
        for (const seat of this.seats) {
            const other = this.opponentOf(seat);
            this.send(seat.id, 'MatchFound', {
                matchId: this.matchId,
                mode: this.mode,
                opponentNickname: other ? other.name : this.rules.cpuNickname,
                opponentAvatarId: other ? other.avatarId : this.rules.cpuAvatarId
            });
        }
    }

    ready(seatId) {
        const seat = this.seat(seatId);
        if (this.phase !== 'ready' || !seat || seat.ready) return;
        seat.ready = true;
        if (this.seats.some(s => !s.ready)) return;

        this.phase = 'starting';
        this.phaseAge = 0;
        for (const s of this.seats) {
            this.send(s.id, 'MatchStarted', {
                matchId: this.matchId,
                durationSeconds: this.rules.matchDurationSeconds,
                startsInSeconds: this.rules.startsInSeconds
            });
        }
    }

    answer(seatId, payload) {
        const seat = this.seat(seatId);
        if (this.phase !== 'playing' || !seat || !this.question) return;
        if (Number(payload.questionId) !== this.question.questionId) return;

        const q = this.question;
        this.question = null;
        const correctAnswer = solve(q.operandA, q.operandB, q.operation);
        const submitted = Number(payload.submittedAnswer);
        if (!Number.isFinite(submitted) || payload.submittedAnswer === null || String(payload.submittedAnswer ?? "").trim() === "") { this.question = q; return; }
        const responseMs = Math.max(0, Number(payload.responseTimeMs) || 0);
        const correct = submitted === correctAnswer;

        seat.totalQuestions++;
        seat.responseTotalMs += responseMs;
        if (correct) {
            seat.correctAnswers++;
            seat.streak++;
            seat.longestStreak = Math.max(seat.longestStreak, seat.streak);
            seat.score += this.points(responseMs);
            this.pull(seat.side * this.stepFor(seat.streak));
        } else {
            seat.streak = 0;
            this.pull(-seat.side * this.rules.ropeStep);
            seat.missed.push({
                operandA: q.operandA,
                operandB: q.operandB,
                operation: q.operation,
                correctAnswer,
                submittedAnswer: submitted
            });
        }
        this.recordForDifficulty(correct, responseMs);
        this.persist({ playerId: seat.playerId, questionId: q.questionId, questionText: `${q.operandA} ${q.operation} ${q.operandB}`,
            operation: q.operation, operand1: q.operandA, operand2: q.operandB, correctAnswer, submittedAnswer: submitted,
            isCorrect: correct, responseTimeMs: responseMs, difficulty: q.difficulty || this.difficulty,
            questionNumber: seat.totalQuestions, scoreEarned: correct ? this.points(responseMs) : 0,
            streakAfter: seat.streak, ropePositionAfter: this.rope * seat.side });
        this.lastAnswer = { seatId, isCorrect: correct, questionId: q.questionId };
        this.afterAnswer();
    }

    cpuAnswer(seatId, payload) {
        if (this.mode !== 'cpu' || this.phase !== 'playing' || !this.question || !this.hasSeat(seatId)) return;
        if (Number(payload.questionId) !== this.question.questionId) return;

        const questionId = this.question.questionId;
        this.question = null;
        const correct = payload.isCorrect === true;
        if (correct) {
            this.cpu.streak++;
            this.cpu.score += this.points(Number(payload.responseTimeMs) || 0);
            this.pull(-this.stepFor(this.cpu.streak));
        } else {
            this.cpu.streak = 0;
            this.pull(this.rules.ropeStep);
        }
        this.lastAnswer = { seatId: null, isCorrect: correct, questionId };
        this.afterAnswer();
    }

    leave(seatId, reason = 'forfeit') {
        const seat = this.seat(seatId);
        if (this.isOver || !seat) return;
        this.end(-seat.side, reason);
    }

    tick(deltaSeconds) {
        this.phaseAge += deltaSeconds;

        if (this.phase === 'ready') {
            if (this.phaseAge >= this.rules.readyTimeoutSeconds) {
                const late = this.seats.find(s => !s.ready);
                if (late) this.leave(late.id, 'disconnect');
            }
            return;
        }

        if (this.phase === 'starting') {
            if (this.phaseAge >= this.rules.startsInSeconds) {
                this.phase = 'playing';
                this.sendState();
                this.nextQuestion();
            }
            return;
        }

        if (this.phase !== 'playing') return;

        this.timeRemaining = Math.max(0, this.timeRemaining - deltaSeconds);
        if (this.timeRemaining <= 0) {
            this.end(Math.abs(this.rope) < 0.0001 ? 0 : Math.sign(this.rope), 'time');
            return;
        }

        if (this.nextQuestionIn >= 0) {
            this.nextQuestionIn -= deltaSeconds;
            if (this.nextQuestionIn < 0) this.nextQuestion();
            return;
        }

        this.questionAge += deltaSeconds;
        if (this.questionAge >= this.rules.questionTimeLimitSeconds) this.nextQuestion();
    }


    seat(seatId) {
        return this.seats.find(s => s.id === seatId) || null;
    }

    opponentOf(seat) {
        return this.seats.find(s => s !== seat) || null;
    }

    points(responseMs) {
        const limitMs = this.rules.questionTimeLimitSeconds * 1000;
        const speed = 1 - Math.min(1, Math.max(0, responseMs) / limitMs);
        return this.rules.pointsPerCorrect + Math.round(this.rules.maxSpeedBonus * speed);
    }

    stepFor(streak) {
        return streak >= this.rules.streakForBonus ? this.rules.ropeStep * this.rules.streakMultiplier : this.rules.ropeStep;
    }

    pull(amount) {
        const limit = this.rules.winThreshold;
        this.rope = Math.max(-limit, Math.min(limit, this.rope + amount));

    }

    recordForDifficulty(correct, responseMs) {
        this.window.push({ correct, responseMs });
        if (this.window.length < this.rules.adaptiveWindow) return;

        const accuracy = this.window.filter(w => w.correct).length / this.window.length;
        const averageMs = this.window.reduce((sum, w) => sum + w.responseMs, 0) / this.window.length;
        if (accuracy > this.rules.raiseAccuracy && averageMs <= this.rules.fastResponseMs) {
            this.difficulty = Math.min(5, this.difficulty + 1);
        } else if (accuracy < this.rules.lowerAccuracy) {
            this.difficulty = Math.max(1, this.difficulty - 1);
        }
        this.window = [];
    }

    afterAnswer() {
        if (this.rope >= this.rules.winThreshold) this.end(1, 'rope');
        else if (this.rope <= -this.rules.winThreshold) this.end(-1, 'rope');
        if (this.isOver) return;
        this.sendState();
        this.nextQuestionIn = this.rules.nextQuestionDelaySeconds;
    }

    nextQuestion() {
        this.nextQuestionIn = -1;
        this.questionAge = 0;
        this.question = this.generator.next(this.difficulty);
        const payload = {
            ...this.question,
            questionNumber: ++this.questionNumber,
            timeLimitMs: Math.round(this.rules.questionTimeLimitSeconds * 1000)
        };
        for (const seat of this.seats) this.send(seat.id, 'Question', payload);
    }

    end(winnerSide, reason) {
        if (this.isOver) return;
        this.phase = 'over';
        this.question = null;
        this.winnerSide = winnerSide;
        this.reason = reason;
        this.sendState();
        this.persist();
        const completions = [];
        for (const seat of this.seats) {
            try {
                const result = this.onChange ? this.persistence.then(() => this.endedFor(seat)) : this.endedFor(seat);
                if (result && typeof result.then === 'function') {
                    completions.push(result.then(payload => this.send(seat.id, 'MatchEnded', payload)).catch(() =>
                        this.send(seat.id, 'Error', { code: 'database_error', message: 'Game ended, but saving failed. Ask your teacher to check the server.' })));
                } else this.send(seat.id, 'MatchEnded', result);
            } catch (_) { this.send(seat.id, 'Error', { code: 'database_error', message: 'Could not save game result' }); }
        }
        this.completion = Promise.all(completions);
    }

    persist(answer) {
        if (!this.onChange) return;
        this.persistence = this.onChange(this, answer);
        this.persistence.catch(() => {});
    }

    resultFor(seat) {
        if (this.winnerSide === null) return '';
        if (this.winnerSide === 0) return 'draw';
        return this.winnerSide === seat.side ? 'win' : 'lose';
    }

    opponentScore(seat) {
        const other = this.opponentOf(seat);
        return other ? other.score : this.cpu.score;
    }

    accuracy(seat) {
        return seat.totalQuestions === 0 ? 0 : seat.correctAnswers * 100 / seat.totalQuestions;
    }

    sendState() {
        for (const seat of this.seats) {
            const result = this.resultFor(seat);
            const last = this.lastAnswer;
            this.send(seat.id, 'GameState', {
                ropePosition: this.rope * seat.side,
                playerScore: seat.score,
                opponentScore: this.opponentScore(seat),
                isGameOver: this.isOver,
                playerWon: result === 'win',
                totalQuestions: seat.totalQuestions,
                correctAnswers: seat.correctAnswers,
                accuracy: this.accuracy(seat),
                streak: seat.streak,
                timeRemainingSeconds: this.timeRemaining,
                result,
                lastAnswer: last
                    ? { by: last.seatId === seat.id ? 'player' : 'opponent', isCorrect: last.isCorrect, questionId: last.questionId }
                    : { by: '', isCorrect: false, questionId: 0 }
            });
        }
    }

    endedFor(seat) {
        const xpEarned = seat.score;
        const progress = this.award(seat.id, xpEarned, this.matchId);
        if (progress && typeof progress.then === 'function') return progress.then(p => this.resultPayload(seat, xpEarned, p));
        return this.resultPayload(seat, xpEarned, progress);
    }

    resultPayload(seat, xpEarned, progress) {
        return {
            matchId: this.matchId,
            result: this.resultFor(seat),
            reason: this.reason,
            score: seat.score,
            opponentScore: this.opponentScore(seat),
            accuracy: this.accuracy(seat),
            totalQuestions: seat.totalQuestions,
            correctAnswers: seat.correctAnswers,
            xpEarned,
            level: progress.level,
            missedQuestions: seat.missed,
            difficulty: this.difficulty,
            longestStreak: seat.longestStreak,
            avgResponseTimeMs: seat.totalQuestions === 0 ? 0 : seat.responseTotalMs / seat.totalQuestions,
            totalXp: progress.totalXp,
            levelStartXp: progress.levelStartXp,
            nextLevelXp: progress.nextLevelXp
        };
    }
}

module.exports = { MtowMatch };
