const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');

const PORT = 3458;
const URL = `http://localhost:${PORT}`;
const DATA_FILE = path.join(os.tmpdir(), `mtow-test-${process.pid}.json`);
let server;
const open = [];

before(async () => {
    server = spawn(process.execPath, ['server.js'], {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, PORT: String(PORT), MTOW_DATA_FILE: DATA_FILE },
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
    fs.rmSync(DATA_FILE, { force: true });
});

function connect(auth) {
    return new Promise((resolve, reject) => {
        const s = io(URL, { transports: ['websocket'], forceNew: true, auth });
        open.push(s);
        s.on('connect', () => resolve(s));
        s.on('connect_error', reject);
    });
}

function next(socket, event, match = () => true, ms = 20000) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), ms);
        const handler = (payload) => {
            if (!match(payload)) return;
            clearTimeout(t);
            socket.off(event, handler);
            resolve(payload);
        };
        socket.on(event, handler);
    });
}

const solve = q => (q.operation === '+' ? q.operandA + q.operandB : q.operandA - q.operandB);

test('player info is created on first visit and keeps the nickname', async () => {
    const s = await connect({ playerId: 'p-info', name: 'Ann' });
    s.emit('getPlayerInfo', {});
    const info = await next(s, 'ReceivePlayerInfo');
    assert.deepEqual(info, { playerId: 'p-info', nickname: 'Ann', avatarId: '', level: 1, totalXp: 0 });

    s.emit('savePlayerInfo', { nickname: 'Annie', avatarId: 'fox' });
    s.emit('getPlayerInfo', {});
    const updated = await next(s, 'ReceivePlayerInfo');
    assert.equal(updated.nickname, 'Annie');
    assert.equal(updated.avatarId, 'fox');
});

test('queue sends searching, then cancelled', async () => {
    const s = await connect({ playerId: 'p-queue', name: 'Q', classId: 'SOLO-1' });
    s.emit('joinQueue', {});
    assert.equal((await next(s, 'ReceiveQueueStatus')).state, 'searching');
    s.emit('cancelQueue', {});
    assert.equal((await next(s, 'ReceiveQueueStatus')).state, 'cancelled');
});

test('CPU match: wrong answer, CPU point, then win by rope with XP and missed questions', async () => {
    const s = await connect({ playerId: 'p-cpu', name: 'Ben' });
    s.emit('startCpuMatch', { cpuLevel: 2 });
    const found = await next(s, 'ReceiveMatchFound');
    assert.equal(found.mode, 'cpu');
    assert.equal(found.opponentNickname, 'Robo');

    s.emit('readyForMatch', { matchId: found.matchId });
    const started = await next(s, 'ReceiveMatchStarted');
    assert.equal(started.matchId, found.matchId);
    assert.equal(started.durationSeconds, 60);

    let q = await next(s, 'ReceiveQuestion');
    assert.ok(['+', '-'].includes(q.operation));
    assert.ok(solve(q) >= 0);
    s.emit('submitAnswer', { questionId: q.questionId, submittedAnswer: solve(q) + 1, responseTimeMs: 2000 });
    let state = await next(s, 'ReceiveGameState', g => g.lastAnswer.by === 'player');
    assert.equal(state.lastAnswer.isCorrect, false);
    assert.ok(Math.abs(state.ropePosition + 0.1) < 1e-9);

    q = await next(s, 'ReceiveQuestion');
    s.emit('cpuAnswer', { matchId: found.matchId, questionId: q.questionId, isCorrect: true, responseTimeMs: 3000 });
    state = await next(s, 'ReceiveGameState', g => g.lastAnswer.by === 'opponent');
    assert.ok(state.opponentScore > 0);
    assert.ok(Math.abs(state.ropePosition + 0.2) < 1e-9);

    const ended = next(s, 'ReceiveMatchEnded');
    const answerAll = async () => {
        for (;;) {
            const question = await next(s, 'ReceiveQuestion');
            s.emit('submitAnswer', { questionId: question.questionId, submittedAnswer: solve(question), responseTimeMs: 0 });
        }
    };
    answerAll().catch(() => {});
    const result = await ended;
    assert.equal(result.result, 'win');
    assert.equal(result.reason, 'rope');
    assert.equal(result.missedQuestions.length, 1);
    assert.equal(result.xpEarned, result.score);
    assert.equal(result.totalXp, result.score);
    assert.ok(result.correctAnswers >= 8);
});

