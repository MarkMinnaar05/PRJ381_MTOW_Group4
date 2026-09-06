// server.js
// Backend Server with Socket.IO for Real-time Communication
// Developer: Jesse Smith

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const routes = require('./src/routes/api');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use('/api', routes);

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

const server = http.createServer(app);

const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});

const { GameSession, sessions } = require('./src/models/GameSession');
const questionService = require('./src/services/QuestionService');
const scoringService = require('./src/services/ScoringService');

io.on('connection', (socket) => {
    console.log(` Client connected: ${socket.id}`);
    let currentSessionId = null;

    socket.on('startSession', async (data) => {
        try {
            const { playerName = 'Player', difficulty = 1 } = data || {};
            const validDifficulty = Math.max(1, Math.min(5, difficulty || 1));
            
            const session = new GameSession(playerName, validDifficulty);
            questionService.preCacheQuestions(validDifficulty, 10);
            
            sessions.set(session.sessionId, session);
            currentSessionId = session.sessionId;

            socket.emit('sessionStarted', {
                success: true,
                sessionId: session.sessionId,
                gameState: session.getSummary()
            });

            sendQuestion(socket, session);
        } catch (error) {
            console.error('Error starting session:', error);
            socket.emit('error', { message: 'Failed to start session' });
        }
    });

    socket.on('submitAnswer', async (data) => {
        try {
            const { sessionId, answer } = data;
            
            if (!sessionId || !sessions.has(sessionId)) {
                socket.emit('error', { message: 'Invalid session' });
                return;
            }

            const session = sessions.get(sessionId);
            
            if (!session.isActive) {
                socket.emit('error', { message: 'Session is no longer active' });
                return;
            }

            const isCorrect = Number(answer) === Number(session.currentQuestion?.answer);
            const responseTime = data.responseTime || 1000;

            const scoreResult = scoringService.calculateScore(
                isCorrect,
                responseTime,
                session.streak,
                session.difficulty
            );

            session.updateStats(
                isCorrect,
                responseTime,
                scoreResult.scoreEarned,
                scoreResult.xpEarned
            );

            const levelUpResult = scoringService.checkLevelUp(session.xp, session.level);
            if (levelUpResult.leveledUp) {
                session.level = levelUpResult.newLevel;
            }

            
            if (!session.isGameOver) {
                session.adjustDifficulty();
            }

            socket.emit('answerResult', {
                success: true,
                isCorrect: isCorrect,
                scoreEarned: scoreResult.scoreEarned,
                xpEarned: scoreResult.xpEarned,
                newScore: session.score,
                newXP: session.xp,
                newLevel: session.level,
                levelUp: levelUpResult.leveledUp,
                newDifficulty: session.difficulty,
                streak: session.streak,
                totalQuestions: session.totalQuestions,
                correctAnswers: session.correctAnswers,
                accuracy: Math.round(session.accuracy * 100) / 100,
                bonusBreakdown: scoreResult.bonusBreakdown,
                ropePosition: session.ropePosition,
                isGameOver: session.isGameOver,
                playerWon: session.playerWon,
                gameOverReason: session.gameOverReason
            });

            
            if (!session.isGameOver) {
                sendQuestion(socket, session);
            }

        } catch (error) {
            console.error('Error processing answer:', error);
            socket.emit('error', { message: 'Failed to process answer' });
        }
    });

    socket.on('getQuestion', async (data) => {
        try {
            const { sessionId } = data || {};
            
            if (!sessionId || !sessions.has(sessionId)) {
                socket.emit('error', { message: 'Invalid session' });
                return;
            }

            const session = sessions.get(sessionId);

            if (session.isGameOver) {
                socket.emit('error', { message: 'Session has already ended' });
                return;
            }

            sendQuestion(socket, session);

        } catch (error) {
            console.error('Error getting question:', error);
            socket.emit('error', { message: 'Failed to get question' });
        }
    });

    socket.on('getStatus', async (data) => {
        try {
            const { sessionId } = data || {};
            
            if (!sessionId || !sessions.has(sessionId)) {
                socket.emit('error', { message: 'Invalid session' });
                return;
            }

            const session = sessions.get(sessionId);
            socket.emit('sessionStatus', {
                success: true,
                session: session.getSummary()
            });

        } catch (error) {
            console.error('Error getting status:', error);
            socket.emit('error', { message: 'Failed to get status' });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });

    function sendQuestion(socket, session) {
        const question = questionService.getQuestion(session.difficulty);
        const questionData = question.toJSON();
        session.currentQuestion = questionData;

        socket.emit('newQuestion', {
            success: true,
            questionId: questionData.id || 1,
            operandA: questionData.operand1 || 0,
            operandB: questionData.operand2 || 0,
            operation: questionData.operation || '+',
            text: questionData.text || '0 + 0 = ?',
            answer: questionData.answer || 0,
            difficulty: session.difficulty,
            currentScore: session.score,
            questionNumber: session.totalQuestions + 1
        });
    }
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.url}`
    });
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

server.listen(PORT, () => {
    console.log(`Math Tug-of-War Backend Server is running on port ${PORT}`);
    console.log(`REST API available at http://localhost:${PORT}/api`);
    console.log(`Health check at http://localhost:${PORT}/health`);
    console.log(`Socket.IO server is ready`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Started at: ${new Date().toISOString()}`);
});