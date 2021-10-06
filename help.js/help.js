const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')
const ejs = require('ejs')

process.chdir(__dirname)

var destDir = process.argv[2]
!fs.existsSync(destDir) && fs.mkdirSync(destDir)

/*
 * Dictionary structure:
 *
 * [
 *   { id="333", kw="ААА 'Б Б Б'", kwList=["AAA", "Б Б Б"], text="dolor sit amet", labels=[skill,cmd], titles={skill: "xxx", cmd: "yyy"} },
 *   ...   
 * ]
 */
var dictionary = JSON.parse(fs.readFileSync('/tmp/helps.json'))
//console.log('Loaded', dictionary.length, 'help topics.');

var linksById = new Map(
    dictionary.map(entry => [entry.id, entry])
)
var linksByKeyword = new Map()
for (var i = 0; i < dictionary.length; i++) 
    if (dictionary[i].kwList)
        dictionary[i].kwList.forEach(kw => {
            if (linksByKeyword.get(kw)) {
                //console.log('Duplicated keyword', kw, 'for id', dictionary[i].id, 'and', linksByKeyword.get(kw).id)
	    } else
                linksByKeyword.set(kw, dictionary[i])
        })

//console.log('Created', linksById.size, 'mappings from id to topic, and', linksByKeyword.size, ' - from keyword to topic');

function transformText(text) {
    let $ = cheerio.load(
        text,
        { decodeEntities: false });

    // <hh> tags were introduced for mudjs client protocol and contain 'see also'
    // help keywords that need to be 'hyper-linked' to corresponding help articles.
    // Here we substitute <hh> with corresponding <a href=''> tags.
    $('hh').each(function(index, hh) {
        var article = $(this).contents().text()
        var id = parseInt($(this).attr('id'))
        var link = id ? linksById.get(id) : linksByKeyword.get(article.toUpperCase());

        // TODO: link to /help/all.html if no labels found for {{hh?
        if (link && link.labels) { 
            $(this).replaceWith(
                $('<a/>')
                    .attr('href', '/help/' + link.labels[0] + '.html#h' + link.id)
                    .append(article))
        } else {
            //console.log('No link or label for id [' + id + '] and text', article)
            $(this).replaceWith(article)
        }
    })

    // hc
    $('hc').each(function(index, hc) {
        var cmd = $(this).contents().text()
        $(this).replaceWith($('<span/>').addClass('fgdy').text(cmd))
    })

    // <c c='xxx'> tags for mudjs contain color markings. They are simply 
    // substituted with <span class=''> tags.
    $('c').each(function(index, c) {
        var span = $('<span/>')
            .append($(this).contents())
            .addClass($(this).attr('c'))
        $(this).replaceWith(span)
    })

    return $('body').html().replace(
        /\[map=([-0-9a-z_]{1,15})\.are\]/g, '');
}

function topicTitle(topic, labels) {
    for (var i = 0; i < labels.length; i++)
        if (topic.titles[labels[i]])
           return topic.titles[labels[i]];
}

function saveCategory(labelsInclude, labelsExclude, title) {
    let topics = [];
    for (var i = 0; i < dictionary.length; i++) {        
        let topic = dictionary[i]

        if (!topic.labels || topic.labels.length == 0) {
//            console.log('No labels found for', topic.id, topic.kw.join(' '))
            continue
        }

        if (!labelsInclude.some(l => topic.labels.includes(l))) 
            continue

        if (labelsExclude.some(l => topic.labels.includes(l))) 
            continue

        let t = {}
        t.kw = topic.kw
        t.title = topicTitle(topic, labelsInclude)
        t.text = transformText(topic.text)
        t.id = topic.id
        topics.push(t)
    }

    if (topics.length == 0) {
        //console.log("No topics found for labels", labelsInclude)
        return
    }

    labelsInclude.forEach(label =>    
       ejs.renderFile(
           'templates/help-category.ejs', 
           {
               title: title,
               topics: topics
           }, 
           function(err, str) {
               fs.writeFileSync(destDir + '/' + label + '.html', str)
           }
       )    
    )
}

