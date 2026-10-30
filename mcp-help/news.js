/* Game news for the MCP tools.
 *
 * Reads static/data/news-all.json, the archive news.html shows: site.js/
 * build-news.js writes it from the game's note dump, newest first. The posts
 * are player-facing text exactly as the immortals wrote them (mostly
 * Ukrainian, older ones Russian). The file is re-read when it changes.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const url = id => 'https://dreamland.rocks/news.html#n' + id;

class News {
    constructor(dataDir) {
        this.file = path.join(dataDir, 'news-all.json');
        this.rows = null;
        this.mtime = null;
    }

    // a half-written file keeps the old copy
    all() {
        let mtime;
        try { mtime = fs.statSync(this.file).mtimeMs; }
        catch (e) { if (this.rows) return this.rows; throw e; }
        if (mtime !== this.mtime) {
            try {
                const rows = JSON.parse(fs.readFileSync(this.file, 'utf8'));
                rows.forEach(r => { r.hay = (r.subject + '\n' + r.text).toLowerCase(); });
                this.rows = rows;
                this.mtime = mtime;
            }
            catch (e) { if (!this.rows) throw e; console.error('news reload failed, keeping the old copy:', e.message); }
        }
        return this.rows;
    }

    // every word of the query must appear in the subject or the text
    list(query, limit) {
        const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
        const hits = this.all().filter(r => words.every(w => r.hay.includes(w)));
        return { total: hits.length, rows: hits.slice(0, limit) };
    }

    get(id) {
        return this.all().find(r => r.id === id) || null;
    }
}

const line = r => '[' + r.id + '] ' + r.date + ', ' + r.from + ': ' + r.subject;

module.exports = { News, url, line };
