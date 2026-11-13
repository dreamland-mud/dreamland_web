const fs = require('fs')
const path = require('path')
const ejs = require('ejs')
const shell = require('../site.js/shell')
const { XMLParser } = require('fast-xml-parser')

// Game dumps carry entities that he.decode handles later, so keep them raw
// here the way fast-xml-parser 3 did.
const parseXml = (xml, opts) => new XMLParser({ processEntities: false, ...opts }).parse(xml)
const he = require('he')

if (process.argv.length <= 2) {
    console.log('Specify full path to DL runtime.');
    process.exit();
}

// Folder where area files can be found. 
var areaDir = process.argv[2];
if (fs.existsSync(areaDir + '/share/DL/areas'))
    areaDir = areaDir + '/share/DL/areas'
else    
    areaDir = areaDir + '/share/DL/areas.local'    

// Folder where this file lives.
process.chdir(__dirname)
var srcMapDir = '../static/maps/sources' 
var bannerMapDir = '../static/maps/banners'
var destMapDir = '../static/maps'

// Everything else this generator used to write (the Russian edition under
// /ru and its root copies) has a page in the new design now, and
// site.js/build-stubs.js turns the old URLs into redirects. What is left here
// has no replacement yet: the per-area ASCII map pages, the maps index the
// map editor and the old item searcher read, and the Fenia API reference.

