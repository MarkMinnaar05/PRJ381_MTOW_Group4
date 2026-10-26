const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const net = require('node:net');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { io } = require('socket.io-client');
const { connectDatabase } = require('../src/config/database');
const { createApplication } = require('../server');
const { safeMessage, errorDetails } = require('../src/config/connectionDiagnostics');

function receive(socket, event, predicate = () => true) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { socket.off(event, listener); reject(new Error('Timed out: ' + event)); }, 15000);
        function listener(value) {
            if (!predicate(value)) return;
            clearTimeout(timer);
            socket.off(event, listener);
            resolve(value);
        }
        socket.on(event, listener);
    });
}

function runScript(file, args, env) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [file, ...args], { cwd: path.join(__dirname, '..'), env: { ...process.env, ...env } });
        let output = '';
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error(file + ' timed out. Captured output:\n' + (output || '(no output)')));
        }, 20000);
        child.stdout.on('data', chunk => { output += chunk; });
        child.stderr.on('data', chunk => { output += chunk; });
        child.on('error', error => { clearTimeout(timer); reject(error); });
        child.on('close', code => { clearTimeout(timer); resolve({ code, output }); });
    });
}

test('connection diagnostics redact credentials including nested topology errors', () => {
    const uri = 'mongodb+srv://developer:Synthetic%40Secret@sample.mongodb.net/';
    const message = `Failed ${uri} with Synthetic@Secret and Synthetic%40Secret`;
    const safe = safeMessage(message, uri);
    assert.doesNotMatch(safe, /Synthetic|developer|mongodb\+srv:\/\//);
    const root = new Error('Connection failed');
    root.reason = { servers: new Map([['host', { error: Object.assign(new Error(message), { code: 'TLS_TEST' }) }]]) };
    const details = errorDetails(root, uri).join('\n');
    assert.match(details, /TLS_TEST/);
    assert.doesNotMatch(details, /Synthetic|developer/);
});

test('team class dashboard, practice XP, real socket PvP, restart, expiry and startup diagnostics', { timeout: 90000 }, async () => {
    const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { args: [...(process.platform === 'win32' ? [] : ['--nounixsocket']), '--wiredTigerCacheSizeGB', '0.25'] } });
    const connection = await connectDatabase(mongo.getUri(), 'team_access_test');
    let runtime;
    let base;
    const sockets = [];
    async function boot() {
        runtime = createApplication(connection.db);
        await new Promise(resolve => runtime.server.listen(0, '127.0.0.1', resolve));
        base = 'http://127.0.0.1:' + runtime.server.address().port;
    }
    async function api(route, token, method = 'GET', body) {
        const response = await fetch(base + '/api' + route, { method,
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}) });
        const data = await response.json();
        assert.equal(response.ok, true, JSON.stringify(data));
        return data;
    }
    function browser(identity, replacementFetch = fetch) {
        const storage = new Map();
        const context = { window: {}, location: { origin: base }, fetch: replacementFetch,
            localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } };
        vm.createContext(context);
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../../frontend/api-client.js'), 'utf8'), context);
        if (identity) context.window.MTOWApi.saveAuth(identity);
        return { client: context.window.MTOWApi, storage };
    }
    await boot();
    try {
        const teacher = await api('/auth/register', null, 'POST', { name: 'Class teacher', email: 'class@example.com', password: 'team-test-password' });
        const other = await api('/auth/register', null, 'POST', { name: 'Other teacher', email: 'other-class@example.com', password: 'team-test-password' });
        const alice = await api('/auth/guest', null, 'POST', { name: 'Alice', classCode: teacher.user.classCode });
        const bob = await api('/auth/guest', null, 'POST', { name: 'Bob', classCode: teacher.user.classCode });
        const outsider = await api('/auth/guest', null, 'POST', { name: 'Outside', classCode: other.user.classCode });
        await api('/players/me', outsider.token);
        let { client, storage } = browser(alice);
        assert.equal(client.base, base, 'must use current backend origin even on a non-3000 port');
        const start = await client.request('/session/start', { method: 'POST', body: JSON.stringify({ difficulty: 1 }) });
        const question = await client.request('/question/next/' + start.sessionId);
        const answer = question.operation === '+' ? question.operand1 + question.operand2
            : question.operation === '-' ? question.operand1 - question.operand2
            : question.operation === '×' ? question.operand1 * question.operand2
            : question.operand1 / question.operand2;
        const answered = await client.request('/answer/submit', { method: 'POST', body: JSON.stringify({ sessionId: start.sessionId, questionId: question.id, submittedAnswer: answer }) });
        assert.equal(answered.isCorrect, true);
        await client.request('/session/end/' + start.sessionId, { method: 'DELETE' });
        let board = await api('/competition-leaderboard', teacher.token);
        assert.equal(board.classId, teacher.user.classCode);
        assert.ok(board.players.find(player => player.nickname === 'Alice').totalXp > 0);
        assert.equal(board.players.find(player => player.nickname === 'Alice').wins, 0, 'practice must not count as PvP');
        assert.equal(board.recentMatches.length, 0);
        assert.ok(!board.players.some(player => player.nickname === 'Outside'));
        assert.equal((await api('/analytics/dashboard?includeSample=false', teacher.token)).overview.totalQuestionsAnswered, 1);
        assert.equal((await api('/analytics/dashboard?includeSample=false', other.token)).overview.totalQuestionsAnswered, 0);

        for (const identity of [alice, bob]) {
            const socket = io(base, { auth: { token: identity.token }, transports: ['websocket'], reconnection: false });
            sockets.push(socket);
            await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
        }
        const [a, b] = sockets;
        const foundA = receive(a, 'ReceiveMatchFound');
        const foundB = receive(b, 'ReceiveMatchFound');
        a.emit('joinQueue', {});
        b.emit('joinQueue', {});
        const [match] = await Promise.all([foundA, foundB]);
        const firstQuestion = receive(a, 'ReceiveQuestion');
        a.emit('readyForMatch', { matchId: match.matchId });
        b.emit('readyForMatch', { matchId: match.matchId });
        const q = await firstQuestion;
        const scored = receive(a, 'ReceiveGameState', state => state.totalQuestions === 1);
        a.emit('submitAnswer', { questionId: q.questionId, submittedAnswer: q.operation === '+' ? q.operandA + q.operandB : q.operandA - q.operandB, responseTimeMs: 1000 });
        await scored;
        const endedA = receive(a, 'ReceiveMatchEnded');
        const endedB = receive(b, 'ReceiveMatchEnded');
        a.emit('leaveMatch', { matchId: match.matchId });
        await Promise.all([endedA, endedB]);
        board = await api('/competition-leaderboard', teacher.token);
        assert.equal(board.players.find(player => player.nickname === 'Bob').wins, 1);
        assert.equal(board.players.find(player => player.nickname === 'Alice').losses, 1);
        assert.equal(board.players.find(player => player.nickname === 'Alice').accuracy, 100);
        assert.equal(board.recentMatches.length, 1);
        assert.deepEqual(new Set([board.recentMatches[0].player1.nickname, board.recentMatches[0].player2.nickname]), new Set(['Alice', 'Bob']));
        for (const socket of sockets) socket.close();
        await runtime.stop();
        await boot();
        ({ client, storage } = browser(alice));
        assert.equal((await api('/competition-leaderboard', teacher.token)).players.find(player => player.nickname === 'Bob').wins, 1);
        assert.equal((await api('/analytics/dashboard?includeSample=false', teacher.token)).overview.totalQuestionsAnswered, 2);

        const userCount = await connection.db.collection('users').countDocuments();
        await connection.db.collection('authTokens').updateMany({ userId: alice.user.id }, { $set: { expiresAt: new Date(0) } });
        await assert.rejects(client.ensureGuest(), error => error.status === 401 && /expired/.test(error.message));
        assert.equal(storage.has('mtow.token'), false);
        assert.equal(await connection.db.collection('users').countDocuments(), userCount, 'expired class user must not silently become a PUBLIC guest');
        const signedOut = browser();
        await assert.rejects(signedOut.client.currentUser(), error => error.status === 401);
        assert.equal(await connection.db.collection('users').countDocuments(), userCount);
        const noBackend = browser(null, () => Promise.reject(new TypeError('fetch failed')));
        await assert.rejects(noBackend.client.request('/health'), /Cannot reach the backend/);
        const wrongServer = browser(null, () => Promise.resolve(new Response('<html>Live Server</html>')));
        await assert.rejects(wrongServer.client.request('/health'), /did not return the MTOW API/);

        const env = { MONGODB_URI: mongo.getUri(), MONGODB_DB_NAME: 'team_access_test' };
        const diagnostic = await runScript('scripts/diagnose-connection.js', ['--label=integration'], env);
        assert.equal(diagnostic.code, 0, diagnostic.output);
        assert.match(diagnostic.output, /Configured driver connection: PASS/);
        assert.doesNotMatch(diagnostic.output, /mongodb:\/\//);
        // Match server.js's unspecified bind address rather than assuming an
        // IPv4 loopback listener also occupies the default IPv6 wildcard port.
        const blocker = net.createServer();
        await new Promise((resolve, reject) => {
            blocker.once('error', reject);
            blocker.listen(0, resolve);
        });
        try {
            const occupied = await runScript('server.js', [], { ...env, PORT: String(blocker.address().port) });
            assert.equal(occupied.code, 1, occupied.output);
            assert.match(occupied.output, /HTTP listener/);
            assert.match(occupied.output, /EADDRINUSE/);
            assert.doesNotMatch(occupied.output, /Atlas IP access/);
        } finally { await new Promise(resolve => blocker.close(resolve)); }
    } finally {
        for (const socket of sockets) socket.close();
        if (runtime) await runtime.stop();
        await connection.client.close();
        await mongo.stop();
    }
});
