/* DreamLand help as a public MCP server.
 *
 * Read-only tools over the same help corpus dreamland.rocks/help.html shows:
 * search, read an article, browse categories; plus the item search
 * dreamland.rocks/searcher.html shows, the news archive and who is online.
 * Streamable HTTP, stateless (a fresh server per request), no auth, only
 * what the site and the Discord bot already show. nginx proxies
 * https://dreamland.rocks/mcp/help to 127.0.0.1:$PORT and rate-limits it.
 *
 *   PORT=8003 HELP_DATA=/var/www/dreamland_web/static/data MUD_API=http://127.0.0.1:1235 node server.js
 */
'use strict';
const http = require('http');
const path = require('path');
const { McpServer } = require('@modelcontextprotocol/server');
const { NodeStreamableHTTPServerTransport } = require('@modelcontextprotocol/node');
const { z } = require('zod');
const S = require('../static/site/js/helpsearch.js');
const { Corpus, CATEGORIES, url, title, kindOf, categoryName, toMarkdown } = require('./corpus');
const I = require('../static/site/js/itemsearch.js');
const { Items, line: itemLine, KINDS: ITEM_KINDS, MAXLEVEL } = require('./items');
const { News, url: newsUrl, line: newsLine } = require('./news');

const PORT = Number(process.env.PORT || 8003);
const DATA = process.env.HELP_DATA || path.resolve(__dirname, '../static/data');
// the engine's servlet port; /who there is the public endpoint the Discord bot uses
const MUD_API = (process.env.MUD_API || 'http://127.0.0.1:1235').replace(/\/+$/, '');
const VERSION = require('./package.json').version;

const corpus = new Corpus(DATA);
const items = new Items(DATA);
const news = new News(DATA);

/* Drone pulls new code but cannot restart this unit, so the process exits
   when its own sources change and systemd (Restart=always) starts the new
   version. package.json covers a dependency bump after drone's npm install. */
['server.js', 'corpus.js', 'items.js', 'news.js', 'package.json', '../static/site/js/helpsearch.js',
 '../static/site/js/itemsearch.js'].forEach(f =>
    require('fs').watchFile(path.resolve(__dirname, f), { interval: 5000 }, (cur, prev) => {
        if (cur.mtimeMs !== prev.mtimeMs) { console.log(f + ' changed, exiting for a restart'); process.exit(0); }
    }));

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const KIND_NAMES = ['spell', 'skill', 'command', 'social', 'race', 'class', 'religion', 'zone', 'craft', 'group', 'behavior', 'language'];

// 'uk' is the ISO code people will try; the corpus calls Ukrainian 'ua'
const lang = z.enum(['en', 'ru', 'ua', 'uk']).default('en')
    .describe('Answer language: en, ru or ua (uk also accepted). Untranslated text falls back to Russian.');
const normLang = l => (l === 'uk' ? 'ua' : l || 'en');

const text = s => ({ content: [{ type: 'text', text: s }] });
const fail = s => ({ content: [{ type: 'text', text: s }], isError: true });

