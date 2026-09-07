
const { sessions } = require('../models/GameSession');
const questionService = require('../services/QuestionService');

exports.getNextQuestion = async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        if (!sessions.has(sessionId)) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }
        
        const session = sessions.get(sessionId);
        
        if (session.isGameOver) {
            return res.json({
                success: false,
                isGameOver: true,
                playerWon: session.playerWon,
                gameOverReason: session.gameOverReason,
                finalScore: session.score,
                finalXP: session.xp,
                finalLevel: session.level,
                totalQuestions: session.totalQuestions,
                correctAnswers: session.correctAnswers,
                incorrectAnswers: session.incorrectAnswers,
                accuracy: Math.round(session.accuracy * 100) / 100,
                ropePosition: session.ropePosition
            });
        }
        
        if (!session.isActive) {
            return res.status(400).json({
                success: false,
                error: 'Session is no longer active'
            });
        }
        
        const question = questionService.getQuestion(session.difficulty);
        const questionData = question.toJSON();
        
        session.currentQuestion = questionData;
        
        res.json({
            success: true,
            ...questionData,
            currentScore: session.score,
            questionNumber: session.totalQuestions + 1,
            difficulty: session.difficulty,
            ropePosition: session.ropePosition,
            isGameOver: session.isGameOver
        });
        
    } catch (error) {
        console.error('Error getting next question:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get next question',
            message: error.message
        });
    }
};

exports.getBatchQuestions = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const count = parseInt(req.query.count) || 5;
        
        if (!sessions.has(sessionId)) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }
        
        const session = sessions.get(sessionId);
        
        if (session.isGameOver) {
            return res.json({
                success: false,
                isGameOver: true,
                playerWon: session.playerWon,
                gameOverReason: session.gameOverReason
            });
        }
        
        if (!session.isActive) {
            return res.status(400).json({
                success: false,
                error: 'Session is no longer active'
            });
        }
        
        const questions = questionService.getBatchQuestions(
            Math.min(count, 20), 
            session.difficulty
        );
        
        res.json({
            success: true,
            questions: questions.map(q => q.toJSON()),
            difficulty: session.difficulty,
            ropePosition: session.ropePosition,
            isGameOver: session.isGameOver
        });
        
    } catch (error) {
        console.error('Error getting batch questions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get batch questions',
            message: error.message
        });
    }
};