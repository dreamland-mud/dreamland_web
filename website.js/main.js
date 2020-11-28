const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')
const ejs = require('ejs')
const xmlParser = require('fast-xml-parser')
const he = require('he')

// Folder where area files can be found. 
var areaDir = process.argv[2];
if (fs.existsSync(areaDir + '/share/DL/areas'))
    areaDir = areaDir + '/share/DL/areas'
else    
    areaDir = areaDir + '/share/DL/areas.local'    

// Folder where this file lives.
process.chdir(__dirname)
var srcMapDir = '../static/maps/sources' 
var destDir = '../static/'
var destMapDir = '../static/maps'

const stripTags = s => {
    return s.replace(/\{[xYy]/g, '')
            .replace(/\{h[cxs]/g, '')
            .replace(/\{hh\d*/g, '')
}

// Generate index.json file, to use in map editor online tool and for map generation here.
//console.log('Reading areas from', areaDir)
var areaList = [];
fs.readdirSync(areaDir).filter(fn => fn.endsWith('.are.xml')).forEach(fn => {
    var areaXml = fs.readFileSync(path.resolve(areaDir, fn), {encoding: 'utf-8'})
    var areaObj = xmlParser.parse(areaXml, {})
    var area = areaObj.area.areadata
    if (area.speedwalk) {
        let speedwalk = stripTags(area.speedwalk)

        areaList.push({
            name: area.name.replace(/{[a-zA-Z]/g, ''),
            credits: area.credits,
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

console.log('Generating maps...')
areaList.forEach(area => {
    let mapPath = path.resolve(srcMapDir, area.map)
    if (fs.existsSync(mapPath)) {
        let map = fs.readFileSync(mapPath)
        ejs.renderFile('templates/map.ejs', { map: map, area: area }, function(err, str) {
            !err || console.log(err)
            fs.writeFileSync(destMapDir + '/' + area.map, str)
        })        
    }
})

// Convert <c c='fgdw'> tags into spans with corresponding class attribute.
// Decode <c/> tags from their &lt;c/&gt; form.
const colourConv = text => {
    let $ = cheerio.load(he.decode(text), {decodeEntities : false});
    $('c').each(function(index, c) {
        var span = $('<span/>')
            .append($(this).contents())
            .addClass($(this).attr('c'))
        $(this).replaceWith(span)
    })
    return $('body').html()
}

console.log('Reading news...')
var newsXml = fs.readFileSync('/tmp/news.xml', {encoding: 'utf-8'})
var newsObj = xmlParser.parse(newsXml, {})

console.log('Reading legends...')
var legendsXml = fs.readFileSync('data/legends-dump.xml', {encoding: 'utf-8'})
var legendsObj = xmlParser.parse(legendsXml, {
    ignoreAttributes: false,
    parseAttributeValue: true,
    attributeNamePrefix : "",
    attrNodeName: "attr",
    textNodeName: "text"
})


console.log('Reading modern stories...')
var storiesXml = fs.readFileSync('/tmp/story2.xml', {encoding: 'utf-8'})
const stories = 
    xmlParser
    .parse(storiesXml, {stopNodes: ['text']})
    .NoteBucket.node
    .map(n => {
        n.text = colourConv(n.text)
        n.subject = colourConv(n.subject)
        return n;
    });


console.log('Reading samurai stories...')
var samuraiXml = fs.readFileSync('/tmp/story1.xml', {encoding: 'utf-8'})
const samurai = 
    xmlParser
    .parse(samuraiXml, {stopNodes: ['text']})
    .NoteBucket.node
    .map(n => {
        n.text = colourConv(n.text)
        n.subject = colourConv(n.subject)
        return n;
    });

console.log('Reading Fenia API...')
var feniaApi = require('/tmp/feniaapi.json')

console.log('Generating HTML files...')

ejs.renderFile('templates/feniaapi.ejs', { api: feniaApi }, function(err, str) {
    !err || console.log(err)
    fs.writeFileSync(destDir + '/feniaapi.html', str)
})

ejs.renderFile('templates/index.ejs', function(err, str) {
    !err || console.log(err)
    fs.writeFileSync(destDir + '/index.html', str)
})

ejs.renderFile('templates/links.ejs', function(err, str) {
    !err || console.log(err)
    fs.writeFileSync(destDir + '/links.html', str)
})

var gallery = require('./data/gallery.json');
gallery.forEach(section => {
        section.portraits.forEach(p => {
            p.text = p.text.join('\n').replace(/{[a-zA-Z]/g, '');
        });
    });    
ejs.renderFile('templates/gallery.ejs', { gallery }, function(err, str) {
    !err || console.log(err)
    fs.writeFileSync(destDir + '/gallery.html', str)
})

ejs.renderFile('templates/searcher.ejs', function(err, str) {
    !err || console.log(err)
    fs.writeFileSync(destDir + '/searcher.html', str)
})

ejs.renderFile('templates/maps.ejs', { areaList: areaList }, function(err, str) {
    !err || console.log(err)
    fs.writeFileSync(destDir + '/maps.html', str)
})

/** Analyze current line and the following one, to see if a forced line break can be safely removed. */
const needsLineBreak = (line, nextline) => {
    let punct = line.match(/[\.\?!:] *$/) != null;
    let nextcap = nextline !== undefined && (nextline.match(/^[А-ЯA-Z]/) != null);
    let nextspace = nextline !== undefined && (
            nextline.match(/^ *[-\*\[] */) != null ||
            nextline.match(/^\s*$/) != null ||
            nextline.match(/^   /) != null);

    // If line ends in punctuation mark and next one begins with a space/asterix, assume it's a break.
    if (punct && nextspace)
        return true;

    // Always keep empty lines as they were.
    if (line.match(/^ *$/) != null)
        return true;

    // If next line starts with a space/asterix, assume a break is required.
    if (nextspace)
        return true;

    // Join all other lines.
    return false;
};

/** Transform node.text, removing extra line breaks added for the sake of 80-character width displays,
  * thus making the text responsive. 
  */
const newsTransformer = nodes => {
    return nodes.map(node => {
        let lines = node.text.split('\n');
        let newtext = '';

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let nextline = i+1 < lines.length ? lines[i+1] : undefined;

            newtext += line.trimEnd();
            if (needsLineBreak(line, nextline)) {
                newtext += '\n';
            } else if (nextline && !nextline.match(/^ /)) {
                newtext += ' ';
            }
        }

        node.text = newtext;
        return node; 
    });
};

const render = (keyword, array, sorter, nodesTransformer) => 
    ejs.renderFile
        ('templates/' + keyword + '.ejs', 
        { notes: nodesTransformer(array.sort(sorter)) }, 
        function(err, str) {
            !err || console.log(err)
            fs.writeFileSync(destDir + '/' + keyword + '.html', str)
        }
    )

render('legends', legendsObj.book.node, (a,b) => a.attr.keyword > b.attr.keyword, nodes => nodes);
render('news',    newsObj.NoteBucket.node, (a,b) => b.id - a.id, newsTransformer)
render('samurai', samurai, (a,b) => a.id - b.id, nodes => nodes);
render('stories', stories, (a,b) => a.id - b.id, nodes => nodes);

console.log('Done')