async function mudWho(name) {
    const r = await fetch(MUD_API + '/who', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(name ? { args: { message: name } } : {}),
        signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
}

// one game query per 30 s however many clients ask
let whoCache = { at: 0, body: null };
async function whoList() {
    if (Date.now() - whoCache.at < 30000) return whoCache.body;
    const body = await mudWho('');
    whoCache = { at: Date.now(), body };
    return body;
}

// the game's own forms: names have en and ru only, titles are as the player set them
const pick = (o, l) => (o ? o[l] || (l === 'en' ? null : o.ru) || o.en || '' : '');
const remorts = (n, l) => ({ en: 'remorts ', ru: 'ремортов ', ua: 'ремортів ' }[l]) + n;

function line(a, l) {
    const k = kindOf(a, l);
    return '[' + a.id + '] ' + title(a, l) + (k ? ' (' + k + ')' : '');
}

function buildServer() {
    const c = corpus.fresh();
    const server = new McpServer(
        { name: 'dreamland-help', title: 'DreamLand MUD help', version: VERSION },
        { instructions:
            'Help articles of DreamLand, a text MUD (dreamland.rocks): game rules, classes, races, ' +
            'skills, spells, commands, zones, religions, clans. Search first, then read an article by id. ' +
            'Article text is the in-game help, in English, Russian or Ukrainian. ' +
            'item_search finds armor, weapons, magic items and pets with their stats and the zone they come from. ' +
            'who shows who is playing now; news_list and news_get read the game news.' });

    server.registerTool('help_search', {
        title: 'Search DreamLand help',
        description: 'Find help articles by keyword, title or text. Exact keywords rank first, then title ' +
            'and keyword-prefix matches, then hits in the article text. A leading facet word narrows the ' +
            'search like in game: "spell fire", "skill sword", "race elf", "class", "command", "zone", ' +
            '"religion", "clan" (RU/UA forms work too). Returns ids for help_get.',
        inputSchema: z.object({
            query: z.string().min(1).max(200).describe('What to look for, in any of the three languages.'),
            lang,
            limit: z.number().int().min(1).max(25).default(10),
        }),
        annotations: READ_ONLY,
    }, ({ query, lang: l, limit }) => {
        l = normLang(l);
        const r = c.searchWithExcerpts(query, l, limit);
        if (!r.hits.length) return text('No help articles match "' + query + '".');
        let head = '';
        if (r.suggested) head = 'No article matches "' + query + '"; did you mean (typos and other word forms, as in game):\n\n';
        else if (r.words) head = 'Nothing matches the whole phrase; articles with most of its words (' +
            r.words.join(', ') + '):\n\n';
        return text(head + r.hits.map((h, i) => {
            const ex = (h.before + h.match + h.after).trim();
            const hint = r.suggested ? S.fuzzyHint(r.suggested[i], l) : '';
            return line(h.article, l) + (hint ? ' [matched: ' + hint + ']' : '') + '\n' + url(h.article.id) +
                (ex ? '\n' + ex : '');
        }).join('\n\n'));
    });

    server.registerTool('help_get', {
        title: 'Read a DreamLand help article',
        description: 'The full text of one help article as Markdown, with links to related articles. ' +
            'Pass the id from help_search, or a keyword: an exact title wins, a keyword several articles share ' +
            'returns them to pick from, anything else gets the best search hit.',
        inputSchema: z.object({
            id: z.number().int().positive().optional().describe('Article id, as in [625].'),
            keyword: z.string().min(1).max(200).optional().describe('Used when no id is given, e.g. "fireball".'),
            lang,
        }),
        annotations: READ_ONLY,
    }, ({ id, keyword, lang: l }) => {
        l = normLang(l);
        let a = null;
        if (id != null) a = c.get(id);
        else if (keyword) {
            const f = c.find(keyword, l);
            if (f.candidates)
                return text('"' + keyword + '" is a keyword of ' + f.candidates.length + ' articles; pick one by id:\n' +
                    f.candidates.map(x => line(x, l)).join('\n'));
            a = f.article || null;
        }
        else return fail('Give an id or a keyword.');
        if (!a) return fail(id != null
            ? 'No public help article ' + id + '. Ids come from help_search.'
            : 'No help article for "' + keyword + '". Try help_search.');

        const meta = [kindOf(a, l), categoryName(a.cat, l)].filter(Boolean).join(' · ');
        const kws = (a.kwList || []).map(k => k.toLowerCase()).join(', ');
        const related = (a.related || []).map(r => c.get(r)).filter(Boolean);
        const out = [
            '# ' + title(a, l),
            [meta, 'id ' + a.id, kws ? 'keywords: ' + kws : ''].filter(Boolean).join(' · '),
            url(a.id),
            '',
            toMarkdown(c.body(a.id, l), c),
        ];
        if (related.length)
            out.push('', 'See also: ' + related.map(r => '[' + title(r, l) + '](' + url(r.id) + ') [' + r.id + ']').join(', '));
        return text(out.join('\n'));
    });

    server.registerTool('help_categories', {
        title: 'DreamLand help categories',
        description: 'The categories of the help index with article counts, in reading order for a newcomer. ' +
            'Pass a key to help_list.',
        inputSchema: z.object({ lang }),
        annotations: READ_ONLY,
    }, ({ lang: l }) => {
        l = normLang(l);
        return text(c.categories(l).map(x => x.key + ': ' + x.name + ' (' + x.count + ')').join('\n'));
    });

    server.registerTool('help_list', {
        title: 'List DreamLand help articles',
        description: 'Every article in one category and/or of one kind, sorted by title. ' +
            'Example: category "classes"; kind "spell"; both: category "magic", kind "spell".',
        inputSchema: z.object({
            category: z.enum(CATEGORIES.map(x => x.key)).optional(),
            kind: z.enum(KIND_NAMES).optional(),
            lang,
        }),
        annotations: READ_ONLY,
    }, ({ category, kind, lang: l }) => {
        l = normLang(l);
        if (!category && !kind) return fail('Give a category (see help_categories), a kind, or both.');
        const list = c.list(category, kind)
            .sort((x, y) => title(x, l).localeCompare(title(y, l)));
        if (!list.length) return text('No articles.');
        return text(list.length + ' articles\n' + list.map(a => line(a, l)).join('\n'));
    });

    const ALIGNS = { good: 'G', neutral: 'N', evil: 'E' };
    server.registerTool('item_search', {
        title: 'Search DreamLand items',
        description: 'Armor and gear, weapons, magic items (potions, pills, scrolls, wands, staves) or pets ' +
            'from the game world, with their stats, who may use them and the zone and mob they come from: ' +
            'the same data as https://dreamland.rocks/searcher.html. Only items placed in the world by zone ' +
            'resets are listed. Sorted by level, or by one bonus, highest first.',
        inputSchema: z.object({
            type: z.enum(ITEM_KINDS).describe('armor (all wearable gear), weapon, magic or pet.'),
            query: z.string().max(100).optional()
                .describe('Part of the name in any language; for magic also a spell name, for pets also a trick.'),
            level_min: z.number().int().min(0).max(MAXLEVEL).optional(),
            level_max: z.number().int().min(0).max(MAXLEVEL).optional(),
            slot: z.array(z.enum(Object.keys(I.SLOTS))).optional().describe('armor: any of these wear slots.'),
            weapon_class: z.array(z.enum(Object.keys(I.WCLASS))).optional().describe('weapon: any of these classes.'),
            magic_type: z.enum(Object.keys(I.ITYPE)).optional(),
            stats: z.array(z.enum(I.STATFILT.map(s => s.k))).optional()
                .describe('armor/weapon: must give every one of these bonuses (hr = hit, dr = damage).'),
            align: z.array(z.enum(Object.keys(ALIGNS))).optional()
                .describe('Only items restricted to these alignments; unrestricted items match none.'),
            include_limited: z.boolean().default(true).describe('false drops items the world holds only a few of.'),
            sort: z.enum(['level', 'damage'].concat(I.STATFILT.map(s => s.k))).default('level')
                .describe('level (lowest first), damage (weapon average), or a bonus, highest first.'),
            lang,
            limit: z.number().int().min(1).max(50).default(20),
        }),
        annotations: READ_ONLY,
    }, (args) => {
        const l = normLang(args.lang);
        const r = items.search(args.type, Object.assign({}, args,
            { align: (args.align || []).map(a => ALIGNS[a]) }), args.limit);
        if (!r.total) return text('Nothing matches. Loosen the filters a little.');
        const head = r.total + ' found' + (r.total > r.items.length ? ', showing ' + r.items.length : '') + ':';
        return text(head + '\n' + r.items.map(it => '- ' + itemLine(args.type, it, l)).join('\n'));
    });

    server.registerTool('who', {
        title: 'Who is playing DreamLand',
        description: 'Characters in the game right now with race, clan, title and remorts, people on the ' +
            'Discord bridge, and this week\'s peak and unique players. With a name: that character\'s race, ' +
            'clan, clan rank and remorts, online or not. The same data the game\'s Discord bot shows.',
        inputSchema: z.object({
            name: z.string().regex(/^[A-Za-z]{2,20}$/).optional().describe('Character name in Latin letters.'),
            lang,
        }),
        annotations: Object.assign({}, READ_ONLY, { idempotentHint: false }),
    }, async ({ name, lang: l }) => {
        l = normLang(l);
        let w;
        try { w = name ? await mudWho(name) : await whoList(); }
        catch (e) { return fail('The game server is not answering, try again in a minute.'); }

        if (name) {
            if (w.error) return text('No character named ' + name + '.');
            const race = { en: w.raceEn, ru: w.race, ua: w.raceUa }[l] || w.raceEn;
            const out = [w.name.en + (w.name.ru ? ' (' + w.name.ru + ')' : '') + ': ' + race + ', ' + remorts(w.remorts, l)];
            if (w.clan) {
                const c = w.clan;
                const cn = { en: c.nameEn, ru: c.name, ua: c.nameUa }[l] || c.nameEn;
                const ct = { en: c.titleEn, ru: c.title, ua: c.titleUa }[l] || c.titleEn;
                const role = [c.leader === 'true' ? 'leader' : '', c.recruiter === 'true' ? 'recruiter' : ''].filter(Boolean);
                out.push('Clan: ' + cn + ', ' + ct + ', clan level ' + c.level + (role.length ? ', ' + role.join(', ') : ''));
            }
            return text(out.join('\n'));
        }

        const people = w.people || [];
        const discord = w.discord || [];
        const out = [people.length + ' in the game' + (discord.length ? ', ' + discord.length + ' on Discord only' : '') +
            '. This week: peak ' + w.weekPeak + ' at once, ' + w.weekUniques + ' different players.'];
        people.forEach(p => {
            const nm = pick(p.name, l);
            const pre = p.pretitle ? (p.pretitle.ru || p.pretitle.en) + ' ' : '';
            const bits = [pick(p.race, l), pick(p.clan, l), remorts(p.remorts, l)].filter(Boolean);
            out.push('- ' + pre + nm + (p.title || '') + ' -- ' + bits.join(', '));
        });
        if (discord.length) out.push('On Discord: ' + discord.map(p => pick(p.name, l)).join(', '));
        return text(out.join('\n'));
    });

    server.registerTool('news_list', {
        title: 'DreamLand news',
        description: 'Game news posted by the immortals, newest first: id, date, author, subject. ' +
            'A query keeps posts whose subject or text has every word of it. Posts are in the language ' +
            'they were written in, mostly Ukrainian, the oldest Russian. Read one with news_get.',
        inputSchema: z.object({
            query: z.string().max(100).optional(),
            limit: z.number().int().min(1).max(50).default(10),
        }),
        annotations: READ_ONLY,
    }, ({ query, limit }) => {
        const r = news.list(query, limit);
        if (!r.total) return text('No news posts match.');
        const head = r.total + ' posts' + (r.total > r.rows.length ? ', newest ' + r.rows.length : '') + ':';
        return text(head + '\n' + r.rows.map(newsLine).join('\n'));
    });

    server.registerTool('news_get', {
        title: 'Read a DreamLand news post',
        description: 'The full text of one news post. Pass the id from news_list; without one, the newest post.',
        inputSchema: z.object({ id: z.number().int().positive().optional() }),
        annotations: READ_ONLY,
    }, ({ id }) => {
        const r = id != null ? news.get(id) : news.all()[0];
        if (!r) return fail('No news post ' + id + '. Ids come from news_list.');
        return text('# ' + r.subject + '\n' + r.date + ', ' + r.from + ' · ' + newsUrl(r.id) + '\n\n' + r.text);
    });

    return server;
}

// MCP clients in a browser need CORS; nothing here reads cookies
function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, Mcp-Protocol-Version');
}

const ABOUT = 'DreamLand MCP server (read-only).\n' +
    'Add it to an MCP client as a Streamable HTTP server: https://dreamland.rocks/mcp/help\n' +
    'Tools: help_search, help_get, help_categories, help_list, item_search, who, news_list, news_get.\n';

http.createServer(async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    // a person opening the URL in a browser gets a note instead of a 405
    if (req.method === 'GET' && !String(req.headers.accept || '').includes('text/event-stream')) {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(ABOUT);
    }
    try {
        const server = buildServer();
        const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on('close', () => { transport.close(); server.close(); });
        await server.connect(transport);
        await transport.handleRequest(req, res);
    } catch (e) {
        console.error('request failed:', e);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null }));
        }
    }
}).listen(PORT, '127.0.0.1', () => console.log('dreamland-help MCP on 127.0.0.1:' + PORT + ', data ' + DATA));
