const rules = require('../mtow/rules');
const { ApiError, text } = require('./errors');
class MongoPlayerStore {
    constructor(db) { this.players = db.collection('players'); this.matches = db.collection('matches'); this.authoritative = true; }
    levelFor(xp) { return 1 + rules.levelThresholds.filter(t => xp >= t).length; }
    progress(xp) {
        const level = this.levelFor(xp);
        return { level, totalXp: xp, levelStartXp: level <= 1 ? 0 : rules.levelThresholds[level - 2],
            nextLevelXp: rules.levelThresholds[level - 1] ?? rules.levelThresholds.at(-1) };
    }
    async get(playerId, name = 'Player', classId = 'PUBLIC') {
        await this.players.updateOne({ _id: playerId }, { $setOnInsert: { nickname: name, avatarId: '', totalXp: 0, awardedMatches: [], classId, createdAt: new Date() } }, { upsert: true });
        const p = await this.players.findOne({ _id: playerId });
        return { playerId, nickname: p.nickname, avatarId: p.avatarId, ...this.progress(p.totalXp) };
    }
    async update(playerId, data) {
        const changes = {};
        if (data.nickname !== undefined) changes.nickname = text(data.nickname, 'Nickname', 24);
        if (data.avatarId !== undefined) {
            if (typeof data.avatarId !== 'string' || data.avatarId.length > 32) throw new ApiError(400, 'Invalid avatar');
            changes.avatarId = data.avatarId;
        }
        if (Object.keys(changes).length) await this.players.updateOne({ _id: playerId }, { $set: changes });
        return this.get(playerId);
    }
    // Award each server-computed match once, even after a retry or reconnect.
    async awardMatch(playerId, matchId, xp) {
        await this.players.updateOne({ _id: playerId, awardedMatches: { $ne: matchId } },
            { $inc: { totalXp: Math.max(0, Math.round(xp)) }, $addToSet: { awardedMatches: matchId } });
        const p = await this.players.findOne({ _id: playerId });
        return this.progress(p.totalXp);
    }
    async addMatch(playerId, record) {
        await this.matches.updateOne({ _id: `${playerId}:${record.matchId}` },
            { $setOnInsert: { ...record, playerId } }, { upsert: true });
    }
    async history(playerId, limit = 20) {
        const rows = await this.matches.find({ playerId }, { projection: { _id: 0 } }).sort({ endedAt: -1 }).limit(limit).toArray();
        return { schemaVersion: 1, matches: rows };
    }
}
module.exports = { MongoPlayerStore };
