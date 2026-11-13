#!/usr/bin/env node
/* website.js/data/gallery.json + the video and drawing lists below
 *   -> static/gallery.html, in the new design.
 *
 * gallery.json is the same file the old Russian site's gallery page was
 * rendered from. Russian only for now: the EN and UA modes show a one-line
 * note and then the Russian text, tagged lang="ru" for screen readers.
 *
 * usage: node site.js/build-gallery.js [gallery.json]
 */
const fs = require('fs');
const path = require('path');
const { page, write, esc, tri } = require('./shell');

const SRC = process.argv[2] || path.join(__dirname, '../website.js/data/gallery.json');
if (!fs.existsSync(SRC)) {
    console.error('no ' + SRC + ' -- keeping existing gallery.html');
    process.exit(0);
}
const gallery = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const VIDEOS = [
    { title: 'Коллекция видео от Зодда: бои с игроками, квесты, набор опыта',
      href: 'https://www.youtube.com/playlist?list=PL0dWNhrgwYC1BYdJZdW-bUNTDRHtTWk2B', youtube: 'SALkktSfMFM' },
    { title: 'Hart vs Zorg: тренировочный бой', href: 'https://www.youtube.com/watch?v=-kiWTQn4yVk', youtube: '-kiWTQn4yVk' },
    { title: 'Харт, выполняем глобальный квест', href: 'https://youtu.be/tnecwmBDOOY', youtube: 'tnecwmBDOOY' },
    { title: 'Керрад, добываем лимитный пояс', href: 'https://youtu.be/YPvmvBJcMNU', youtube: 'YPvmvBJcMNU' },
    { title: 'Линг, выполняем квест с телефона', file: '/video/ling-quest.mp4' },
    { title: 'Линг, сражение с Лагом с телефона', file: '/video/ling-lag.mp4' },
    { title: 'Баар, "потерпевший в дварфийском лесу"', file: '/video/baar-powerman.mp4' }
];

const DRAWINGS = [
    ['tahi_drow.jpg', 'Tahi Drow'], ['ruffina_satyr.jpg', 'Ruffina Satyr'],
    ['nimu_centaur.jpg', 'Nimu Centaur'], ['lings_rat.jpg', "Ling's rat"],
    ['cradya.jpg', 'Cradya'], ['craruf.jpg', 'Cradya & Ruffina'], ['filths.jpg', 'Filths'],
    ['xantippa.jpg', 'Xantippa'], ['zorg.jpg', 'Zorg'], ['irlana.jpg', 'Irlana']
];

/* Descriptions were typed for an 80-column terminal: rejoin the hard-wrapped
   lines, keep "- " lines as their own lines, and peel off the one @@-framed
   card so a screen reader doesn't spell out a row of at-signs. */
