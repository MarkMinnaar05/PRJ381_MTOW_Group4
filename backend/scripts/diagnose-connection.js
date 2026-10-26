// Read-only checks. Never writes app records, changes Windows DNS, or disables TLS.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const dns = require('node:dns');
const net = require('node:net');
const tls = require('node:tls');
const { MongoClient } = require('mongodb');
const { connectionOptions, errorDetails } = require('../src/config/connectionDiagnostics');

function probe(host, port, secure) {
    return new Promise(resolve => {
        let done = false;
        let connected = false;
        const options = { host, port, family: 4 };
        const socket = secure
            ? tls.connect({ ...options, servername: host, rejectUnauthorized: true })
            : net.connect(options);
        const finish = result => {
            if (done) return;
            done = true;
            socket.destroy();
            resolve(result);
        };
        socket.on('connect', () => { connected = true; if (!secure) finish('PASS'); });
        if (secure) socket.once('secureConnect', () => finish('PASS (certificate verified)'));
        socket.setTimeout(4000, () => finish('FAIL: timeout' + (connected ? ' after TCP connected' : '')));
        socket.once('error', error => finish('FAIL: ' + errorDetails(error).join(' | ')));
    });
}

async function ping(uri, options, label) {
    const client = new MongoClient(uri, options);
    try {
        await client.connect();
        const db = client.db(process.env.MONGODB_DB_NAME || 'mtow');
        await db.command({ ping: 1 });
        let version = 'version unavailable';
        try { version = (await client.db('admin').command({ buildInfo: 1 })).version; } catch (_) { /* ping already succeeded */ }
        console.log(`${label}: PASS. Database=${db.databaseName}; MongoDB=${version}`);
        return true;
    } catch (error) {
        console.log(`${label}: FAIL`);
        for (const detail of errorDetails(error, uri)) console.log('  ' + detail);
        return false;
    } finally { await client.close(); }
}

async function main() {
    const label = process.argv.find(arg => arg.startsWith('--label='))?.slice(8).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30) || 'unlabelled';
    console.log(`MTOW connection diagnostic: ${label}`);
    console.log(`Node=${process.version}; database driver=${require('mongodb/package.json').version}`);
    console.log('No credentials are printed. No data or network settings are changed.');
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is missing. Copy .env.example to backend/.env and add your private URI.');
    const dbName = process.env.MONGODB_DB_NAME || 'mtow';
    if (!/^[a-zA-Z0-9_-]+$/.test(dbName)) throw new Error('MONGODB_DB_NAME contains invalid characters');
    const options = connectionOptions();
    console.log(`Database=${dbName}; configured IP family=${options.family || 'automatic'}`);
    console.log('Check separately in Atlas: this network’s CURRENT public IP must have an Active access-list entry.');
    const authority = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/i)?.[1];
    if (!authority) throw new Error('Expected a mongodb:// or mongodb+srv:// connection string');
    let hosts;
    if (uri.startsWith('mongodb+srv://')) {
        const record = '_mongodb._tcp.' + authority;
        const resolver = new dns.promises.Resolver({ timeout: 3000, tries: 1 });
        try {
            hosts = await resolver.resolveSrv(record);
            console.log(`System SRV DNS: PASS (${hosts.length} hosts)`);
        } catch (error) { console.log(`System SRV DNS: FAIL (${error.code || error.name})`); }
        // A comparison query only; the driver still uses the configured system DNS.
        const comparison = new dns.promises.Resolver({ timeout: 3000, tries: 1 });
        comparison.setServers(['1.1.1.1']);
        try {
            const records = await comparison.resolveSrv(record);
            console.log(`Cloudflare SRV comparison: PASS (${records.length} hosts)`);
            hosts ||= records;
        } catch (error) { console.log(`Cloudflare SRV comparison: unavailable (${error.code || error.name}); this alone does not prove a fault.`); }
    } else {
        hosts = authority.split(',').map(value => {
            const target = value.match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/);
            if (!target) return null;
            return { name: target[1].replace(/^\[|\]$/g, ''), port: Number(target[2] || 27017) };
        }).filter(Boolean);
    }
    // TCP plus certificate-verified TLS checks apply to Atlas, which uses TLS.
    const atlas = uri.startsWith('mongodb+srv://') || /(?:[.?&](?:tls|ssl)=true)|mongodb\.net/i.test(uri);
    if (hosts?.length) {
        const lines = await Promise.all(hosts.slice(0, 6).map(async host => {
            const [tcp, secure] = await Promise.all([probe(host.name, host.port, false), atlas ? probe(host.name, host.port, true) : Promise.resolve('not requested for local non-TLS MongoDB')]);
            return `${host.name}:${host.port}\n  TCP/IPv4: ${tcp}\n  TLS/IPv4: ${secure}`;
        }));
        for (const line of lines) console.log(line);
    }
    const connected = await ping(uri, options, 'Configured driver connection');
    if (!connected && !options.family) {
        const ipv4 = await ping(uri, { ...options, family: 4 }, 'IPv4-only comparison');
        if (ipv4) console.log('IPv4 succeeds: add MONGODB_FAMILY=4 to backend/.env, save, and restart.');
    }
    if (!connected) {
        console.log('For Wi-Fi troubleshooting, run this same command on Wi-Fi and hotspot, with each current IP allowed in Atlas. Compare DNS, TCP, TLS and driver results.');
        console.log('If both DNS and TCP pass but TLS fails only on Wi-Fi, investigate that network’s TLS filtering/router/ISP with its administrator. Changing dashboard code cannot repair that network path.');
        process.exitCode = 1;
    }
}

if (require.main === module) main().catch(error => {
    for (const detail of errorDetails(error)) console.error(detail);
    process.exitCode = 1;
});
