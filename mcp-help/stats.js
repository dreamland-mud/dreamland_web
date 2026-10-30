/* Usage counters for the public MCP: per UTC day, how many times each tool
 * ran and which client programs connected (clientInfo.name from initialize).
 * No IPs, no arguments, nothing about who asked. Kept in a small JSON file
 * outside the deployed tree, flushed every minute and on exit, 120 days kept.
 *
 *   { "2026-10-31": { "tools": { "help_search": 12 }, "clients": { "claude-ai": 3 } } }
 */
'use strict';
const fs = require('fs');

const KEEP_DAYS = 120;

class Stats {
    constructor(file) {
        this.file = file;
        this.days = {};
        this.dirty = false;
        try { this.days = JSON.parse(fs.readFileSync(file, 'utf8')); }
        catch (e) { if (e.code !== 'ENOENT') console.error('stats unreadable, starting fresh:', e.message); }
        setInterval(() => this.flush(), 60000).unref();
    }

    bump(group, key) {
        const day = new Date().toISOString().slice(0, 10);
        const d = this.days[day] || (this.days[day] = { tools: {}, clients: {} });
        d[group][key] = (d[group][key] || 0) + 1;
        this.dirty = true;
    }

    tool(name) { this.bump('tools', name); }

    // client names are free text from the internet: keep them short and plain
    client(name) {
        const n = String(name || 'unknown').replace(/[^\w .@/-]/g, '').slice(0, 40) || 'unknown';
        this.bump('clients', n);
    }

    flush() {
        if (!this.dirty) return;
        const days = Object.keys(this.days).sort();
        days.slice(0, Math.max(0, days.length - KEEP_DAYS)).forEach(d => delete this.days[d]);
        try {
            fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.days, null, 1));
            fs.renameSync(this.file + '.tmp', this.file);
            this.dirty = false;
        }
        catch (e) { console.error('stats flush failed:', e.message); }
    }
}

module.exports = { Stats };