saveCategory(['race'], [], 'Расы');
saveCategory(['class'], [], 'Классы');
saveCategory(['religion'], [], 'Религии');
saveCategory(['clan'], [], 'Кланы');
saveCategory(['skill'], [], 'Навыки');
saveCategory(['spell'], [], 'Заклинания');
saveCategory(['skillgroup'], [], 'Группы навыков и заклинаний');
saveCategory(['area'], [], 'Зоны');
saveCategory(['social'], [], 'Социалы');
saveCategory(['cmd'], [], 'Все команды');
saveCategory(['quest'], [], 'Квесты');
saveCategory(['char'], [], 'Персонаж');
saveCategory(['info'], [], 'Информация');
saveCategory(['shop', 'bank', 'service' ], [], 'Торговля и услуги');
saveCategory(['learn'], [], 'Обучение');
saveCategory(['item', 'food'], [], 'Предметы');
saveCategory(['move', 'locks', 'position'], [], 'Перемещение');
saveCategory(['fight'], [], 'Битва');
saveCategory(['magic'], [], 'Магия');
saveCategory(['note'], [], 'Переписка');
saveCategory(['comm', 'family'], [], 'Общение и семья'); 
saveCategory(['exoticskill','genericskill'], ['language'], 'Профессиональные умения');
saveCategory(['raceaptitude'], [], 'Расовые умения');
saveCategory(['clanskill'], [], 'Клановые умения');
saveCategory(['craftskill'], [], 'Крафт');
saveCategory(['craft'], [], 'Крафт');
saveCategory(['cardskill'], [], 'Умения картежника');
saveCategory(['language'], [], 'Языки');
// +config, +client, +misc
// +group

saveCategory(['warrior-skills'], [], 'Все умения воина');
saveCategory(['thief-skills'], [], 'Все умения вора');
saveCategory(['cleric-skills'], [], 'Все умения клерика');
saveCategory(['witch-skills'], [], 'Все умения ведьмы');
saveCategory(['warlock-skills'], [], 'Все умения колдуна (варлока)');
saveCategory(['ranger-skills'], [], 'Все умения рейнджера');
saveCategory(['samurai-skills'], [], 'Все умения самурая');
saveCategory(['ninja-skills'], [], 'Все умения ниндзи');
saveCategory(['paladin-skills'], [], 'Все умения паладина');
saveCategory(['anti-paladin-skills'], [], 'Все умения анти-паладина');
saveCategory(['necromancer-skills'], [], 'Все умения некроманта');
saveCategory(['vampire-skills'], [], 'Все умения вампира');
saveCategory(['druid-skills'], [], 'Все умения друида');

saveCategory(['lion-skills'], [], 'Умения клана Львов (Lion)');
saveCategory(['battlerager-skills'], [], 'Умения клана Ярости (Battlerager)');
saveCategory(['knight-skills'], [], 'Умения клана Рыцарей (Knight)');
saveCategory(['chaos-skills'], [], 'Умения клана Хаоса (Chaos)');
saveCategory(['shalafi-skills'], [], 'Умения клана Шалафи (Shalafi)');
saveCategory(['ruler-skills'], [], 'Умения клана Правителей (Ruler)');
saveCategory(['invader-skills'], [], 'Умения клана Захватчиков (Invader)');
saveCategory(['hunter-skills'], [], 'Умения клана Охотников (Hunter)');

ejs.renderFile('templates/help-index.ejs', function(err, str) {
    fs.writeFileSync(destDir + '/index.html', str)
})

ejs.renderFile('templates/landing-classskill.ejs', function(err, str) {
    fs.writeFileSync(destDir + '/classskill.html', str)
})

ejs.renderFile('templates/landing-clanskill.ejs', function(err, str) {
    fs.writeFileSync(destDir + '/clanskills.html', str)
})


/*
 * typeahead.json is used by the quick search box in the header and by webclient help widget:
 * [ {"l": "xxxx.html#h333", "n": "TOPIC NAME"}, ... ]
 * 
 * /tmp/hedit.json is used by the 'hedit' web editor, quick search box.
 * All helps are there, even immortal ones and those without any labels or IDs, so those 2 files
 * need to be kept separate for now.
 * [ {"id": 333, "kw": "TOPIC NAME"}, ... ]
 */
var typeahead = dictionary.map(
    function(topic) {
        if (topic.labels) {
            return {
                'n': topic.kw,
                'l': topic.labels[0] + '.html#h' + topic.id,
                'id': topic.id,
                't': topic.titles ? topic.titles[topic.labels[0]] : topic.kw
            }
        } else {
            console.log('Skipping from typehead.json', topic.kw)
	    }
    })
    .filter(t => t != null)

fs.writeFileSync(destDir + '/typeahead.json', JSON.stringify(typeahead))




