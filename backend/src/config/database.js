const { MongoClient } = require('mongodb');
async function connectDatabase(uri = process.env.MONGODB_URI, name = process.env.MONGODB_DB_NAME || 'mtow') {
    if (!uri) throw new Error('MONGODB_URI is missing. Create backend/.env from .env.example.');
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid MONGODB_DB_NAME');
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 10 });
    try {
        await client.connect();
        const db = client.db(name);
        await db.command({ ping: 1 });
        await Promise.all([
            db.collection('users').createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } }),
            db.collection('users').createIndex({ classCode: 1 }, { unique: true, partialFilterExpression: { role: 'teacher' } }),
            db.collection('authTokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
            db.collection('players').createIndex({ classId: 1, totalXp: -1 }),
            db.collection('matches').createIndex({ playerId: 1, endedAt: -1 }),
            db.collection('answerEvents').createIndex({ classId: 1, answeredAt: 1 }),
            db.collection('sessionRecords').createIndex({ classId: 1, startedAt: 1 }),
            db.collection('gameSessions').createIndex({ ownerId: 1, createdAt: -1 })
        ]);
        return { client, db };
    } catch (error) { await client.close(); throw error; }
}
module.exports = { connectDatabase };
