const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { io } = require('socket.io-client');
const { connectDatabase } = require('../src/config/database');
const { createApplication } = require('../server');
const rules = require('../src/mtow/rules');
const solve = q => q.operation === '+' ? q.operand1 + q.operand2 : q.operation === '-' ? q.operand1 - q.operand2 : q.operation === '×' ? q.operand1 * q.operand2 : q.operand1 / q.operand2;
const next = (s, e) => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Timed out: ' + e)), 15000); s.once(e, p => { clearTimeout(timer); resolve(p); }); });
test('real MongoDB API, ownership, concurrency, analytics, socket persistence, and restart', { timeout: 90000 }, async t => {
 const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { args: ['--nounixsocket', '--wiredTigerCacheSizeGB', '0.25'] } });
 const c = await connectDatabase(mongo.getUri(), 'mtow_test');
 let runtime, base;
 async function boot() { runtime = createApplication(c.db); await new Promise(r => runtime.server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + runtime.server.address().port; }
 async function api(path, token, method = 'GET', body) { const r = await fetch(base + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, data: await r.json() }; }
 await boot();
 try {
  assert.equal((await api('/health')).data.database, 'connected');
  assert.equal((await api('/session/start', null, 'POST', {})).status, 401);
  const teacher = (await api('/auth/register', null, 'POST', { name: 'Teacher', email: 'teacher@example.com', password: 'long-testing-password' })).data;
  const other = (await api('/auth/register', null, 'POST', { name: 'Other', email: 'other@example.com', password: 'long-testing-password' })).data;
  assert.ok(teacher.token);
  assert.equal((await api('/auth/login', null, 'POST', { email: 'teacher@example.com', password: 'wrong-password' })).status, 401);
  assert.ok((await api('/auth/login', null, 'POST', { email: 'teacher@example.com', password: 'long-testing-password' })).data.token);
  const pupil = (await api('/auth/guest', null, 'POST', { name: 'Mahlatse', classCode: teacher.user.classCode })).data;
  const outsider = (await api('/auth/guest', null, 'POST', { name: 'Outsider' })).data;
  assert.equal((await api('/analytics/dashboard', pupil.token)).status, 403);
  await api('/players/me', pupil.token, 'PATCH', { nickname: 'Saved name', avatarId: 'fox' });
  assert.equal((await api('/players/me', pupil.token)).data.player.nickname, 'Saved name');
  const started = await api('/session/start', pupil.token, 'POST', { difficulty: 2 }); assert.equal(started.status, 201); const id = started.data.sessionId;
  assert.equal((await api('/session/status/' + id, outsider.token)).status, 404);
  const q = (await api('/question/next/' + id, pupil.token)).data; assert.equal(q.answer, undefined);
  const body = { sessionId: id, questionId: q.id, submittedAnswer: solve(q) + 1, expectedAnswer: solve(q) + 1 };
  const wrong = await api('/answer/submit', pupil.token, 'POST', body); assert.equal(wrong.data.isCorrect, false); assert.equal(wrong.data.newScore, 0);
  assert.equal((await api('/answer/submit', pupil.token, 'POST', body)).data.duplicate, true);
  assert.equal(await c.db.collection('answerEvents').countDocuments({ sessionId: id }), 1);
  const q2 = (await api('/question/next/' + id, pupil.token)).data;
  const raced = await Promise.all([1,2].map(() => api('/answer/submit', pupil.token, 'POST', { sessionId: id, questionId: q2.id, submittedAnswer: solve(q2) })));
  assert.ok(raced.some(r => r.status === 200));
  assert.equal((await api('/session/status/' + id, pupil.token)).data.session.totalQuestions, 2);
  assert.equal((await api('/analytics/dashboard?includeSample=false', teacher.token)).data.overview.totalQuestionsAnswered, 2);
  assert.equal((await api('/analytics/dashboard?includeSample=false', other.token)).data.overview.totalQuestionsAnswered, 0);
  assert.equal((await api('/analytics/sample', teacher.token, 'POST', {})).status, 201);
  assert.equal((await api('/analytics/overview?onlySample=true', teacher.token)).data.overview.totalQuestionsAnswered, 360);
  await api('/analytics/sample', teacher.token, 'DELETE'); assert.equal(await c.db.collection('answerEvents').countDocuments({ isSample: false }), 2);
  await runtime.stop(); await boot();
  assert.equal((await api('/session/status/' + id, pupil.token)).data.session.totalQuestions, 2);
  assert.equal((await api('/players/me', pupil.token)).data.player.avatarId, 'fox');
  await api('/session/end/' + id, pupil.token, 'DELETE'); await api('/session/end/' + id, pupil.token, 'DELETE');
  assert.equal((await api('/players/me', pupil.token)).data.player.totalXp, 10);
  assert.equal((await api('/players/me/history', pupil.token)).data.matches.length, 1);
  const s = io(base, { auth: { token: pupil.token, playerId: outsider.user.id }, transports: ['websocket'] });
  await new Promise((resolve,reject) => { s.once('connect',resolve); s.once('connect_error',reject); });
  try {
   let waiting = next(s,'ReceivePlayerInfo'); s.emit('getPlayerInfo',{}); assert.equal((await waiting).playerId,pupil.user.id);
   waiting = next(s,'ReceiveMatchFound'); s.emit('startCpuMatch',{ cpuLevel:1 }); const m = await waiting;
   // Advance naturally through one question, then end by forfeit to test persistence.
   waiting = next(s,'ReceiveQuestion'); s.emit('readyForMatch',{ matchId:m.matchId }); const question = await waiting;
   waiting = next(s,'ReceiveGameState'); s.emit('submitAnswer',{ questionId:question.questionId,submittedAnswer:question.operation === '+' ? question.operandA+question.operandB : question.operandA-question.operandB,responseTimeMs:1000 }); await waiting;
   waiting = next(s,'ReceiveMatchEnded'); s.emit('leaveMatch',{matchId:m.matchId}); const result = await waiting;
   assert.equal(result.totalQuestions,1);
   assert.equal((await api('/players/me/history',pupil.token)).data.matches.length,2);
   const event = await c.db.collection('answerEvents').findOne({playerId:pupil.user.id,questionId:question.questionId}); assert.ok(event); assert.equal(event.classId,teacher.user.classCode);
   await runtime.app.locals.players.awardMatch(pupil.user.id,result.matchId,result.xpEarned);
   assert.equal((await runtime.app.locals.players.get(pupil.user.id)).totalXp,10+result.xpEarned);
   waiting = next(s,'ReceiveMatchHistory'); s.emit('saveMatchHistory',{matchId:'forged',score:999999}); s.emit('getMatchHistory',{}); await waiting;
   assert.equal(await c.db.collection('matches').countDocuments({matchId:'forged'}),0);
  } finally { s.close(); }
  const totals = (await api('/players/me/stats', pupil.token)).data.stats;
  assert.equal(totals.questions, 3); assert.equal(totals.correct, 2);
  const page = await fetch(base + '/frontend/practice.html'); assert.equal(page.status, 200);
  assert.match(await page.text(), /practiceAnswer/);
  const vm = require('node:vm'); const fs = require('node:fs'); const path = require('node:path');
  const storage = new Map();
  const browser = { window: { MTOW_API_BASE: base }, fetch,
    location: { port: '3000', origin: base },
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) } };
  vm.createContext(browser);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../frontend/api-client.js'), 'utf8'), browser);
  const webUser = await browser.window.MTOWApi.ensureGuest('Browser test');
  assert.ok(webUser.playerId); assert.ok(storage.get('mtow.token'));
  const webProfile = await browser.window.MTOWApi.request('/players/me'); assert.equal(webProfile.player.nickname, 'Browser test');
  await browser.window.MTOWApi.logout(); assert.equal(storage.has('mtow.token'), false);
  await api('/auth/logout',pupil.token,'POST'); assert.equal((await api('/auth/me',pupil.token)).status,401);
  const u = await c.db.collection('users').findOne({email:'teacher@example.com'}); assert.ok(u.passwordHash); assert.equal(u.password,undefined);
  t.diagnostic('Verified real MongoDB, API restart, class privacy, CAS, duplicates, samples, and socket XP/history.');
 } finally { await runtime.stop(); await c.client.close(); await mongo.stop(); }
});
