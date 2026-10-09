// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { GameSession, sessions } = require('./src/models/GameSession');
const questionService = require('./src/services/QuestionService');
const scoringService = require('./src/services/ScoringService');
const { Matchmaker } = require('./src/services/Matchmaker');

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

// ---------------------------------------------------------------------------
// Automatic matchmaking. A player hits Play on the website, the client emits
// `find_match`, and the server pairs them with the longest-waiting classmate
// in the same class + mode. No room codes involved (the create_room /
// join_room / start_game events below still work but the game no longer uses
// them).
//
// NOTE: identity (name / classId / playerId) is taken from the client for now.
// Once accounts exist this is where a login token gets verified and classId is
// read from the student's record instead of trusted from the request.
// ---------------------------------------------------------------------------
const matchmaker = new Matchmaker();
const MATCH_DIFFICULTY = 2;

function cleanString(value, fallback, max) {
    const s = typeof value === 'string' ? value.trim() : '';
    return (s || fallback).slice(0, max);
}

function parseFindMatch(data) {
    const raw = typeof data === 'string' ? JSON.parse(data || '{}') : (data || {});
    return {
        playerId: raw.playerId ? cleanString(String(raw.playerId), '', 64) : undefined,
        name: cleanString(raw.name ?? raw.playerName, 'Player', 24),
        classId: cleanString(raw.classId ?? raw.class, 'PUBLIC', 32).toUpperCase(),
        mode: cleanString(raw.mode, 'classic', 24).toLowerCase()
    };
}

function createMatchSession(a, b) {
    const roomId = generateRoomCode();
    const session = new GameSession(roomId, a.socketId, a.name, MATCH_DIFFICULTY);
    session.addPlayer(b.socketId, b.name);
    session.currentQuestion = questionService.getQuestion(session.difficulty).toJSON();
    session.autoMatched = true;
    session.classId = a.classId;
    session.mode = a.mode;
    sessions.set(roomId, session);

    for (const entry of [a, b]) {
        const s = io.sockets.sockets.get(entry.socketId);
        s.join(roomId);
        // Sent per-socket (not to the room) so each client is told which player it is.
        s.emit('match_found', JSON.stringify({
            success: true,
            roomId: roomId,
            youId: entry.socketId,
            youSide: session.players[entry.socketId].side,
            gameState: session.getSummary()
        }));
    }
    console.log(`Match ${roomId} (${a.classId}/${a.mode}): ${a.name} vs ${b.name}`);
}

// A player left an auto-matched game that was still running: the one who is
// still here wins, and the room is torn down.
function endMatchOpponentLeft(roomId, session, leaverId) {
    const remaining = Object.values(session.players).find(p => p.id !== leaverId) || null;
    session.isGameOver = true;
    session.winner = remaining;
    session.gameOverReason = 'opponent_left';
    if (remaining) {
        io.to(roomId).emit('game_over', JSON.stringify({
            success: true,
            gameState: session.getSummary()
        }));
    }
    sessions.delete(roomId);
}

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('find_match', (data) => {
        try {
            const info = parseFindMatch(data);
            const entry = { socketId: socket.id, ...info };

            let result = matchmaker.enqueue(entry);
            // A queued opponent whose socket vanished a moment ago: skip to the next.
            while (result.match && !io.sockets.sockets.get(result.match.socketId)) {
                result = matchmaker.enqueue(entry);
            }

            if (result.replaced) {
                const old = io.sockets.sockets.get(result.replaced.socketId);
                if (old) old.emit('error_msg', 'You started a new game in another window.');
            }

            if (result.match) {
                createMatchSession(result.match, entry);
            } else {
                socket.emit('queue_joined', JSON.stringify({
                    success: true,
                    classId: info.classId,
                    mode: info.mode,
                    waiting: matchmaker.size(info.classId, info.mode)
                }));
                console.log(`${info.name} queued (${info.classId}/${info.mode})`);
            }
        } catch (error) {
            console.error('Error finding match:', error);
            socket.emit('error_msg', 'Failed to find a match');
        }
    });

    socket.on('cancel_match', () => {
        if (matchmaker.remove(socket.id)) {
            socket.emit('queue_left', JSON.stringify({ success: true }));
        }
    });

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
        matchmaker.remove(socket.id);
        for (const [roomId, session] of sessions.entries()) {
            if (session.players && session.players[socket.id]) {
                if (session.autoMatched && !session.isGameOver) {
                    endMatchOpponentLeft(roomId, session, socket.id);
                    break;
                }
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