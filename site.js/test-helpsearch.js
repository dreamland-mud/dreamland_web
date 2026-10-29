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

// suggestions on a miss: a port of help.cpp FuzzySearch, same numbers
const sug = (q, lang) => S.fuzzy(index, q, lang || 'en').map(h => h.article.id + ':' + h.kind);
eq('layout flip RU', S.translit('ru', 'ghjrfxrf'), 'прокачка');
eq('layout flip UA', S.translit('ua', 'gjdscnm'), 'повість');
eq('layout flip back', S.translit('ru', 'руддщ'), 'hello');
eq('word: exact / prefix / fuzzy', [S.wordScore('sword', 'sword'), S.wordScore('swo', 'sword'), S.wordScore('swrod', 'sword')], [100, 90, 65]);
eq('word: 4-letter swap and plural, weak substitution', [S.wordScore('bsah', 'bash'), S.wordScore('мечи', 'меч'), S.wordScore('lokk', 'look')], [65, 65, 1]);
eq('word: stem', S.wordScore('прокачатися', 'прокачка'), 65);
eq('typo', sug('firebal'), ['1:text']);
eq('glued pair', sug('fire ball'), ['1:text']);
eq('wrong layout', sug('juytyysq', 'ru'), ['1:flip']);
eq('facet with no hit retries unfiltered', sug('spell swrod'), ['3:text']);
eq('facet filters', sug('spell firebal'), ['1:text']);
eq('number gets nothing', sug('625'), []);
eq('hint only when it adds something', [S.fuzzyHint({ article: index[0], hint: 'fireball', kind: 'text' }, 'en'),
    S.fuzzyHint({ article: index[0], hint: 'огненный', kind: 'text' }, 'en'),
    S.fuzzyHint({ article: index[3], hint: 'swords', kind: 'text' }, 'en')], ['', '', 'swords']);

console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
