#!/usr/bin/env node
/* End-to-end test: start server.js on a spare port and talk MCP to it.
 *
 *   HELP_DATA=/path/to/static/data node test.js
 *   node test.js https://dreamland.rocks/mcp/help     # against a running server
 *
 * Without HELP_DATA the local ../static/data is used; the site build fills it.
 */
'use strict';
const { spawn } = require('child_process');
const path = require('path');

let failed = 0;
function check(name, ok, detail) {
    if (!ok) failed++;
    console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || !detail ? '' : ': ' + String(detail).slice(0, 300)));
}

async function rpc(endpoint, method, params, id) {
    const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
                   'Mcp-Protocol-Version': '2025-06-18' },
        body: JSON.stringify({ jsonrpc: '2.0', id: id || 1, method, params: params || {} }),
    });
    const body = await r.text();
    // the transport may answer as an SSE stream: take the last data line
    const json = (r.headers.get('content-type') || '').includes('text/event-stream')
        ? body.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5)).pop()
        : body;
    return { status: r.status, msg: json ? JSON.parse(json) : null };
}
const call = (e, name, args) => rpc(e, 'tools/call', { name, arguments: args })
    .then(r => ({ isError: !!r.msg.result.isError, text: r.msg.result.content.map(c => c.text).join('\n') }));

async function run(endpoint) {
    const init = await rpc(endpoint, 'initialize', {
        protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
    check('initialize', init.status === 200 && init.msg.result.serverInfo.name === 'dreamland-help', JSON.stringify(init.msg));

    const list = await rpc(endpoint, 'tools/list');
    const names = list.msg.result.tools.map(t => t.name).sort();
    check('four tools', JSON.stringify(names) === JSON.stringify(['help_categories', 'help_get', 'help_list', 'help_search']), names);
    check('all read-only', list.msg.result.tools.every(t => t.annotations && t.annotations.readOnlyHint));

    let r = await call(endpoint, 'help_search', { query: 'fireball' });
    check('search: exact keyword first', /^\[625\] Fireball \(spell\)/.test(r.text), r.text);
    r = await call(endpoint, 'help_search', { query: 'spell fire', lang: 'ua', limit: 3 });
    check('search: facet word + UA titles', r.text.split('\n\n').length === 3 && r.text.includes('(закляття)'), r.text);
    r = await call(endpoint, 'help_search', { query: 'qqqzzzxxx' });
    check('search: no hits is not an error', !r.isError && /No help articles/.test(r.text), r.text);

    r = await call(endpoint, 'help_get', { id: 625 });
    check('get: title, url, body', r.text.startsWith('# Fireball') && r.text.includes('https://dreamland.rocks/help.html#h625') &&
        /Format: `?c fireball/.test(r.text), r.text);
    check('get: no markup left', !/<\/?(c|hh|hg|hc|hs|hl)\b/.test(r.text), r.text);
    check('get: See also', /See also: \[/.test(r.text), r.text);
    r = await call(endpoint, 'help_get', { keyword: 'огненный шар', lang: 'ru' });
    check('get by keyword, RU', r.text.startsWith('# Огненный шар'), r.text.slice(0, 80));
    r = await call(endpoint, 'help_get', { keyword: 'midgaard' });
    check('get: exact title beats a shared keyword', r.text.startsWith('# Midgaard'), r.text.slice(0, 80));
    r = await call(endpoint, 'help_get', { keyword: 'мидгаарда' });
    check('get: shared keyword lists candidates', /keyword of \d+ articles/.test(r.text) && r.text.includes('[1844]'), r.text.slice(0, 200));
    r = await call(endpoint, 'help_search', { query: 'how to level up' });
    check('search: phrase falls back to its words', /^Nothing matches the whole phrase/.test(r.text) && /\n\[\d+\]/.test(r.text), r.text.slice(0, 300));
    r = await call(endpoint, 'help_get', { id: 999999 });
    check('get: unknown id is an error', r.isError, r.text);

    r = await call(endpoint, 'help_categories', {});
    check('categories', /^start: Getting started \(\d+\)/.test(r.text) && r.text.split('\n').length === 14, r.text);
    r = await call(endpoint, 'help_list', { category: 'classes', lang: 'uk' });
    check('list: category, uk alias', /^\d+ articles\n/.test(r.text) && r.text.includes('(клас)'), r.text.slice(0, 200));
    r = await call(endpoint, 'help_list', { kind: 'spell', category: 'magic' });
    check('list: kind + category', /^\d+ articles\n/.test(r.text) && !/\((skill|command)\)/.test(r.text), r.text.slice(0, 200));

    const bad = await rpc(endpoint, 'tools/call', { name: 'help_search', arguments: { query: '' } });
    check('bad args rejected', (bad.msg.error != null) || (bad.msg.result && bad.msg.result.isError), JSON.stringify(bad.msg));

    const page = await fetch(endpoint, { headers: { Accept: 'text/html' } });
    check('browser GET gets a note', page.status === 200 && (await page.text()).includes('help_search'));
}

(async () => {
    const remote = process.argv[2];
    if (remote) { await run(remote); }
    else {
        const port = 18000 + Math.floor(Math.random() * 1000);
        const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
            env: Object.assign({}, process.env, { PORT: String(port) }), stdio: ['ignore', 'pipe', 'inherit'] });
        await new Promise((ok, no) => {
            child.stdout.on('data', d => { if (String(d).includes('MCP on')) ok(); });
            child.on('exit', code => no(new Error('server exited ' + code)));
        });
        try { await run('http://127.0.0.1:' + port + '/mcp/help'); } finally { child.kill(); }
    }
    console.log(failed ? failed + ' failed' : 'all passed');
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
