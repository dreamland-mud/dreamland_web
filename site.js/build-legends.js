#!/usr/bin/env node
/* The game's story books -> static/legends.html, one page in the new design.
 *
 *   /tmp/story2.xml                  stories of the new epoch ('webdump story')
 *   /tmp/story1.xml                  Miyamoto's samurai stories ('webdump story')
 *   website.js/data/legends-dump.xml the Second Epoch book of legends (in git)
 *
 * The same three dumps website.js/main.js renders into the old /ru pages.
 * Russian only for now: the EN and UA modes show a one-line note and then
 * the Russian text, tagged lang="ru" so screen readers switch voice.
 *
 * Same policy as build-news.js: a missing dump means a stale page, not a
 * broken deploy, so keep whatever legends.html is already there and exit 0.
 *
 * usage: node site.js/build-legends.js [story2.xml] [story1.xml] [legends-dump.xml]
 */
const fs = require('fs');
const path = require('path');
const { page, write, esc, tri } = require('./shell');

const SRC = {
    stories: process.argv[2] || '/tmp/story2.xml',
    samurai: process.argv[3] || '/tmp/story1.xml',
    legends: process.argv[4] || path.join(__dirname, '../website.js/data/legends-dump.xml')
};

const missing = Object.values(SRC).filter(f => !fs.existsSync(f));
if (missing.length) {
    console.error('no ' + missing.join(', ') + " -- run 'webdump story' in game; keeping existing legends.html");
    process.exit(0);
}

function unent(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
            .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
            .replace(/&amp;/g, '&');
}
/* Colour comes two ways: <c c='fgdw'> tags (live dumps escape them, older
   dumps keep them as XML elements) and {x terminal codes. Parchment has no
   use for either. */
const ctag = /<\/?c\b[^>]*>/g;
function plain(raw) {
    return unent(raw.replace(ctag, '')).replace(ctag, '')
        .replace(/\{hh\d*/g, '').replace(/\{[a-zA-Z0-9]/g, '');
}
function field(node, tag) {
    const m = new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>').exec(node);
    return m ? plain(m[1]) : '';
}
/* drop the blank lines a body opens and closes with, keep the author's indents */
function body(s) {
    return s.replace(/^\s*\n/, '').replace(/\s+$/, '');
}

function notes(file) {
    const xml = fs.readFileSync(file, 'utf8');
    const rows = [];
    const re = /<node>([\s\S]*?)<\/node>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
        rows.push({
            id: parseInt(field(m[1], 'id'), 10) || 0,
            date: field(m[1], 'date').trim(),
            from: field(m[1], 'from').trim(),
            title: field(m[1], 'subject').trim(),
            text: body(field(m[1], 'text'))
        });
    }
    return rows.sort((a, b) => a.id - b.id);   // ids are unix timestamps
}

function book(file) {
    const xml = fs.readFileSync(file, 'utf8');
    const rows = [];
    const re = /<node\s([^>]*)>([\s\S]*?)<\/node>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
        const attr = {};
        m[1].replace(/(\w+)="([^"]*)"/g, (_, k, v) => { attr[k] = plain(v); });
        rows.push({
            id: parseInt((attr.keyword || '').replace(/\D/g, ''), 10) || 0,
            date: '',
            from: (attr.author || '').trim(),
            title: (attr.title || '').trim(),
            text: body(plain(m[2]))
        });
    }
    return rows.sort((a, b) => a.id - b.id);   // page1, page2, ... book order
}

