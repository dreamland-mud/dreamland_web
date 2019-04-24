const cheerio = require('cheerio')
const fs = require('fs')
const iconv = require('iconv-lite')
const path = require('path')
const ejs = require('ejs')

/** Generate unique link for a help article, in the form '/help/<category>.html#h<id>' */
function linkToArticle(article) {
    var entry = dictionary[article]
    if (!entry)
        return undefined

    var articleID = entry['id']
    var articleLabel = entry['labels'][0]
    return '/help/' + articleLabel + '.html#h' + articleID
}

// Configure folders with HTML source files and result output.
var srcBaseDir = process.argv[2]
var srcDir = srcBaseDir + '/help'
var destDir = process.argv[3] || '../static/help'
// Create output folder if it doesn't exist.
!fs.existsSync(destDir) && fs.mkdirSync(destDir)

// Convert to UTF-8 and parse a JSON file containing mapping between help keyword and unique ID.
var dictionary = JSON.parse(iconv.decode(fs.readFileSync(srcBaseDir + '/allhelp.json'), 'koi8-r'))

// For each <category>.html file, apply its content onto EJS template and save the result.
fs.readdirSync(srcDir).forEach(filename => {
    // Load as a JQuery object, first converting from KOI8-R.
    const $ = cheerio.load(
        iconv.decode(fs.readFileSync(
            path.resolve(srcDir, filename)
        ), 'koi8-r'),
        { decodeEntities: false }
    )
    
    // Add rounded borders to each help article ('cause I'm vain).
    $('.help_panel').addClass('rounded')

    // <hh> tags were introduced for mudjs client protocol and contain 'see also'
    // help keywords that need to be 'hyper-linked' to corresponding help articles.
    // Here we substitute <hh> with corresponding <a href=''> tags.
    $('hh').each(function(index, hh) {
        var article = $(this).contents().text()
        var link = linkToArticle(article)
        if (link)
            $(this).replaceWith(
                $('<a/>').attr('href', link).append(article))
        else
            $(this).replaceWith(article)
    })

    // <c c='xxx'> tags for mudjs contain color markings. They are simply 
    // substituted with <span class=''> tags.
    $('c').each(function(index, c) {
        var span = $('<span/>')
            .append($(this).contents())
            .addClass($(this).attr('c'))
        $(this).replaceWith(span)
    })
        
    // Render category template, providing parts of the transformed DOM as
    // template parameters. Save file to disk when done.
    ejs.renderFile(
        'templates/help-category.ejs', 
        {
            title: $('h2').text(),
            main: $('.help_content').html(),
            aside2: $('.help_menu').html()
        }, 
        function(err, str) {
            fs.writeFileSync(destDir + '/' + filename, str)
        }
    )    
})



