class ApiError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}
const wrap = action => (req, res, next) => Promise.resolve(action(req, res)).catch(next);
function text(value, name, max = 64) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
        throw new ApiError(400, `${name} must contain 1–${max} characters`);
    }
    return value.trim();
}
module.exports = { ApiError, wrap, text };
