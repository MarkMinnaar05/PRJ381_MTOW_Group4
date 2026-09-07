// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { GameSession, sessions } = require('./src/models/GameSession');
const questionService = require('./src/services/QuestionService');
const scoringService = require('./src/services/ScoringService');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;


function generateRoomCode() {
    let code;
    do {
        code = Math.random().toString(36).substring(2, 6).toUpperCase();
    } while (sessions.has(code));
    return code;
}

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    
    socket.on('create_room', (data) => {
        try {
            const { playerName = 'Host', difficulty = 1 } = JSON.parse(data || '{}');
            const roomId = generateRoomCode();
            const validDifficulty = Math.max(1, Math.min(5, difficulty || 1));

            const session = new GameSession(roomId, socket.id, playerName, validDifficulty);
            questionService.preCacheQuestions(validDifficulty, 10);

            sessions.set(roomId, session);
            socket.join(roomId);

            socket.emit('room_created', JSON.stringify({
                success: true,
                roomId: roomId,
                gameState: session.getSummary()
            }));
            console.log(`Room created: ${roomId} by ${playerName}`);
        } catch (error) {
            console.error('Error creating room:', error);
            socket.emit('error_msg', 'Failed to create room');
        }
    });


    socket.on('join_room', (data) => {
        try {
            const { roomId, playerName = 'Guest' } = JSON.parse(data || '{}');
            const session = sessions.get(roomId);

            if (!session) {
                socket.emit('error_msg', 'Room not found');
                return;
            }
            if (session.isGameOver) {
                socket.emit('error_msg', 'Game already over');
                return;
            }

            const added = session.addPlayer(socket.id, playerName);
            if (!added) {
                socket.emit('error_msg', 'Room is full');
                return;
            }

            socket.join(roomId);
            io.to(roomId).emit('player_joined', JSON.stringify({
                success: true,
                gameState: session.getSummary()
            }));
            console.log(`${playerName} joined room ${roomId}`);
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error_msg', 'Failed to join room');
        }
    });

  
    socket.on('start_game', (roomId) => {
        const session = sessions.get(roomId);
        if (session && session.hostId === socket.id) {
            const question = questionService.getQuestion(session.difficulty);
            session.currentQuestion = question.toJSON();

            io.to(roomId).emit('game_started', JSON.stringify({
                success: true,
                gameState: session.getSummary()
            }));
        }
    });

  
    socket.on('submit_answer', (data) => {
        try {
            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
            const { roomId, submittedAnswer, responseTime = 1000 } = parsedData;

            const session = sessions.get(roomId);
            if (!session || session.isGameOver) return;

            const player = session.players[socket.id];
            if (!player) return;

            const isCorrect = Number(submittedAnswer) === Number(session.currentQuestion?.answer);

            const scoreResult = scoringService.calculateScore(
                isCorrect,
                responseTime,
                player.streak,
                session.difficulty
            );

           
            session.processAnswer(socket.id, isCorrect, scoreResult.scoreEarned, scoreResult.xpEarned);

            const levelUpResult = scoringService.checkLevelUp(player.xp, player.level);
            if (levelUpResult.leveledUp) {
                player.level = levelUpResult.newLevel;
            }

            if (!session.isGameOver) {
                session.adjustDifficulty();
            }

            if (session.isGameOver) {
                io.to(roomId).emit('game_over', JSON.stringify({
                    success: true,
                    gameState: session.getSummary()
                }));
                sessions.delete(roomId);
            } else {
    
                if (isCorrect) {
                    const nextQ = questionService.getQuestion(session.difficulty);
                    session.currentQuestion = nextQ.toJSON();
                }

                io.to(roomId).emit('game_state_update', JSON.stringify({
                    success: true,
                    isCorrect: isCorrect,
                    answeredBy: player.name,
                    gameState: session.getSummary()
                }));
            }
        } catch (error) {
            console.error('Error processing answer:', error);
            socket.emit('error_msg', 'Failed to process answer');
        }
    });

    
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        for (const [roomId, session] of sessions.entries()) {
            if (session.players && session.players[socket.id]) {
                session.removePlayer(socket.id);
                if (!session.isActive) {
                    sessions.delete(roomId);
                } else {
                    io.to(roomId).emit('player_left', JSON.stringify({
                        success: true,
                        gameState: session.getSummary()
                    }));
                }
                break;
            }
        }
    });
});

app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});

server.listen(PORT, () => {
    console.log(`Multiplayer Tug-of-War Server running on port ${PORT}`);
});