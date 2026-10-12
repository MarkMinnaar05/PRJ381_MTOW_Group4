const crypto = require('crypto');
const { Matchmaker } = require('../services/Matchmaker');
const { MtowMatch } = require('./MtowMatch');
const { PlayerStore } = require('./PlayerStore');

const TICK_MS = 100;

function clean(value, fallback, max) {
    const s = typeof value === 'string' ? value.trim() : '';
    return (s || fallback).slice(0, max);
}

function payloadOf(data) {
    if (typeof data === 'string') {
        try { return JSON.parse(data || '{}'); } catch { return {}; }
    }
    return data || {};
}

function registerMtow(io, { store = new PlayerStore(), matchmaker = new Matchmaker(), recorder = null } = {}) {
    const matches = new Map();      
    const matchOfSocket = new Map();
    const completed = new Set(); 

    const sendTo = (socketId, method, payload) => io.to(socketId).emit('Receive' + method, payload);

    let last = Date.now();
    const timer = setInterval(() => {
        const now = Date.now();
        const delta = (now - last) / 1000;
        last = now;
        for (const match of matches.values()) {
            match.tick(delta);
            if (match.isOver) forget(match);
        }
    }, TICK_MS);
    timer.unref();

    function forget(match) {
        if (match.completion) {
            completed.add(match.completion);
            match.completion.finally(() => completed.delete(match.completion)).catch(() => {});
        }
        matches.delete(match.matchId);
        for (const seat of match.seats) {
            if (matchOfSocket.get(seat.id) === match) matchOfSocket.delete(seat.id);
        }
    }

    function startMatch(mode, cpuLevel, players) {
        const match = new MtowMatch({
            matchId: crypto.randomUUID(),
            mode,
            cpuLevel,
            seats: players.map(p => ({ id: p.socketId, name: p.name, avatarId: p.avatarId, playerId: p.playerId, classId: p.classId })),
            send: (socketId, method, payload) => {
                if (method === 'MatchEnded' && store.authoritative) {
                    const playerId = players.find(p => p.socketId === socketId).playerId;
                    return store.addMatch(playerId, { ...payload, mode, endedAt: new Date().toISOString() })
                        .then(() => sendTo(socketId, method, payload))
                        .catch(() => sendTo(socketId, 'Error', { code: 'database_error', message: 'Could not save match history' }));
                } else sendTo(socketId, method, payload);
            },
            onChange: recorder ? (match, answer) => recorder.record(match, answer) : null,
            award: (socketId, xp, matchId) => {
                const p = players.find(p => p.socketId === socketId);
                return store.authoritative ? store.awardMatch(p.playerId, matchId, xp) : store.addXp(p.playerId, xp);
            }
        });
        matches.set(match.matchId, match);
        for (const p of players) matchOfSocket.set(p.socketId, match);
        match.begin();
        console.log(`[mtow] ${mode} match ${match.matchId}: ${players.map(p => p.name).join(' vs ')}`);
        return match;
    }

    io.on('connection', (socket) => {
        const identity = socket.data.identity;
        const auth = identity ? { playerId: identity.id, name: identity.name, classId: identity.classId } : (socket.handshake.auth || {});
        const me = {
            socketId: socket.id,
            playerId: clean(auth.playerId, socket.id, 64),
            name: clean(auth.name, 'Player', 24),
            classId: clean(auth.classId, 'PUBLIC', 32).toUpperCase(),
            avatarId: clean(auth.avatarId, '', 32)
        };
        const send = (method, payload) => socket.emit('Receive' + method, payload);
        // Await player writes in event order; a following read sees the saved profile.
        let pending = Promise.resolve();
        const on = (event, action) => socket.on(event, data => {
            pending = pending.then(() => action(data)).catch(() => send('Error', { code: 'database_error', message: 'Could not save or load player data' }));
        });
        const current = () => matchOfSocket.get(socket.id) || null;
        const currentMatch = (data) => {
            const match = current();
            return match && payloadOf(data).matchId === match.matchId ? match : null;
        };


        on('getPlayerInfo', async () => {
            const info = await store.get(me.playerId, me.name, me.classId);
            me.name = info.nickname;
            me.avatarId = info.avatarId || me.avatarId;
            send('PlayerInfo', info);
        });

        on('savePlayerInfo', async (data) => {
            await store.get(me.playerId, me.name, me.classId);
            await store.update(me.playerId, payloadOf(data));
            const info = await store.get(me.playerId);
            me.name = info.nickname;
            me.avatarId = info.avatarId;
        });

        on('saveMatchHistory', data => store.authoritative ? undefined : store.addMatch(me.playerId, payloadOf(data))); // Production history comes from the server, not client scores.

        on('getMatchHistory', async (data) => {
            const limit = Math.max(1, Math.min(50, Number(payloadOf(data).limit) || 20));
            send('MatchHistory', await store.history(me.playerId, limit));
        });

        
        socket.on('matchInfo', (data) => console.log('[mtow] matchInfo', payloadOf(data)));

        
        on('joinQueue', async () => {
            await store.get(me.playerId, me.name, me.classId);
            if (current()) return;
            let result = matchmaker.enqueue({ ...me, mode: 'pvp' });
            while (result.match && !io.sockets.sockets.get(result.match.socketId)) {
                result = matchmaker.enqueue({ ...me, mode: 'pvp' });
            }
            if (result.replaced) {
                sendTo(result.replaced.socketId, 'Error', { code: 'replaced', message: 'You started a game in another window.' });
            }
            if (result.match) startMatch('pvp', 0, [result.match, me]);
            else send('QueueStatus', { state: 'searching', elapsedSeconds: 0 });
        });

        socket.on('cancelQueue', () => {
            if (matchmaker.remove(socket.id)) send('QueueStatus', { state: 'cancelled', elapsedSeconds: 0 });
        });


        on('startCpuMatch', async (data) => {
            await store.get(me.playerId, me.name, me.classId);
            if (current()) return;
            matchmaker.remove(socket.id);
            const cpuLevel = Math.max(1, Math.min(3, Number(payloadOf(data).cpuLevel) || 2));
            startMatch('cpu', cpuLevel, [me]);
        });

        socket.on('readyForMatch', (data) => {
            const match = currentMatch(data);
            if (match) match.ready(socket.id);
        });

        socket.on('submitAnswer', (data) => {
            const match = current();
            if (match) match.answer(socket.id, payloadOf(data));
        });

        socket.on('cpuAnswer', (data) => {
            const match = currentMatch(data);
            if (match) match.cpuAnswer(socket.id, payloadOf(data));
        });

        socket.on('leaveMatch', (data) => {
            const match = currentMatch(data);
            if (!match) return;
            match.leave(socket.id, 'forfeit');
            forget(match);
        });

        socket.on('disconnect', () => {
            matchmaker.remove(socket.id);
            const match = current();
            if (!match) return;
            match.leave(socket.id, 'disconnect');
            forget(match);
        });
    });

    return { matches, stop: () => clearInterval(timer), flush: async () => { await Promise.all([...completed]); } };
}

module.exports = { registerMtow };
