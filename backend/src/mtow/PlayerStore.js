const fs = require('fs');
const path = require('path');
const defaultRules = require('./rules');

class PlayerStore {
    constructor(file = process.env.MTOW_DATA_FILE || path.join(__dirname, '..', '..', 'data', 'players.json'), rules = defaultRules) {
        this.file = file;
        this.rules = rules;
        this.players = {};
        try {
            this.players = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {
            this.players = {};
        }
    }

    get(playerId, name = 'Player') {
        if (!this.players[playerId]) {
            this.players[playerId] = { playerId, nickname: name, avatarId: '', totalXp: 0, history: [] };
            this.save();
        }
        const p = this.players[playerId];
        return { playerId, nickname: p.nickname, avatarId: p.avatarId, level: this.levelFor(p.totalXp), totalXp: p.totalXp };
    }

    update(playerId, info) {
        this.get(playerId);
        const p = this.players[playerId];
        if (typeof info.nickname === 'string' && info.nickname.trim()) p.nickname = info.nickname.trim().slice(0, 24);
        if (typeof info.avatarId === 'string') p.avatarId = info.avatarId.slice(0, 32);
        this.save();
    }

    addXp(playerId, xp) {
        this.get(playerId);
        const p = this.players[playerId];
        p.totalXp += Math.max(0, Math.round(xp));
        this.save();
        const level = this.levelFor(p.totalXp);
        return { level, totalXp: p.totalXp, levelStartXp: this.levelStartXp(level), nextLevelXp: this.nextLevelXp(level) };
    }

    addMatch(playerId, record) {
        if (!record || !record.matchId) return;
        this.get(playerId);
        const history = this.players[playerId].history;
        if (history.some(m => m.matchId === record.matchId)) return;
        history.push({ ...record, playerId });
        if (history.length > this.rules.historyLimit) history.splice(0, history.length - this.rules.historyLimit);
        this.save();
    }

    history(playerId, limit = 20) {
        const history = (this.players[playerId] && this.players[playerId].history) || [];
        return { schemaVersion: 1, matches: history.slice(-limit).reverse() };
    }

    levelFor(totalXp) {
        return 1 + this.rules.levelThresholds.filter(t => totalXp >= t).length;
    }

    levelStartXp(level) {
        const t = this.rules.levelThresholds;
        return level <= 1 ? 0 : t[Math.min(level, t.length + 1) - 2];
    }

    nextLevelXp(level) {
        const t = this.rules.levelThresholds;
        return level - 1 < t.length ? t[level - 1] : this.levelStartXp(level);
    }

    save() {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        fs.writeFileSync(this.file, JSON.stringify(this.players, null, 2));
    }
}

module.exports = { PlayerStore };
