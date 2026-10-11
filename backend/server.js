// server.js
require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
const { connectDatabase } = require('./src/config/database');
const { AuthService } = require('./src/database/AuthService');
const { MongoPlayerStore } = require('./src/database/MongoPlayerStore');
const { ApiGameService } = require('./src/database/ApiGameService');
const { MatchRecorder } = require('./src/database/MatchRecorder');
const { LegacyRecorder } = require('./src/database/LegacyRecorder');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const { GameSession, sessions } = require('./src/models/GameSession');
const questionService = require('./src/services/QuestionService');
const scoringService = require('./src/services/ScoringService');
const { Matchmaker } = require('./src/services/Matchmaker');
const { registerMtow } = require('./src/mtow/registerMtow');

function createApplication(db) {
const app = express();
const players = new MongoPlayerStore(db);
const auth = new AuthService(db);
const recorder = new MatchRecorder(db);
const legacy = new LegacyRecorder(db, players);
app.locals.db = db;
app.locals.players = players;
app.locals.auth = auth;
app.locals.games = new ApiGameService(db, players);
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));

app.use(express.json({ limit: '32kb' }));
app.use('/api/analytics', require('./src/routes/analytics'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' } });
io.use((socket, next) => {
    auth.authenticate(socket.handshake.auth?.token).then(user => {
        socket.data.identity = user;
        next();
    }).catch(() => next(new Error('Sign in again')));
});
const mtow = registerMtow(io, { store: players, recorder });
app.use('/api', require('./src/routes/api'));

const PORT = process.env.PORT || 3000;


function generateRoomCode() {
    let code;
    do {
        code = Math.random().toString(36).substring(2, 6).toUpperCase();
    } while (sessions.has(code));
    return code;
}

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
        Object.assign(session.players[entry.socketId], { playerId: entry.playerId, classId: entry.classId, totalQuestions: 0, correctAnswers: 0, responseTotal: 0 });
    }
    legacy.capture(session);

    for (const entry of [a, b]) {
        const s = io.sockets.sockets.get(entry.socketId);
        s.join(roomId);
        
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
    legacy.capture(session);
    sessions.delete(roomId);
}

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('find_match', (data) => {
        try {
            const info = parseFindMatch(data);
            const entry = { socketId: socket.id, ...info, playerId: socket.data.identity.id, name: socket.data.identity.name, classId: socket.data.identity.classId };

            let result = matchmaker.enqueue(entry);
            
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
                    classId: entry.classId,
                    mode: info.mode,
                    waiting: matchmaker.size(entry.classId, entry.mode)
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
            const { difficulty = 1 } = JSON.parse(data || '{}');
            const playerName = socket.data.identity.name;
            const roomId = generateRoomCode();
            const validDifficulty = Math.max(1, Math.min(5, difficulty || 1));

            const session = new GameSession(roomId, socket.id, playerName, validDifficulty);
            questionService.preCacheQuestions(validDifficulty, 10);

            Object.assign(session.players[socket.id], { playerId: socket.data.identity.id, classId: socket.data.identity.classId, totalQuestions: 0, correctAnswers: 0, responseTotal: 0 });
            sessions.set(roomId, session);
            legacy.capture(session);
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
            const { roomId } = JSON.parse(data || '{}');
            const playerName = socket.data.identity.name;
            const session = sessions.get(roomId);

            if (!session) {
                socket.emit('error_msg', 'Room not found');
                return;
            }
            if (Object.values(session.players)[0]?.classId !== socket.data.identity.classId) {
                socket.emit('error_msg', 'Room not found'); return;
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

            Object.assign(session.players[socket.id], { playerId: socket.data.identity.id, classId: socket.data.identity.classId, totalQuestions: 0, correctAnswers: 0, responseTotal: 0 });
            legacy.capture(session);
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
            legacy.capture(session);

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

            if (!session.currentQuestion || !Number.isFinite(Number(submittedAnswer)) || submittedAnswer === null || String(submittedAnswer ?? "").trim() === "") return;
            const answeredQuestion = session.currentQuestion;
            const isCorrect = Number(submittedAnswer) === Number(session.currentQuestion?.answer);

            const scoreResult = scoringService.calculateScore(
                isCorrect,
                responseTime,
                player.streak,
                session.difficulty
            );

           
            session.processAnswer(socket.id, isCorrect, scoreResult.scoreEarned, scoreResult.xpEarned);
            player.totalQuestions = (player.totalQuestions || 0) + 1;
            player.correctAnswers = (player.correctAnswers || 0) + (isCorrect ? 1 : 0);
            player.responseTotal = (player.responseTotal || 0) + Math.max(0, Number(responseTime) || 0);
            player.bestStreak = Math.max(player.bestStreak || 0, player.streak);
            legacy.capture(session, answeredQuestion, player, submittedAnswer, isCorrect, responseTime, scoreResult.scoreEarned);
            session.currentQuestion = null;

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
    
                {
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

app.use('/frontend', express.static(path.join(__dirname, '..', 'frontend')));
app.get('/', (_req, res) => res.redirect('/frontend/index.html'));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});

app.use((error, _req, res, _next) => {
    const status = error.status || (error.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error(`[API] ${error.name}`);
    res.status(status).json({ success: false, error: status >= 500 ? 'Database or server request failed' : error.message });
});
return { app, io, server, recorder, legacy, stop: async () => {
    mtow.stop();
    await new Promise(resolve => io.close(resolve));
    await Promise.all([recorder.flush(), legacy.flush(), mtow.flush()]);
    sessions.clear();
} };
}

async function main() {
    let connection;
    try {
        connection = await connectDatabase();
        const runtime = createApplication(connection.db);
        const port = Number(process.env.PORT || 3000);
        await new Promise((resolve, reject) => {
            runtime.server.once('error', reject);
            runtime.server.listen(port, resolve);
        });
        console.log(`MongoDB connected: ${connection.db.databaseName}`);
        console.log(`Multiplayer Tug-of-War Server running on port ${port}`);
        console.log(`Open http://localhost:${port}/frontend/index.html`);
        let stopping = false;
        const stop = async () => {
            if (stopping) return; stopping = true;
            try { await runtime.stop(); } finally { await connection.client.close(); }
        };
        process.once('SIGINT', () => stop().then(() => process.exit(0)));
        process.once('SIGTERM', () => stop().then(() => process.exit(0)));
    } catch (error) {
        console.error(`Startup failed (${error.name}). Check backend/.env, Atlas IP access, and your network.`);
        if (error.reason?.servers) for (const server of error.reason.servers.values()) {
            const cause = server.error?.cause?.code || server.error?.code;
            if (cause) console.error(`Connection cause: ${cause}`);
        }
        if (connection) await connection.client.close();
        process.exitCode = 1;
    }
}
if (require.main === module) main();
module.exports = { createApplication };
