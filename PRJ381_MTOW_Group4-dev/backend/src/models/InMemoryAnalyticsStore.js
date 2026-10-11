// src/models/InMemoryAnalyticsStore.js
// Analytics data storage (Sprint 3 - Member 6, with Member 4 for the database side)
//
// Temporary storage for analytics data.
// The data is stored in memory because the database is not available yet.
// This means that the data will reset whenever the server restarts.
// A database store can be connected later using the same main methods.

const MAX_ANSWER_EVENTS = 50000; // stops memory growing forever on a long-running server

class InMemoryAnalyticsStore {
    constructor() {
        this.answerEvents = [];            // one row per answered question
        this.sessionRecords = new Map();   // one row per game session, keyed by sessionId
    }

    // ---------- Writes ----------

    addAnswerEvent(event) {
        this.answerEvents.push(event);
        if (this.answerEvents.length > MAX_ANSWER_EVENTS) {
            this.answerEvents.shift();
        }
        return event;
    }

    // Insert a new session row, or merge new fields into an existing one
    upsertSessionRecord(record) {
        const existing = this.sessionRecords.get(record.sessionId) || {};
        const merged = { ...existing, ...record };
        this.sessionRecords.set(record.sessionId, merged);
        return merged;
    }

    // ---------- Reads ----------

    getAnswerEvents(filters = {}) {
        // Oldest first
        return this.answerEvents
            .filter(e => matchesFilters(e, filters, 'answeredAt'))
            .sort(byDate('answeredAt'));
    }

    getSessionRecords(filters = {}) {
        return [...this.sessionRecords.values()]
            .filter(r => matchesFilters(r, filters, 'startedAt'))
            .sort(byDate('startedAt'));
    }

    getSessionRecord(sessionId) {
        return this.sessionRecords.get(sessionId) || null;
    }

    // ---------- Maintenance ----------

    // clear({ sampleOnly: true }) removes only the sample data, keeping real games
    clear({ sampleOnly = false } = {}) {
        if (!sampleOnly) {
            this.answerEvents = [];
            this.sessionRecords.clear();
            return;
        }
        this.answerEvents = this.answerEvents.filter(e => !e.isSample);
        for (const [id, r] of this.sessionRecords) {
            if (r.isSample) this.sessionRecords.delete(id);
        }
    }

    // Runs a batch of writes together (a database store can make this one transaction)
    transaction(fn) {
        return fn();
    }

    describe() {
        return { type: 'Memory (resets when the server restarts)' };
    }

    counts() {
        const sampleEvents = this.answerEvents.filter(e => e.isSample).length;
        return {
            answerEvents: this.answerEvents.length,
            sampleAnswerEvents: sampleEvents,
            liveAnswerEvents: this.answerEvents.length - sampleEvents,
            sessionRecords: this.sessionRecords.size
        };
    }
}

// Shared filter logic: includeSample, onlySample, playerName, from, to
function matchesFilters(row, filters, dateField) {
    const { includeSample = true, onlySample = false, playerName, from, to } = filters;

    if (!includeSample && row.isSample) return false;
    if (onlySample && !row.isSample) return false;
    if (
    playerName &&
    String(row.playerName || '').toLowerCase() !== String(playerName).toLowerCase())   
    {
    return false;
    } 

    const when = new Date(row[dateField]).getTime();
    if (from && when < new Date(from).getTime()) return false;
    if (to && when > new Date(to).getTime()) return false;

    return true;
}

function byDate(field) {
    return (a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0);
}

// One shared store for the whole server (same pattern as `sessions` in GameSession.js)
// This shared in-memory store is used until the database store is available.
const analyticsStore = new InMemoryAnalyticsStore();

module.exports = {
    InMemoryAnalyticsStore,
    analyticsStore
};