// Strip MUD markup the way the engine's parse_color_web does: it consumes a {
// and the char after it, emitting nothing for a colour/format code -- and even
// for an unknown one (e.g. a {d typo), which it silently eats. Mirror that for
// the web table: pull the {h help-anchor family first (so {hh1234 leaves no
// tail), then any { followed by a letter/digit or a {* {+ {/ special.
const stripTags = s => (s || '')
    .replace(/\{hh\d*/g, '')
    .replace(/\{h[cxs]/g, '')
    .replace(/\{[a-zA-Z0-9*+\/]/g, '')

/** Given a phrase of several words, some of them with gram cases listed with "|",
  * return the same phrase with all words in nominative case. 
  */
const nominativeCase = phrase =>
    phrase.split(" ").map(word => {
        let matches = word.match(/(.*)\|(.*)\|(.*)\|(.*)\|(.*)\|(.*)\|(.*)/);
        if (!matches)
            return word;
        
        let root = matches[1];
        let ending = matches[2]; // This can be enhanced to return 1+gcase ending for requested grammar case
        return root + ending;

    }).join(" ");


// Generate index.json file, to use in map editor online tool and for map generation here.
//console.log('Reading areas from', areaDir)
var areaList = [];
fs.readdirSync(areaDir).filter(fn => fn.endsWith('.are.xml')).forEach(fn => {
    var areaXml = fs.readFileSync(path.resolve(areaDir, fn), {encoding: 'utf-8'})
    var areaObj = parseXml(areaXml, {})
    var area = areaObj.area.areadata
    if (area.speedwalk && area.speedwalk.length > 1) {
        let speedwalk = stripTags(area.speedwalk[1])

        areaList.push({
            name: he.decode(stripTags(nominativeCase(area.name[1]))),
            credits: he.decode(stripTags(area.name[0])),
            file: fn.replace(/\.xml/, ''),
            map: fn.replace(/\.are\.xml/, '.html'),
            sw: speedwalk,
            msm: speedwalk.match(/^[0-9nsweud]+ *$/i) ? true : false,
            levMin: area.levelLow,
            levMax: area.levelHigh,
            showLevels: area.levelHigh == '0' ? false : true
        })
    }
})

console.log('Found', areaList.length, 'areas, creating index.json')
fs.writeFileSync(destMapDir + '/index.json', JSON.stringify(areaList))

/** Zone description for a map page: the area's own help article, in Russian
  * like the rest of the page, plus the English zone name for the title.
  * Without it every map page is the same template around an ASCII drawing, and
  * search engines file them as duplicates of each other. */
const areaAbout = fn => {
    let xml = fs.readFileSync(path.resolve(areaDir, fn), {encoding: 'utf-8'})
    let area = parseXml(xml, {
        ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', parseTagValue: false
    }).area
    let lang = (field, l) => {
        let v = [].concat(field || []).find(x => x['@_l'] == l)
        return v && v['#text'] ? he.decode(stripTags(String(v['#text']))).trim() : ''
    }
    let help = area.helps && [].concat(area.helps.node)[0]
    let text = help ? lang(help.text, 'ru') : ''
    let paragraphs = text.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(p => p)
    return {
        nameEn: lang(area.areadata.name, 'en'),
        authors: he.decode(String(area.areadata.authors || '')),
        paragraphs
    }
}

/** First sentences of the zone text, cut to what a search snippet shows. */
const snippet = (paragraphs, fallback) => {
    let text = paragraphs.join(' ') || fallback
    if (text.length <= 155)
        return text
    let cut = text.slice(0, 155)
    return cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s.,;:!?-]+$/, '') + '...'
}

console.log('Generating maps...')
const findMapBanner = (areafile, exts) => {
    for (e in exts) {
        let banner = areafile+ '.' + exts[e];
        let bannerPath = path.resolve(bannerMapDir, banner);
        if (fs.existsSync(bannerPath))
            return banner;
    }
    return undefined;
};

areaList.forEach(area => {
    let mapPath = path.resolve(srcMapDir, area.map)
    if (fs.existsSync(mapPath)) {
        let map = fs.readFileSync(mapPath)
        let banner = findMapBanner(area.file, [ 'png', 'jpg' ]);
        let hasBanner = !!banner;
        console.log(area.file, banner, hasBanner);
        let about = areaAbout(area.file + '.xml')
        let fallback = 'Карта зоны ' + area.name + ' в DreamLand MUD.'
        let description = snippet(about.paragraphs, fallback)
        let canonical = 'https://dreamland.rocks/maps/' + area.map
        ejs.renderFile('templates/newmap.ejs', { map, area, hasBanner, banner, about, description, canonical }, function(err, str) {
            !err || console.log(err)
            fs.writeFileSync(destMapDir + '/' + area.map, str)
        })        
    }
})

console.log('Reading Fenia API...')
// The server dumps its API here on every boot; FENIA_API_JSON is for a local run.
let feniaApiPath = process.env.FENIA_API_JSON || '/tmp/feniaapi.json';
if (fs.existsSync(feniaApiPath)) {
    var feniaApi = JSON.parse(fs.readFileSync(feniaApiPath, 'utf8'))

    // Rendered into the new-site shell. scripts/fenia-api.py in the dev
    // workspace parses this page: keep <table id="..."> for every section,
    // plain <tr>/<td> rows and the <h4>name</h4><table> pairs after id="tables".
    ejs.renderFile('templates/feniaapi-body.ejs', { api: feniaApi }, function(err, str) {
        if (err) {
            console.log(err)
            return
        }
        shell.write('feniaapi.html', shell.page({
            file: 'feniaapi.html',
            title: 'DreamLand — Fenia API',
            description: 'Reference of the Fenia scripting API of DreamLand MUD: fields and methods of characters, objects, rooms, prototypes, skills and structures, and every flag table. Generated by the running server. In Russian.',
            css: 'feniaapi.css',
            note: {
                en: 'generated by the running server',
                uk: 'згенеровано сервером, що працює зараз',
                ru: 'сгенерировано работающим сервером'
            },
            body: `<section class="pagehead pagehead--fapi" id="top">
    <div class="wrap">
        ${shell.tri('h1', { en: 'Fenia API', uk: 'Fenia API', ru: 'Fenia API' })}
        ${shell.tri('p', {
            en: 'Fields, methods and flag tables of Fenia, the scripting language the game is written in.',
            uk: 'Поля, методи й таблиці прапорів Fenia, мови сценаріїв, якою написана гра.',
            ru: 'Поля, методы и таблицы флагов Фени, языка сценариев, на котором написана игра.'
        })}
        <p class="fapi__note" lang="en">This reference is in Russian.</p><p class="fapi__note" lang="uk">Цей довідник лише російською.</p>
    </div>
</section>

<main class="wrap fapi ru-always" lang="ru">
${str}
</main>`
        }))
    })
} else {
    console.log('File ', feniaApiPath, 'not found, it will be generated on first DL run.');
}

console.log('Done')
