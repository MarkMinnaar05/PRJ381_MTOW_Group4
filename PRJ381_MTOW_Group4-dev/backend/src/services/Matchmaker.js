// src/services/Matchmaker.js
//
// FIFO matchmaking queues, one per (class, mode). Pure logic - no sockets in
// here - so it can be unit tested and swapped out. server.js owns turning a
// pairing into a real game session.
//
// Kids only ever face classmates: the queue key includes the class id, so two
// waiting players from different classes never see each other.

class Matchmaker {
    constructor() {
        // key -> [entry, ...] in arrival order
        this.queues = new Map();
        // socketId -> key, so a disconnect can find its queue in O(1)
        this.socketKey = new Map();
    }

    static keyFor(classId, mode) {
        return `${classId}::${mode}`;
    }

    /**
     * Put a player in the queue for their class+mode, or pair them with the
     * player who has waited longest there.
     *
     * entry: { socketId, playerId?, name, classId, mode }
     * returns: { match: entry|null, replaced: entry|null }
     *   match    - the waiting opponent this entry was paired with (entry is NOT
     *              left in the queue in that case)
     *   replaced - an older queue entry for the same playerId (e.g. the same
     *              kid opened a second tab), which was dropped
     */
    enqueue(entry) {
        const key = Matchmaker.keyFor(entry.classId, entry.mode);

        // Re-queueing from the same socket just restarts the wait.
        this.remove(entry.socketId);

        // Same account already waiting from another connection: keep the newer one.
        let replaced = null;
        if (entry.playerId) {
            replaced = this._findByPlayerId(key, entry.playerId);
            if (replaced) this.remove(replaced.socketId);
        }

        const queue = this.queues.get(key) || [];
        const opponent = queue.find(e =>
            e.socketId !== entry.socketId &&
            !(entry.playerId && e.playerId && e.playerId === entry.playerId));

        if (opponent) {
            this.remove(opponent.socketId);
            return { match: opponent, replaced };
        }

        queue.push({ ...entry, queuedAt: Date.now() });
        this.queues.set(key, queue);
        this.socketKey.set(entry.socketId, key);
        return { match: null, replaced };
    }

    /** Remove a socket from whichever queue it is in. Returns true if it was queued. */
    remove(socketId) {
        const key = this.socketKey.get(socketId);
        if (!key) return false;
        this.socketKey.delete(socketId);

        const queue = this.queues.get(key);
        if (!queue) return false;
        const idx = queue.findIndex(e => e.socketId === socketId);
        if (idx === -1) return false;
        queue.splice(idx, 1);
        if (queue.length === 0) this.queues.delete(key);
        return true;
    }

    /** How many players are waiting in a class+mode queue. */
    size(classId, mode) {
        return (this.queues.get(Matchmaker.keyFor(classId, mode)) || []).length;
    }

    isQueued(socketId) {
        return this.socketKey.has(socketId);
    }

    _findByPlayerId(key, playerId) {
        const queue = this.queues.get(key) || [];
        return queue.find(e => e.playerId === playerId) || null;
    }
}

module.exports = { Matchmaker };