test('PvP: classmates are paired, see mirrored ropes, and a quitter loses', async () => {
    const a = await connect({ playerId: 'p-a', name: 'Alice', classId: 'SUN-3B' });
    const b = await connect({ playerId: 'p-b', name: 'Bob', classId: 'SUN-3B' });

    a.emit('joinQueue', {});
    await next(a, 'ReceiveQueueStatus');
    const foundA = next(a, 'ReceiveMatchFound');
    const foundB = next(b, 'ReceiveMatchFound');
    b.emit('joinQueue', {});
    const [fa, fb] = await Promise.all([foundA, foundB]);
    assert.equal(fa.matchId, fb.matchId);
    assert.equal(fa.mode, 'pvp');
    assert.equal(fa.opponentNickname, 'Bob');
    assert.equal(fb.opponentNickname, 'Alice');

    a.emit('readyForMatch', { matchId: fa.matchId });
    const startedB = next(b, 'ReceiveMatchStarted');
    b.emit('readyForMatch', { matchId: fb.matchId });
    await startedB;

    const qa = await next(a, 'ReceiveQuestion');
    const stateA = next(a, 'ReceiveGameState', g => g.lastAnswer.by !== '');
    const stateB = next(b, 'ReceiveGameState', g => g.lastAnswer.by !== '');
    a.emit('submitAnswer', { questionId: qa.questionId, submittedAnswer: solve(qa), responseTimeMs: 1000 });
    const [sa, sb] = await Promise.all([stateA, stateB]);
    assert.equal(sa.lastAnswer.by, 'player');
    assert.equal(sb.lastAnswer.by, 'opponent');
    assert.ok(Math.abs(sa.ropePosition - 0.1) < 1e-9);
    assert.ok(Math.abs(sb.ropePosition + 0.1) < 1e-9);
    assert.equal(sa.playerScore, sb.opponentScore);

    const endA = next(a, 'ReceiveMatchEnded');
    const endB = next(b, 'ReceiveMatchEnded');
    a.emit('leaveMatch', { matchId: fa.matchId });
    const [ea, eb] = await Promise.all([endA, endB]);
    assert.equal(ea.result, 'lose');
    assert.equal(eb.result, 'win');
    assert.equal(eb.reason, 'forfeit');
});

test('match history is saved once per match and comes back newest first after reconnecting', async () => {
    const s = await connect({ playerId: 'p-history', name: 'H' });
    s.emit('saveMatchHistory', { matchId: 'm1', mode: 'cpu', result: 'win', score: 10, missedQuestions: [] });
    s.emit('saveMatchHistory', { matchId: 'm2', mode: 'pvp', result: 'lose', score: 5, missedQuestions: [{ operandA: 3, operandB: 4, operation: '+', correctAnswer: 7, submittedAnswer: 6 }] });
    s.emit('saveMatchHistory', { matchId: 'm2', mode: 'pvp', result: 'lose', score: 5, missedQuestions: [] });
    s.emit('getPlayerInfo', {});
    await next(s, 'ReceivePlayerInfo');
    s.close();

    const again = await connect({ playerId: 'p-history', name: 'H' });
    again.emit('getMatchHistory', { limit: 20 });
    const history = await next(again, 'ReceiveMatchHistory');
    assert.deepEqual(history.matches.map(m => m.matchId), ['m2', 'm1']);
    assert.equal(history.matches[0].missedQuestions.length, 1);
    assert.equal(history.matches[0].playerId, 'p-history');
});