function paragraphs(lines) {
    const out = [];
    let cur = [];
    const flush = () => { if (cur.length) out.push(cur); cur = []; };
    lines.forEach(raw => {
        let l = raw.replace(/\{[a-zA-Z]/g, '').replace(/^[\s@#|]+|[\s@#|]+$/g, '');
        if (!/[0-9A-Za-zА-яЁёІіЇїЄєҐґ]/.test(l)) { flush(); return; }
        l = l.replace(/\s*@+\s*/g, ', ').replace(/\s+/g, ' ');
        if (/^- /.test(l) && cur.length && !/^- /.test(cur[cur.length - 1]))
            flush();
        cur.push(l);
    });
    flush();
    return out.map(p => p.reduce((acc, l, i) =>
        acc + (i == 0 ? '' : /^- /.test(l) ? '<br/>' : ' ') + esc(l), ''));
}

const span = t => tri('span', t);

function video(v) {
    const media = v.youtube
        ? `<a href="${esc(v.href)}"><img src="https://i.ytimg.com/vi/${v.youtube}/mqdefault.jpg" width="320" height="180" loading="lazy" alt="YouTube: ${esc(v.title)}"/></a>`
        : `<video controls preload="none" width="250" height="300" aria-label="${esc(v.title)}"><source src="${v.file}" type="video/mp4"/></video>
                <p><a href="${v.file}">mp4</a></p>`;
    return `            <li class="gallery__video">
                <h3>${esc(v.title)}</h3>
                ${media}
            </li>`;
}

function drawing(d) {
    return `            <li><figure>
                <a href="img/gallery/${d[0]}"><img src="img/gallery/${d[0]}" loading="lazy" alt="${esc(d[1])}"/></a>
                <figcaption aria-hidden="true">${esc(d[1])}</figcaption>
            </figure></li>`;
}

function section(s) {
    return `            <h3>${esc(s.section)}</h3>
${s.portraits.map(p => `            <article class="portrait">
                <h4>${esc(p.name)}</h4>
${paragraphs(p.text).map(t => '                <p>' + t + '</p>').join('\n')}
            </article>`).join('\n')}`;
}

const html = page({
    file: 'gallery.html',
    title: 'DreamLand — Gallery',
    description: 'DreamLand MUD gallery: player videos, character drawings by Nimoa and sample character descriptions. In Russian.',
    css: 'legends.css',
    body: `<section class="pagehead pagehead--legends">
    <div class="wrap">
        ${tri('h1', { en: 'Gallery', uk: 'Галерея', ru: 'Галерея' })}
        ${tri('p', {
            en: 'Videos, drawings and character descriptions made by DreamLand players.',
            uk: 'Відео, малюнки й описи персонажів від гравців Світу Мрій.',
            ru: 'Видео, рисунки и описания персонажей от игроков Мира Грёз.'
        })}
        <p class="legends__note" lang="en">This page is in Russian for now.</p><p class="legends__note" lang="uk">Поки що ця сторінка лише російською.</p>
    </div>
</section>

<main class="wrap legends gallery">
    <section aria-labelledby="videos">
        <h2 id="videos">${span({ en: 'DreamLand video streams', uk: 'Відеостріми Світу Мрій', ru: 'Видео-стримы Мира Грёз' })}</h2>
        <div class="ru-always" lang="ru"><ul class="gallery__videos">
${VIDEOS.map(video).join('\n')}
        </ul></div>
    </section>

    <section aria-labelledby="drawings">
        <h2 id="drawings">${span({ en: 'DreamLand characters drawn by Nimoa', uk: 'Персонажі Світу Мрій, намальовані Німоа', ru: 'Персонажи Мира Грёз, нарисованные Нимоа' })}</h2>
        ${tri('p', {
            en: 'Ideas for new drawings go in <a href="https://docs.google.com/document/d/1Ms65QaylGimSGqBuSzPDKlzDSPPTtL-668rqhgGlHiA/edit">this document</a>. You can order your own portrait!',
            uk: 'Ідеї для нових малюнків записуйте, будь ласка, в <a href="https://docs.google.com/document/d/1Ms65QaylGimSGqBuSzPDKlzDSPPTtL-668rqhgGlHiA/edit">цей документ</a>. Можна замовити свій портрет!',
            ru: 'Идеи для новых рисунков записывайте, пожалуйста, в <a href="https://docs.google.com/document/d/1Ms65QaylGimSGqBuSzPDKlzDSPPTtL-668rqhgGlHiA/edit">этот документ</a>. Можно заказать свой портрет!'
        })}
        <ul class="gallery__drawings">
${DRAWINGS.map(drawing).join('\n')}
        </ul>
    </section>

    <section aria-labelledby="descriptions">
        <h2 id="descriptions">${span({ en: 'Character descriptions', uk: 'Описи персонажів', ru: 'Описания персонажей' })}</h2>
        ${tri('p', {
            en: 'Sample descriptions for some of the races.',
            uk: 'Приклади описів для деяких рас.',
            ru: 'Примеры описаний для некоторых рас.'
        })}
        <div class="ru-always" lang="ru">
${gallery.map(section).join('\n')}
        </div>
    </section>
</main>`
});

write('gallery.html', html);
console.log(gallery.length + ' sections · ' + gallery.reduce((n, s) => n + s.portraits.length, 0) + ' descriptions');
