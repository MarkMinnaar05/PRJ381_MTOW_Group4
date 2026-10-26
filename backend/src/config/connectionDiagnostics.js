// Keep diagnostic messages useful without printing database credentials.
function safeMessage(value, uri = process.env.MONGODB_URI) {
    let text = String(value || 'No additional details');
    if (uri) {
        text = text.split(uri).join('[MongoDB connection string hidden]');
        const password = uri.match(/^mongodb(?:\+srv)?:\/\/[^:]*:([^@]*)@/i)?.[1];
        if (password) {
            for (const secret of new Set([password, decodePassword(password)])) {
                if (secret) text = text.split(secret).join('[hidden]');
            }
        }
    }
    return text.replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[MongoDB connection string hidden]');
}

function decodePassword(value) {
    try { return decodeURIComponent(value); } catch (_) { return value; }
}

function errorDetails(error, uri) {
    const lines = new Set();
    function collect(item, depth = 0) {
        if (!item || depth > 5) return;
        lines.add(safeMessage([item.name, item.code, item.message].filter(Boolean).join(': '), uri));
        collect(item.cause, depth + 1);
        if (item.reason?.servers) {
            for (const server of item.reason.servers.values()) collect(server.error, depth + 1);
        }
    }
    collect(error);
    return [...lines];
}

function connectionOptions() {
    const family = process.env.MONGODB_FAMILY?.trim();
    if (family && !['4', '6'].includes(family)) throw new Error('MONGODB_FAMILY must be 4, 6, or left empty');
    return { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, maxPoolSize: 10,
        ...(family ? { family: Number(family) } : {}) };
}

module.exports = { safeMessage, errorDetails, connectionOptions };
