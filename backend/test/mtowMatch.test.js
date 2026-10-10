const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MtowMatch } = require('../src/mtow/MtowMatch');
const rules = require('../src/mtow/rules');

function makeMatch(seatIds) {
    const sent = [];
    const match = new MtowMatch({
        matchId: 'm',
        mode: seatIds.length === 2 ? 'pvp' : 'cpu',
        seats: seatIds.map(id => ({ id, name: id, avatarId: '' })),
        send: (seatId, method, payload) => sent.push({ seatId, method, payload }),
        award: () => ({ level: 1, totalXp: 0, levelStartXp: 0, nextLevelXp: 100 })
    });
    match.begin();
    return { match, sent, ended: id => sent.find(m => m.seatId === id && m.method === 'MatchEnded') };
}

function run(match, seconds) {
    for (let t = 0; t < seconds; t += 0.1) match.tick(0.1);
}

test('nobody scores: the match ends in a draw when time runs out', () => {
    const { match, ended } = makeMatch(['a']);
    match.ready('a');
    run(match, rules.startsInSeconds + rules.matchDurationSeconds + 1);
    assert.equal(ended('a').payload.result, 'draw');
    assert.equal(ended('a').payload.reason, 'time');
});

test('a PvP player who never gets ready forfeits to the one who did', () => {
    const { match, ended } = makeMatch(['a', 'b']);
    match.ready('a');
    run(match, rules.readyTimeoutSeconds + 0.5);
    assert.equal(ended('a').payload.result, 'win');
    assert.equal(ended('b').payload.result, 'lose');
    assert.equal(ended('a').payload.reason, 'disconnect');
});

test('an unanswered question is replaced after the time limit', () => {
    const { match, sent } = makeMatch(['a']);
    match.ready('a');
    run(match, rules.startsInSeconds + rules.questionTimeLimitSeconds + 0.5);
    assert.equal(sent.filter(m => m.method === 'Question').length, 2);
});
