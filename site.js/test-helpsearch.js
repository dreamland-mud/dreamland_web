#!/usr/bin/env node
/* Ranking test for static/site/js/helpsearch.js (shared with mudjs and mcp-help).
 *
 *   node site.js/test-helpsearch.js        # exits non-zero on any failure
 */
'use strict';
const path = require('path');
const S = require(path.resolve(__dirname, '../static/site/js/helpsearch.js'));

const index = [
    { id: 1, kwList: ['FIREBALL', 'ОГНЕННЫЙ ШАР'], labels: ['spell'], toc: { ru: 'Огненный шар', en: 'Fireball' } },
    { id: 2, kwList: ['FIRE'], labels: ['cmd'], toc: { ru: 'Огонь', en: 'Fire' } },
    { id: 3, kwList: ['SWORD'], labels: ['skill'], toc: { en: 'Sword' } },
    { id: 4, kwList: ['RULES'], labels: [], toc: { en: 'Rules' } },
    { id: 5, kwList: ['PASSWORD'], labels: ['cmd'], toc: { en: 'Password' } },
];
const bodies = {
    1: "Spell 'fireball' or 'огненный шар'.\n  Level: 20\nFormat: c fireball\n\nA ball of fire that burns the victim and nobody else around it.",
    2: 'Lights a fire.',
    3: 'Swords are common weapons that a warrior learns first of all.',
    4: 'Never use a sword on a newbie, and never share your password with anyone.',
    5: 'Changes your password.',
};
const textFor = S.textCache(id => bodies[id] || '');
const ids = (q, lang, test) => {
    const p = S.parseQuery(S.normQuery(q));
    return S.search(index, p.q, lang || 'en', textFor, 24, test || p.test).map(a => a.id);
};

let failed = 0;
function eq(name, got, want) {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) failed++;
    console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : ': got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)));
}

eq('exact keyword first', ids('fire'), [2, 1]);
eq('facet word narrows', ids('spell fire'), [1]);
eq('bare facet word is a query', ids('spell'), []);
eq('RU title', ids('огненный', 'ru'), [1]);
eq('exact, then title substring, then text', ids('sword'), [3, 5, 4]);
eq('short query skips text', ids('sw'), [3, 5]);
eq('body-only hit', ids('newbie'), [4]);
eq('empty query', ids('   '), []);
eq('kind: spell beats skill', S.kind({ labels: ['skill', 'spell'] }).en, 'spell');
eq('label falls back to RU, then keyword', [S.label(index[0], 'ua'), S.label({ id: 9, kwList: ['X'] }, 'en')], ['Огненный шар', 'X']);
eq('lead skips skill boilerplate', textFor(1).lead.slice(0, 15), 'A ball of fire ');
eq('excerpt marks the hit', S.excerpt(textFor(4), 'password')[1], 'password');
eq('excerpt without a hit is the lead', S.excerpt(textFor(2), 'zzz'), ['Lights a fire.', '', '']);

console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
