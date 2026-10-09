// Integration tests for automatic matchmaking. Spawns the real server on a
// spare port and drives it with real Socket.IO clients.
//
//   cd backend && npm test

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { io } = require('socket.io-client');

const PORT = 3457;
const URL = `http://localhost:${PORT}`;
let server;
const open = [];

before(async () => {
    server = spawn(process.execPath, ['server.js'], {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, PORT: String(PORT) },
        stdio: ['ignore', 'pipe', 'inherit']
    });
    await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('server did not start')), 8000);
        server.stdout.on('data', d => {
            if (String(d).includes('running on port')) { clearTimeout(t); resolve(); }
        });
        server.on('exit', c => reject(new Error(`server exited early (${c})`)));
    });
});

after(() => {
    for (const s of open) s.close();
    if (server) server.kill();
});

function connect() {
    return new Promise((resolve, reject) => {
        const s = io(URL, { transports: ['websocket'], forceNew: true });
        open.push(s);
        s.on('connect', () => resolve(s));
        s.on('connect_error', reject);
    });
}

// Resolve with the parsed payload of the next `event`. Register BEFORE emitting.
function next(socket, event, ms = 2000) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), ms);
        socket.once(event, d => {
            clearTimeout(t);
            resolve(typeof d === 'string' ? tryParse(d) : d);
        });
    });
}

function tryParse(s) { try { return JSON.parse(s); } catch { return s; } }

// Resolve only if `event` does NOT arrive within ms.
function never(socket, event, ms = 400) {
    return new Promise((resolve, reject) => {
        const h = () => reject(new Error(`unexpected "${event}"`));
        socket.once(event, h);
        setTimeout(() => { socket.off(event, h); resolve(); }, ms);
    });
}

const kid = (name, classId, extra = {}) => JSON.stringify({ name, classId, mode: 'classic', ...extra });

test('two players in the same class are paired automatically', async () => {
    const a = await connect();
    const b = await connect();

    const aQueued = next(a, 'queue_joined');
    a.emit('find_match', kid('Alice', 'SUN-3B'));
    const queued = await aQueued;
    assert.equal(queued.success, true);
    assert.equal(queued.classId, 'SUN-3B');

    const aFound = next(a, 'match_found');
    const bFound = next(b, 'match_found');
    b.emit('find_match', kid('Bob', 'SUN-3B'));
    const [ma, mb] = await Promise.all([aFound, bFound]);

    assert.equal(ma.roomId, mb.roomId);
    assert.equal(ma.youId, a.id);
    assert.equal(mb.youId, b.id);
    assert.equal(ma.youSide, 1, 'first to queue is the host side');
    assert.equal(mb.youSide, -1);
    assert.equal(ma.gameState.players.length, 2);
    assert.deepEqual(ma.gameState.players.map(p => p.name).sort(), ['Alice', 'Bob']);
    assert.ok(ma.gameState.currentQuestion, 'first question is included');
    assert.equal(ma.gameState.ropePosition, 0);
});

test('kids in different classes are never paired', async () => {
    const a = await connect();
    const b = await connect();

    a.emit('find_match', kid('Ann', 'CLASS-A'));
    await next(a, 'queue_joined');

    const noMatchA = never(a, 'match_found');
    const noMatchB = never(b, 'match_found');
    b.emit('find_match', kid('Ben', 'CLASS-B'));
    await Promise.all([noMatchA, noMatchB]);

    // ...but a second kid from Ann's class does get her.
    const c = await connect();
    const aFound = next(a, 'match_found');
    c.emit('find_match', kid('Cat', 'CLASS-A'));
    const found = await aFound;
    assert.deepEqual(found.gameState.players.map(p => p.name).sort(), ['Ann', 'Cat']);
});

test('cancel_match takes a player out of the queue', async () => {
    const a = await connect();
    const b = await connect();

    a.emit('find_match', kid('Quitter', 'CANCEL-1'));
    await next(a, 'queue_joined');
    const left = next(a, 'queue_left');
    a.emit('cancel_match');
    await left;

    const noMatch = never(b, 'match_found');
    b.emit('find_match', kid('Stayer', 'CANCEL-1'));
    await noMatch;
});

test('the same account in two windows never plays itself', async () => {
    const a1 = await connect();
    const a2 = await connect();

    a1.emit('find_match', kid('Dana', 'SAME-1', { playerId: 'kid-42' }));
    await next(a1, 'queue_joined');

    const kicked = next(a1, 'error_msg');
    const noMatch = never(a2, 'match_found');
    a2.emit('find_match', kid('Dana', 'SAME-1', { playerId: 'kid-42' }));
    await Promise.all([kicked, noMatch]);
});

test('a full round: answers score, move the rope and reach both players', async () => {
    const a = await connect();
    const b = await connect();

    a.emit('find_match', kid('Host', 'ROUND-1'));
    await next(a, 'queue_joined');
    const aFound = next(a, 'match_found');
    const bFound = next(b, 'match_found');
    b.emit('find_match', kid('Guest', 'ROUND-1'));
    const [ma] = await Promise.all([aFound, bFound]);

    const answer = ma.gameState.currentQuestion.answer;
    const aUpdate = next(a, 'game_state_update');
    const bUpdate = next(b, 'game_state_update');
    a.emit('submit_answer', JSON.stringify({ roomId: ma.roomId, submittedAnswer: answer, responseTime: 800 }));
    const [ua, ub] = await Promise.all([aUpdate, bUpdate]);

    assert.equal(ua.isCorrect, true);
    assert.equal(ua.answeredBy, 'Host');
    assert.equal(ub.gameState.ropePosition, 0.1, 'host answering correctly pulls the rope toward the host');
    const host = ub.gameState.players.find(p => p.name === 'Host');
    assert.ok(host.score > 0, 'correct answer scores');
    assert.notEqual(ub.gameState.currentQuestion.id, ma.gameState.currentQuestion.id, 'fresh question after a correct answer');
});

test('if one player disconnects mid-game the other wins', async () => {
    const a = await connect();
    const b = await connect();

    a.emit('find_match', kid('Stays', 'LEAVE-1'));
    await next(a, 'queue_joined');
    const bFound = next(b, 'match_found');
    b.emit('find_match', kid('Leaves', 'LEAVE-1'));
    await bFound;

    const over = next(a, 'game_over');
    b.close();
    const result = await over;

    assert.equal(result.gameState.isGameOver, true);
    assert.equal(result.gameState.gameOverReason, 'opponent_left');
    assert.equal(result.gameState.winner.id, a.id);
});

test('a player who disconnects while queued is not matched later', async () => {
    const ghost = await connect();
    ghost.emit('find_match', kid('Ghost', 'GHOST-1'));
    await next(ghost, 'queue_joined');
    ghost.close();
    await new Promise(r => setTimeout(r, 200));

    const live = await connect();
    const noMatch = never(live, 'match_found');
    live.emit('find_match', kid('Live', 'GHOST-1'));
    await noMatch;
});
