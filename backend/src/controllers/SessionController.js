// src/controllers/SessionController.js
const { GameSession, sessions } = require('../models/GameSession');
const questionService = require('../services/QuestionService');

exports.startSession = async (req, res) => {
    try {
        const { playerName = 'Player', difficulty = 1 } = req.body;
        
        const validDifficulty = Math.max(1, Math.min(5, difficulty || 1));
        
        const session = new GameSession(playerName, validDifficulty);
        
        questionService.preCacheQuestions(validDifficulty, 10);
        
        sessions.set(session.sessionId, session);
        
        setTimeout(() => {
            if (sessions.has(session.sessionId)) {
                const inactiveSession = sessions.get(session.sessionId);
                const inactiveTime = (Date.now() - inactiveSession.lastActivityAt.getTime()) / 1000;
                if (inactiveTime > 3600) {
                    inactiveSession.isActive = false;
                    sessions.delete(session.sessionId);
                    console.log(`Session ${session.sessionId} ended due to inactivity`);
                }
            }
        }, 3600000);
        
        res.status(201).json({
            success: true,
            sessionId: session.sessionId,
            gameState: session.getSummary()
        });
        
    } catch (error) {
        console.error('Error starting session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start session',
            message: error.message
        });
    }
};

exports.getSessionStatus = async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        if (!sessions.has(sessionId)) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }
        
        const session = sessions.get(sessionId);
        
        res.json({
            success: true,
            session: session.getSummary()
        });
        
    } catch (error) {
        console.error('Error getting session status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get session status',
            message: error.message
        });
    }
};

exports.endSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        if (!sessions.has(sessionId)) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }
        
        const session = sessions.get(sessionId);
        session.isActive = false;
        
        const finalStats = session.getSummary();
        sessions.delete(sessionId);
        
        res.json({
            success: true,
            message: 'Session ended successfully',
            finalStats: finalStats
        });
        
    } catch (error) {
        console.error('Error ending session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to end session',
            message: error.message
        });
    }
};