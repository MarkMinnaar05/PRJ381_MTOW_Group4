const { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { ApiError, text } = require('./errors');
const derive = promisify(scrypt);
const hash = token => createHash('sha256').update(token).digest('hex');
class AuthService {
    constructor(db) { this.users = db.collection('users'); this.tokens = db.collection('authTokens'); }
    publicUser(u) {
        return { id: u._id, playerId: u._id, name: u.name, role: u.role, classId: u.classId,
            classCode: u.classCode || u.classId, ...(u.email ? { email: u.email } : {}) };
    }
    async register(data) {
        const name = text(data.name, 'Name', 24);
        const email = text(data.email, 'Email', 254).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'Invalid email');
        const password = text(data.password, 'Password', 128);
        if (password.length < 10) throw new ApiError(400, 'Use at least 10 characters for your password');
        const salt = randomBytes(16).toString('hex');
        const key = await derive(password, salt, 64);
        const classCode = randomBytes(5).toString('hex').toUpperCase();
        const user = { _id: randomUUID(), name, email, passwordHash: `${salt}:${key.toString('hex')}`,
            role: 'teacher', classCode, classId: classCode, createdAt: new Date() };
        try { await this.users.insertOne(user); }
        catch (e) { if (e.code === 11000) throw new ApiError(409, 'Email already registered. Log in instead.'); throw e; }
        return this.issue(user);
    }
    async login(data) {
        const email = text(data.email, 'Email', 254).toLowerCase();
        const password = text(data.password, 'Password', 128);
        const u = await this.users.findOne({ email, role: 'teacher' });
        const [salt, saved] = u ? u.passwordHash.split(':') : ['0'.repeat(32), '0'.repeat(128)];
        const key = await derive(password, salt, 64);
        if (!u || !timingSafeEqual(key, Buffer.from(saved, 'hex'))) throw new ApiError(401, 'Invalid email or password');
        return this.issue(u);
    }
    async guest(data = {}) {
        let classId = 'PUBLIC';
        if (data.classCode) {
            const classCode = text(data.classCode, 'Class code', 32).toUpperCase();
            const teacher = await this.users.findOne({ classCode, role: 'teacher' });
            if (!teacher) throw new ApiError(404, 'Class code not found. Ask your teacher for the code.');
            classId = teacher.classId;
        }
        const u = { _id: randomUUID(), name: text(data.name || 'Player', 'Name', 24), role: 'student', classId, createdAt: new Date() };
        await this.users.insertOne(u);
        return this.issue(u);
    }
    async issue(u) {
        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 86400000);
        await this.tokens.insertOne({ _id: hash(token), userId: u._id, expiresAt });
        return { success: true, token, expiresAt, user: this.publicUser(u) };
    }
    async authenticate(token) {
        if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new ApiError(401, 'Sign in again');
        const t = await this.tokens.findOne({ _id: hash(token), expiresAt: { $gt: new Date() } });
        const u = t && await this.users.findOne({ _id: t.userId });
        if (!u) throw new ApiError(401, 'Sign in again');
        return this.publicUser(u);
    }
    async logout(token) { await this.tokens.deleteOne({ _id: hash(token) }); }
}
module.exports = { AuthService };