const PARTS = [
    {
        key: 'stories', prefix: 's', rows: notes(SRC.stories),
        name: { en: 'Stories of the New Epoch', uk: 'Історії нової епохи', ru: 'Истории новой эпохи' },
        intro: {
            en: 'Stories players have written since April 2018. In the game, <b>story list</b> shows all of them.',
            uk: 'Історії, які гравці пишуть із квітня 2018 року. У грі повний список показує команда <b>story list</b>.',
            ru: 'Здесь собраны истории, написанные игроками с апреля 2018 года. Полный список можно посмотреть в мире командой <b>story list</b> (<b>истории список</b>).'
        }
    },
    {
        key: 'samurai', prefix: 'm', rows: notes(SRC.samurai),
        name: { en: 'Samurai Stories', uk: 'Самурайські історії', ru: 'Самурайские истории' },
        intro: {
            en: 'Every issue of the samurai stories Miyamoto published in the Fourth Epoch (2004-2005).',
            uk: 'Усі випуски історій про самураїв, які Міямото публікував у Четверту Епоху (2004-2005 роки).',
            ru: 'Здесь собраны все выпуски историй о самураях, которые Миямото публиковал в Четвертую Эпоху (в 2004-2005 годах).'
        }
    },
    {
        key: 'legends', prefix: 'l', rows: book(SRC.legends),
        name: { en: 'Ancient Legends of the Second Epoch', uk: 'Давні легенди Другої Епохи', ru: 'Древние легенды Второй Эпохи' },
        intro: {
            en: 'The book of legends lies in the Midgaard library, on Elms Street. It collects stories written in the Second Epoch, between 2000 and 2001. For newer ones, type <b>story list</b> in the game.',
            uk: 'Книгу легенд можна знайти в бібліотеці Мідгаарда (на Вʼязовій вулиці). У ній зібрані історії, написані в Другу Епоху (між 2000 і 2001 роками). Свіжіші історії читай просто у світі командою <b>story list</b>.',
            ru: 'Книгу легенд можно найти в библиотеке Мидгаарда (на улице Вязов). В ней собраны истории, написанные во Вторую Эпоху (в период с 2000 до 2001 года). Более свежие истории читайте прямо в мире по команде <b>story list</b> (<b>истории список</b>).'
        }
    }
];

const span = t => tri('span', t);
const untitled = 'Без названия';

function story(part, r, i) {
    const id = part.prefix + (r.id || i + 1);
    const meta = [r.from, r.date].filter(Boolean).map(esc).join(' · ');
    return `        <article class="story" id="${id}" aria-labelledby="${id}-h">
            <h3 id="${id}-h">${esc(r.title || untitled)}</h3>
            ${meta ? `<p class="story__meta">${meta}</p>` : ''}
            <div class="story__text">${esc(r.text)}</div>
        </article>`;
}

function part(p) {
    const id = r => p.prefix + (r.id || p.rows.indexOf(r) + 1);
    const all = {
        en: 'All ' + p.rows.length + ' stories',
        uk: 'Усі історії (' + p.rows.length + ')',
        ru: 'Все истории (' + p.rows.length + ')'
    };
    return `    <section class="legends__part" aria-labelledby="${p.key}">
        <h2 id="${p.key}">${span(p.name)}</h2>
        ${tri('p', p.intro)}
        <details class="legends__list">
            <summary>${span(all)}</summary>
            <ol class="ru-always" lang="ru">
${p.rows.map(r => `                <li><a href="#${id(r)}">${esc(r.title || untitled)}</a>${r.from ? ' <span class="legends__by">' + esc(r.from) + '</span>' : ''}</li>`).join('\n')}
            </ol>
        </details>
        <div class="ru-always" lang="ru">
${p.rows.map((r, i) => story(p, r, i)).join('\n')}
        </div>
        <p class="legends__top"><a href="#toc">${span({ en: 'Back to contents', uk: 'До змісту', ru: 'К содержанию' })}</a></p>
    </section>`;
}

const html = page({
    file: 'legends.html',
    title: 'DreamLand — Legends',
    description: 'Tales, stories and legends of DreamLand MUD, written by its players since 2000: the Second Epoch book of legends, the samurai stories and the stories of the new epoch. In Russian.',
    css: 'legends.css',
    note: {
        en: 'the same stories the game keeps in its books',
        uk: 'ті самі історії, що гра зберігає у своїх книгах',
        ru: 'те же истории, что игра хранит в своих книгах'
    },
    body: `<section class="pagehead pagehead--legends">
    <div class="wrap">
        ${tri('h1', { en: 'Legends', uk: 'Легенди', ru: 'Легенды' })}
        ${tri('p', {
            en: 'Tales, stories and legends of DreamLand, written by its players over the years.',
            uk: 'Казки, історії та легенди Світу Мрій, які роками писали його гравці.',
            ru: 'Сказки, истории и легенды Мира Грёз, которые годами писали его игроки.'
        })}
        <p class="legends__note" lang="en">These stories are in Russian for now.</p><p class="legends__note" lang="uk">Поки що ці історії лише російською.</p>
    </div>
</section>

<main class="wrap legends">
    <nav class="legends__toc" aria-labelledby="toc">
        <h2 id="toc">${span({ en: 'Contents', uk: 'Зміст', ru: 'Содержание' })}</h2>
        <ul>
${PARTS.map(p => `            <li><a href="#${p.key}">${span(p.name)}</a> <span class="legends__n">${p.rows.length}</span></li>`).join('\n')}
        </ul>
    </nav>

${PARTS.map(part).join('\n\n')}
</main>`
});

write('legends.html', html);
console.log(PARTS.map(p => p.key + ' ' + p.rows.length).join(' · '));
