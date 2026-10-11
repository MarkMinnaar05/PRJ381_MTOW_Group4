const { InMemoryAnalyticsStore } = require('../models/InMemoryAnalyticsStore');
const { AnalyticsService } = require('../services/AnalyticsService');
const { generateSampleData } = require('../services/SampleDataGenerator');
class MongoAnalytics {
    constructor(db, classId) { this.db = db; this.classId = classId; }
    async snapshot() {
        // MongoDB is the source of truth. The temporary snapshot only runs existing calculations.
        const store = new InMemoryAnalyticsStore();
        const [events, sessions] = await Promise.all([
            this.db.collection('answerEvents').find({ classId: this.classId }, { projection: { _id: 0 } }).toArray(),
            this.db.collection('sessionRecords').find({ classId: this.classId }, { projection: { _id: 0 } }).toArray()
        ]);
        store.answerEvents = events;
        store.sessionRecords = new Map(sessions.map(s => [s.sessionId, s]));
        return new AnalyticsService(store);
    }
    async getStatus() {
        const a = await this.snapshot();
        const status = a.getStatus();
        status.storage = { type: 'MongoDB', database: this.db.databaseName };
        return status;
    }
    async clearSample() {
        await Promise.all(['answerEvents', 'sessionRecords'].map(c => this.db.collection(c).deleteMany({ classId: this.classId, isSample: true })));
    }
    async loadSample() {
        const store = new InMemoryAnalyticsStore();
        generateSampleData(store);
        await this.clearSample();
        for (const [collection, rows] of [['answerEvents', store.answerEvents], ['sessionRecords', [...store.sessionRecords.values()]]]) {
            if (rows.length) await this.db.collection(collection).insertMany(rows.map(r => ({ ...r,
                _id: `sample:${this.classId}:${r.eventId || r.sessionId}`, classId: this.classId })));
        }
        return (await this.getStatus());
    }
}
for (const method of ['getDashboard', 'getOverview', 'getOperationBreakdown', 'getDifficultyBreakdown', 'getTrend',
    'getResponseTimeDistribution', 'getPlayerStats', 'getPlayerDetail', 'getTopPerformers', 'getRecentActivity', 'getInsights', 'buildReport', 'exportCsv']) {
    MongoAnalytics.prototype[method] = async function (...args) { return (await this.snapshot())[method](...args); };
}
module.exports = { MongoAnalytics };
