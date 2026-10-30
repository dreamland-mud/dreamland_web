/* The item searcher's dumps, for the MCP tools.
 *
 * Reads static/data/db_{armor,weapon,magic,pets}.json, the files searcher.cpp
 * writes every 4 hours and drone copies next to the help data. Filtering is
 * the shared static/site/js/itemsearch.js, the same module the site's
 * searcher page uses, and the output shows what that page shows: no vnums,
 * limited items marked but not counted. Each file is re-read when it changes.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const I = require('../static/site/js/itemsearch.js');

const FILES = { armor: 'db_armor.json', weapon: 'db_weapon.json', magic: 'db_magic.json', pet: 'db_pets.json' };
const MAXLEVEL = 100;

// the site speaks 'uk', the corpus and the MCP tools 'ua'
const L = lang => (lang === 'ua' ? 'uk' : lang);

const UI = {
    level:   { en: 'level',          uk: 'рівень',           ru: 'уровень' },
    anylvl:  { en: 'any level',      uk: 'будь-який рівень', ru: 'любой уровень' },
    usable:  { en: 'usable by',      uk: 'кому доступна',    ru: 'кому доступна' },
    limited: { en: 'limited quantity', uk: 'обмежена кількість', ru: 'ограниченное количество' },
    nobonus: { en: 'no bonuses',     uk: 'без бонусів',      ru: 'без бонусов' },
    hidden:  { en: 'stats unknown (cannot be identified)', uk: 'стати невідомі (не розпізнається)',
               ru: 'характеристики неизвестны (не опознается)' },
    on:      { en: 'found on',       uk: 'де',               ru: 'где' },
    slevel:  { en: 'spell level',    uk: 'рівень закляття',  ru: 'уровень заклинания' },
    charges: { en: 'charges',        uk: 'заряди',           ru: 'заряды' },
};

class Items {
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.data = {};
        this.mtime = {};
    }

    // reload a dump when it changed; a half-written file keeps the old copy
    get(kind) {
        const file = path.join(this.dataDir, FILES[kind]);
        let mtime;
        try { mtime = fs.statSync(file).mtimeMs; }
        catch (e) { if (this.data[kind]) return this.data[kind]; throw e; }
        if (mtime !== this.mtime[kind]) {
            try { this.data[kind] = JSON.parse(fs.readFileSync(file, 'utf8')); this.mtime[kind] = mtime; }
            catch (e) { if (!this.data[kind]) throw e; console.error(kind + ' reload failed, keeping the old dump:', e.message); }
        }
        return this.data[kind];
    }

    /* opts: { query, level_min, level_max, slot[], weapon_class[], magic_type,
       stats[], align[] (G/N/E), include_limited, sort }. Returns { total, items }. */
    search(kind, opts, limit) {
        const f = {
            lo: opts.level_min != null ? opts.level_min : -1,
            hi: opts.level_max != null ? opts.level_max : MAXLEVEL,
            name: String(opts.query || '').trim().toLowerCase(),
            itype: opts.magic_type || '',
            slots: opts.slot || [],
            wclass: opts.weapon_class || [],
            stats: opts.stats || [],
            align: opts.align || [],
            limited: opts.include_limited !== false,
        };
        let hits = this.get(kind).filter(it => I.matches(kind, it, f));
        const by = sortKey(opts.sort);
        if (by) hits = hits.slice().sort((a, b) => (by(b) - by(a)) || (b.level - a.level));
        else hits = hits.slice().sort((a, b) => a.level - b.level);
        return { total: hits.length, items: hits.slice(0, limit) };
    }
}

// 'level' or nothing keeps level order; a stat sorts by that bonus, highest first
function sortKey(sort) {
    if (!sort || sort === 'level') return null;
    if (sort === 'damage') return it => I.num(it.ave) || 0;
    const s = I.STATFILT.find(x => x.k === sort);
    return s ? it => I.num(it[s.field]) || 0 : null;
}

// ---- rendering --------------------------------------------------------

// a dump field in the reader's language, falling back to the Russian one
function dl(item, key, lang) {
    const v = lang === 'en' ? item[key + 'En'] : lang === 'ua' ? item[key + 'Ua'] : null;
    return v != null && v !== '' ? v : (item[key] || '');
}

function bonuses(it, l) {
    const out = [];
    I.STATS.forEach(s => { const v = I.nz(it[s.k]); if (v !== null) out.push(s[l] + ' ' + I.sign(v)); });
    return out.length ? out.join(', ') : UI.nobonus[l];
}

function alignNote(it, l) {
    const letters = String(it.align || '').match(/[GNE]/g);
    return letters ? UI.usable[l] + ': ' + letters.map(x => I.ALIGN[x][l]).join(', ') : '';
}

function place(it, lang) {
    const where = dl(it, 'where', lang);
    return dl(it, 'area', lang) + (where ? ', ' + UI.on[L(lang)] + ': ' + where : '');
}

function line(kind, it, lang) {
    const l = L(lang);
    const lvl = it.level < 0 ? UI.anylvl[l] : UI.level[l] + ' ' + it.level;
    const parts = [dl(it, 'name', lang), lvl];
    // noident items carry '-' in every stat field
    const hidden = it.hr === '-' || it.charges === '-' || it.d1 === '-';
    if (kind === 'armor') {
        const k = I.KIND[it.itemtype];
        const slot = I.SLOTS[it.wearloc];
        parts.push([k ? k[l] : it.itemtype, slot ? slot[l] : it.wearloc].filter(Boolean).join(', '));
        parts.push(hidden ? UI.hidden[l] : bonuses(it, l));
    } else if (kind === 'weapon') {
        const w = I.WCLASS[it.wclass];
        parts.push(w ? w[l] : it.wclass);
        if (hidden) parts.push(UI.hidden[l]);
        else {
            const d1 = I.num(it.d1), d2 = I.num(it.d2);
            if (d1 && d2) parts.push(d1 + 'd' + d2 + (I.num(it.ave) !== null ? ' (~' + it.ave + ')' : ''));
            const eff = I.flagLabels(it.special, I.WSPECIAL, l);
            if (eff.length) parts.push(eff.join(', '));
            parts.push(bonuses(it, l));
        }
    } else if (kind === 'magic') {
        const t = I.ITYPE[it.itemtype];
        parts.push(t ? t[l] : it.itemtype);
        if (hidden) parts.push(UI.hidden[l]);
        else {
            parts.push(UI.slevel[l] + ' ' + it.spellLevel + ', ' + UI.charges[l] + ' ' + it.charges);
            // spell names exist in English and Russian only
            const spells = lang === 'en' ? (it.spells || it.ruspells) : (it.ruspells || it.spells);
            if (spells && spells !== '-') parts.push(spells);
        }
    } else {
        const aff = I.flagLabels(it.aff, I.PETFLAG, l);
        const tricks = I.flagLabels(it.off, I.PETFLAG, l).concat(I.flagLabels(it.act, I.PETFLAG, l));
        if (aff.length) parts.push(aff.join(', '));
        if (tricks.length) parts.push(tricks.join(', '));
        parts.push(dl(it, 'area', lang));
        return parts.join(' · ');
    }
    const al = alignNote(it, l);
    if (al) parts.push(al);
    if (I.isLimited(it)) parts.push(UI.limited[l]);
    parts.push(place(it, lang));
    return parts.join(' · ');
}

module.exports = { Items, line, KINDS: Object.keys(FILES), MAXLEVEL };
