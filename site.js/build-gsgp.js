#!/usr/bin/env node
/* GameScry polls a GSGP endpoint (plain JSON) for live game data, the way MUD
 * crawlers poll MSSP over telnet. GameScry reads three keys: name,
 * active_players, leaderboards. We publish the first two, taken from the
 * game's own MSSP reply so every directory sees the same player count.
 *
 *   game :9000 MSSP-REQUEST  ->  static/gsgp.json
 *
 * usage: node site.js/build-gsgp.js [host] [port] [out-file]
 */
const fs = require('fs');
const net = require('net');
const path = require('path');

const HOST = process.argv[2] || '127.0.0.1';
const PORT = +(process.argv[3] || 9000);
const OUT = process.argv[4] || path.resolve(__dirname, '../static/gsgp.json');

function msspRequest(done) {
    let buf = '';
    let finished = false;
    const sock = net.connect(PORT, HOST);
    const finish = (err) => {
        if (finished) return;
        finished = true;
        sock.destroy();
        done(err, buf);
    };
    sock.setTimeout(10000, () => finish(new Error('timeout')));
    sock.on('error', finish);
    sock.on('connect', () => setTimeout(() => sock.write('MSSP-REQUEST\r\n'), 1500));
    sock.on('data', (chunk) => {
        buf += chunk.toString('latin1');
        if (buf.includes('MSSP-REPLY-END')) finish(null);
    });
}

msspRequest((err, text) => {
    if (err || !text.includes('MSSP-REPLY-START')) {
        // Game down or rebooting: leave the last file in place. A stale count
        // for a few minutes beats a 404 that makes the directory mark us dead.
        console.error('no MSSP reply from ' + HOST + ':' + PORT + ' -- keeping existing ' + OUT);
        process.exit(0);
    }
    const table = {};
    text.split('MSSP-REPLY-START')[1].split('MSSP-REPLY-END')[0].split(/\r?\n/).forEach((line) => {
        const tab = line.indexOf('\t');
        if (tab > 0) table[line.slice(0, tab).trim()] = line.slice(tab + 1).trim();
    });
    const players = parseInt(table.PLAYERS, 10);
    const gsgp = {
        name: table.NAME || 'DreamLand',
        active_players: Number.isFinite(players) ? players : 0,
    };
    const tmp = OUT + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(gsgp) + '\n');
    fs.renameSync(tmp, OUT);
});
