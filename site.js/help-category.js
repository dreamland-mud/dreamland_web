/* The help category resolver -- HELP_IA.md section 2.
 *
 * One algorithm, three implementations: scripts/help_category.py (tooling and
 * QA), this one (the website), and the engine's C++ (the in-game browser and the
 * `cat` field it will add to the dump). The Python file is the specification;
 * this is a transcription of it and must not drift.
 *
 * An article carries at most one topical key in its labels. If it has none, the
 * engine's own transient facets decide, in the fixed order below -- that fallback
 * alone places about 1150 of the 1342 player-visible articles, which is why only
 * ~190 concept and command articles ever needed assigning by hand.
 *
 * Resolution happens at BUILD time, not in the browser: until the game reloads
 * its plug-ins the dump still carries the old labels, so build-help.js layers
 * help-categories.json (generated from the same table that relabelled the XML)
 * over whatever the dump says. Once the engine emits `cat` itself, that field
 * wins and the override file can go.
 */
'use strict';

const TOPICAL = [
    'start', 'char', 'combat', 'skills', 'magic', 'classes', 'races', 'gods',
    'items', 'quests', 'world', 'society', 'comm', 'socials',
];
const NON_PLAYER = ['imm', 'credits', 'engine', 'deprecated'];
const ALL_KEYS = TOPICAL.concat(NON_PLAYER);

/* Names match the help app's rail (static/site/js/help.js SECTIONS). */
const DISPLAY = {
    start:   { en: 'Getting started', ua: 'З чого почати', ru: 'С чего начать' },
    char:    { en: 'Your character', ua: 'Твій персонаж', ru: 'Твой персонаж' },
    combat:  { en: 'Combat', ua: 'Бій', ru: 'Бой' },
    skills:  { en: 'Skills and learning', ua: 'Вміння й навчання', ru: 'Умения и обучение' },
    magic:   { en: 'Spells and magic', ua: 'Закляття й магія', ru: 'Заклинания и магия' },
    classes: { en: 'Classes', ua: 'Класи', ru: 'Классы' },
    races:   { en: 'Races', ua: 'Раси', ru: 'Расы' },
    gods:    { en: 'Gods and religions', ua: 'Боги й релігії', ru: 'Боги и религии' },
    items:   { en: 'Items and economy', ua: 'Речі й господарство', ru: 'Вещи и хозяйство' },
    quests:  { en: 'Quests', ua: 'Квести', ru: 'Квесты' },
    world:   { en: 'World and travel', ua: 'Світ і подорожі', ru: 'Мир и путешествия' },
    society: { en: 'Players and clans', ua: 'Гравці й клани', ru: 'Игроки и кланы' },
    comm:    { en: 'Communication and settings', ua: 'Спілкування й налаштування', ru: 'Общение и настройки' },
    socials: { en: 'Socials', ua: 'Соціали', ru: 'Социалы' },
};

/* The order the help app's rail shows them in (static/site/js/help.js
 * SECTIONS): the reading order a newcomer wants, not alphabetical. The static
 * help index (build-help-pages.js) uses the same one. */
const SHELVES = ['start', 'char', 'skills', 'magic', 'combat', 'classes', 'races',
    'gods', 'items', 'world', 'quests', 'society', 'comm', 'socials'];

/* A spell also carries `skill` and a class facet, so `spell` has to be tried
 * first or every spell would land on the skills shelf. */
const FALLBACK = [
    ['spell', 'magic'],
    ['social', 'socials'],
    ['mobrace', 'world'],
    ['race', 'races'], ['raceaptitude', 'races'],
    ['religion', 'gods'],
    ['class', 'classes'], ['skillgroup', 'skills'],
    ['craft', 'items'], ['craftskill', 'items'],
    ['item', 'items'],
    ['clanskill', 'skills'], ['cardskill', 'skills'],
    ['language', 'skills'],
    ['skill', 'skills'],
    ['area', 'world'],
    ['clan', 'society'],
];

function resolve(labels) {
    const ls = labels || [];
    for (const key of ALL_KEYS) if (ls.indexOf(key) >= 0) return key;
    for (const [facet, cat] of FALLBACK) if (ls.indexOf(facet) >= 0) return cat;
    for (const l of ls) if (/-skills$/.test(l)) return 'classes';
    return null;
}

function isPlayer(cat) { return TOPICAL.indexOf(cat) >= 0; }

module.exports = { TOPICAL, NON_PLAYER, ALL_KEYS, DISPLAY, SHELVES, resolve, isPlayer };
