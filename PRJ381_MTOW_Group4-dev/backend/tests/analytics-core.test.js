const test = require('node:test');
const assert = require('node:assert/strict');

const {
    InMemoryAnalyticsStore
} = require('../src/models/InMemoryAnalyticsStore');

const {
    AnalyticsService
} = require('../src/services/AnalyticsService');

const {
    generateSampleData
} = require('../src/services/SampleDataGenerator');

const {
    renderReportHtml
} = require('../src/services/ReportRenderer');

test('calculates the correct analytics overview', () => {
    const store = new InMemoryAnalyticsStore();
    const analytics = new AnalyticsService(store);

    store.addAnswerEvent({
        playerName: 'Test Student',
        operation: '+',
        difficulty: 1,
        isCorrect: true,
        responseTimeMs: 1500,
        answeredAt: new Date().toISOString(),
        isSample: true
    });

    store.addAnswerEvent({
        playerName: 'Test Student',
        operation: '-',
        difficulty: 1,
        isCorrect: false,
        responseTimeMs: 2500,
        answeredAt: new Date().toISOString(),
        isSample: true
    });

    const overview = analytics.getOverview({
        onlySample: true
    });

    assert.equal(overview.totalPlayers, 1);
    assert.equal(overview.totalQuestionsAnswered, 2);
    assert.equal(overview.correctAnswers, 1);
    assert.equal(overview.incorrectAnswers, 1);
    assert.equal(overview.overallAccuracy, 50);
    assert.equal(overview.averageResponseTimeMs, 2000);
});

test('can remove only sample analytics data', () => {
    const store = new InMemoryAnalyticsStore();

    store.addAnswerEvent({
        playerName: 'Sample Student',
        answeredAt: new Date().toISOString(),
        isSample: true
    });

    store.addAnswerEvent({
        playerName: 'Real Student',
        answeredAt: new Date().toISOString(),
        isSample: false
    });

    store.clear({
        sampleOnly: true
    });

    const remainingEvents = store.getAnswerEvents();

    assert.equal(remainingEvents.length, 1);
    assert.equal(
        remainingEvents[0].playerName,
        'Real Student'
    );
});

test('generates useful sample data', () => {
    const store = new InMemoryAnalyticsStore();
    const analytics = new AnalyticsService(store);

    const counts = generateSampleData(store);

    const overview = analytics.getOverview({
        onlySample: true
    });

    assert.equal(counts.answerEvents, 360);
    assert.equal(counts.sessionRecords, 30);
    assert.equal(overview.totalPlayers, 6);
    assert.equal(overview.totalSessions, 30);
    assert.equal(
        overview.totalQuestionsAnswered,
        360
    );

    assert.ok(overview.wins > 0);
    assert.ok(overview.losses > 0);
});

test('creates the teacher HTML report', () => {
    const store = new InMemoryAnalyticsStore();
    const analytics = new AnalyticsService(store);

    generateSampleData(store);

    const report = analytics.buildReport({
        onlySample: true
    });

    const html = renderReportHtml(report);

    assert.ok(html.startsWith('<!doctype html>'));
    assert.ok(
        html.includes('Class Performance Report')
    );
    assert.ok(html.includes('Lerato'));
});