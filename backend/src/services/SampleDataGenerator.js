const {
    analyticsStore
} = require('../models/InMemoryAnalyticsStore');

const OPERATIONS = ['+', '-', '×', '÷'];

const LEARNERS = [
    { name: 'Lerato', accuracy: 84, speed: 2200, weakOperation: '÷' },
    { name: 'Thabo', accuracy: 72, speed: 3000, weakOperation: '×' },
    { name: 'Naledi', accuracy: 91, speed: 1800, weakOperation: '-' },
    { name: 'Sipho', accuracy: 63, speed: 3600, weakOperation: '÷' },
    { name: 'Amina', accuracy: 78, speed: 2600, weakOperation: '+' },
    { name: 'Neo', accuracy: 56, speed: 4100, weakOperation: '-' }
];

function generateSampleData(store = analyticsStore) {
    // Remove old sample data
    store.clear({ sampleOnly: true });

    let eventNumber = 0;

    LEARNERS.forEach((learner, learnerIndex) => {
        createLearnerSessions(
            store,
            learner,
            learnerIndex,
            () => ++eventNumber
        );
    });

    return store.counts();
}

function createLearnerSessions(store, learner, learnerIndex, nextEventNumber) {
    const sessionCount = 5;

    for (let sessionIndex = 0; sessionIndex < sessionCount; sessionIndex++) {
        const sessionId = `sample-${learnerIndex + 1}-${sessionIndex + 1}`;

        const daysAgo = 20 - sessionIndex * 4 + learnerIndex;
        const startedAt = new Date();

        startedAt.setDate(startedAt.getDate() - daysAgo);
        startedAt.setHours(15, learnerIndex * 5, 0, 0);

        let correctAnswers = 0;
        let totalResponseTime = 0;
        let currentStreak = 0;
        let bestStreak = 0;

        const totalQuestions = 12;

        for (
            let questionNumber = 1;
            questionNumber <= totalQuestions;
            questionNumber++
        ) {
            const operation =
                OPERATIONS[(questionNumber + sessionIndex) % OPERATIONS.length];

            const difficulty = Math.min(
                4,
                Math.ceil(questionNumber / 3)
            );

            const question = createQuestion(
                operation,
                difficulty,
                questionNumber + learnerIndex
            );

            let expectedAccuracy =
                learner.accuracy + sessionIndex * 2;

            if (operation === learner.weakOperation) {
                expectedAccuracy -= 18;
            }

            const resultNumber =
                (
                    learnerIndex * 31 +
                    sessionIndex * 17 +
                    questionNumber * 13
                ) % 100;

            const isCorrect = resultNumber < expectedAccuracy;

            if (isCorrect) {
                correctAnswers++;
                currentStreak++;
                bestStreak = Math.max(bestStreak, currentStreak);
            } else {
                currentStreak = 0;
            }

            const responseTimeMs =
                learner.speed +
                difficulty * 400 +
                (questionNumber * 173) % 700;

            totalResponseTime += responseTimeMs;

            const answeredAt = new Date(
                startedAt.getTime() + questionNumber * 30000
            );

            store.addAnswerEvent({
                eventId: `sample-event-${nextEventNumber()}`,
                sessionId,
                playerName: learner.name,
                questionId: `sample-question-${questionNumber}`,
                questionText: question.text,
                operation,
                operand1: question.operand1,
                operand2: question.operand2,
                correctAnswer: question.answer,
                submittedAnswer: isCorrect
                    ? question.answer
                    : question.answer + 1,
                isCorrect,
                responseTimeMs,
                difficulty,
                questionNumber,
                scoreEarned: isCorrect ? 10 : 0,
                streakAfter: currentStreak,
                ropePositionAfter:
                    correctAnswers - (questionNumber - correctAnswers),
                answeredAt: answeredAt.toISOString(),
                isSample: true
            });
        }

        saveSession(store, {
            sessionId,
            learner,
            startedAt,
            totalQuestions,
            correctAnswers,
            totalResponseTime,
            bestStreak,
            sessionIndex
        });
    }
}

function saveSession(store, session) {
    const incorrectAnswers =
        session.totalQuestions - session.correctAnswers;

    const accuracy =
        (session.correctAnswers / session.totalQuestions) * 100;

    const playerWon = session.correctAnswers >= 8;

    const endedAt = new Date(
        session.startedAt.getTime() +
        session.totalQuestions * 30000
    );

    store.upsertSessionRecord({
        sessionId: session.sessionId,
        playerName: session.learner.name,
        startedAt: session.startedAt.toISOString(),
        lastActivityAt: endedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        status: playerWon ? 'won' : 'lost',
        playerWon,
        totalQuestions: session.totalQuestions,
        correctAnswers: session.correctAnswers,
        incorrectAnswers,
        accuracy: Math.round(accuracy * 10) / 10,
        score: session.correctAnswers * 10,
        xp: session.correctAnswers * 5,
        level: session.sessionIndex + 1,
        bestStreak: session.bestStreak,
        finalDifficulty: 4,
        averageResponseTimeMs: Math.round(
            session.totalResponseTime / session.totalQuestions
        ),
        ropePosition:
            session.correctAnswers - incorrectAnswers,
        durationSeconds: session.totalQuestions * 30,
        endReason: playerWon ? 'won' : 'lost',
        isSample: true
    });
}

function createQuestion(operation, difficulty, seed) {
    const base = difficulty * 3 + seed;
    let operand1 = base;
    let operand2 = difficulty + 2;
    let answer;

    if (operation === '+') {
        answer = operand1 + operand2;
    }

    if (operation === '-') {
        operand1 += operand2;
        answer = operand1 - operand2;
    }

    if (operation === '×') {
        operand1 = difficulty + 2;
        operand2 = seed % 8 + 2;
        answer = operand1 * operand2;
    }

    if (operation === '÷') {
        operand2 = difficulty + 1;
        answer = seed % 8 + 2;
        operand1 = operand2 * answer;
    }

    return {
        operand1,
        operand2,
        answer,
        text: `${operand1} ${operation} ${operand2}`
    };
}

module.exports = {
    generateSampleData,
    LEARNERS
};