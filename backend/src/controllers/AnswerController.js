const { sessions } = require('../models/GameSession');
const scoringService = require('../services/ScoringService');

exports.submitAnswer = async (req, res) => {
    try {
        const {
            sessionId,
            submittedAnswer,
            expectedAnswer,
            responseTime = 0
        } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
        }
        
        if (submittedAnswer === undefined || submittedAnswer === null) {
            return res.status(400).json({
                success: false,
                error: 'Submitted answer is required'
            });
        }
        
        if (!sessions.has(sessionId)) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }
        
        const session = sessions.get(sessionId);
        
        if (!session.isActive) {
            return res.status(400).json({
                success: false,
                error: 'Session is no longer active'
            });
        }
        
        const parsedAnswer = Number(submittedAnswer);
        if (isNaN(parsedAnswer)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid answer format. Must be a number.'
            });
        }
        
        let isCorrect = false;
        
        if (expectedAnswer !== undefined && expectedAnswer !== null) {
            isCorrect = parsedAnswer === Number(expectedAnswer);
        } else if (session.currentQuestion) {
            isCorrect = parsedAnswer === Number(session.currentQuestion.answer);
        } else {
            return res.status(400).json({
                success: false,
                error: 'No question available for validation'
            });
        }
        
        const scoreResult = scoringService.calculateScore(
            isCorrect,
            responseTime,
            session.streak,
            session.difficulty
        );
        
        const leveledUp = session.updateStats(
            isCorrect,
            responseTime,
            scoreResult.scoreEarned,
            scoreResult.xpEarned
        );
        
        if (!session.isGameOver) {
            session.adjustDifficulty();
        }
        
        res.json({
            success: true,
            isCorrect: isCorrect,
            scoreEarned: scoreResult.scoreEarned,
            xpEarned: scoreResult.xpEarned,
            newScore: session.score,
            newXP: session.xp,
            newLevel: session.level,
            levelUp: leveledUp,
            newDifficulty: session.difficulty,
            streak: session.streak,
            ropePosition: session.ropePosition,
            totalQuestions: session.totalQuestions,
            correctAnswers: session.correctAnswers,
            accuracy: Math.round(session.accuracy * 100) / 100,
            bonusBreakdown: scoreResult.bonusBreakdown,
            isGameOver: session.isGameOver,
            playerWon: session.playerWon,
            gameOverReason: session.gameOverReason
        });
        
    } catch (error) {
        console.error('Error submitting answer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit answer',
            message: error.message
        });
    }
};