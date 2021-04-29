const express = require('express')
const app = express()
const fs = require('fs')
const path = require('path')

/** Invalidate 'require' cache whenever a file changes on disk. */
const nocache = module => {
    fs.watchFile(
        path.resolve(module), 
        () => {delete require.cache[require.resolve(module)]}
    )
}

/* Init cache invalidation listeners for all tables. */
nocache('/tmp/db_magic.json')
nocache('/tmp/db_pets.json')
nocache('/tmp/db_armor.json')
nocache('/tmp/db_weapon.json')

/* Request parameter parsing routines. */
const match = (s1, s2) => !s1 || s2.toLowerCase().includes(s1);
const number = (value, dflt) => value ? parseInt(value) : dflt;
const string = s => s ? s.toLowerCase() : s;

/* Profiling/logging routines. */
const timeLabel = req => req.route.path + ' ' + JSON.stringify(req.query);
const time = req => console.time(timeLabel(req));
const timeEnd = req => console.timeEnd(timeLabel(req));

app.get('/searcher-api/item', (req, res) => {
    time(req);

    let lvl0 = number(req.query.level__range_0, -1);
    let lvl1 = number(req.query.level__range_1, 200);
    let wearloc = req.query.wearloc;
    let str = req.query.str;
    let int = req.query.int;
    let wis = req.query.wis;
    let dex = req.query.dex;
    let con = req.query.con;
    let cha = req.query.cha;
    let search = string(req.query.search);

    res.send( 
        require('/tmp/db_armor.json').filter(item => 
            item.level >= lvl0
            && item.level <= lvl1
            && ((!wearloc || wearloc.includes('all')) || wearloc.includes(item.wearloc))
            && (!str || item.stat_str > 0)
            && (!int || item.stat_int > 0)
            && (!wis || item.stat_wis > 0)
            && (!dex || item.stat_dex > 0)
            && (!con || item.stat_con > 0)
            && (!cha || item.stat_cha > 0)
            && match(search, item.name)
        )
    );

    timeEnd(req);
});

app.get('/searcher-api/weapon', (req, res) => {
    time(req);

    let lvl0 = number(req.query.level__range_0, -1);
    let lvl1 = number(req.query.level__range_1, 200);
    let wclass = req.query.wclass;
    let search = string(req.query.search);
    let str = req.query.str;
    let int = req.query.int;
    let wis = req.query.wis;
    let dex = req.query.dex;
    let con = req.query.con;

    res.send( 
        require('/tmp/db_weapon.json').filter(item => 
            item.level >= lvl0
            && item.level <= lvl1
            && ((!wclass || wclass.includes('all')) || wclass.includes(item.wclass))
            && (!str || item.stat_str > 0)
            && (!int || item.stat_int > 0)
            && (!wis || item.stat_wis > 0)
            && (!dex || item.stat_dex > 0)
            && (!con || item.stat_con > 0)
            && match(search, item.name)
        )
    );

    timeEnd(req);
});

app.get('/searcher-api/pet', (req, res) => {
    time(req);

    let lvl0 = number(req.query.level__range_0, -1);
    let lvl1 = number(req.query.level__range_1, 200);
    let search = string(req.query.search);

    res.send( 
        require('/tmp/db_pets.json').filter(pet => 
            pet.level >= lvl0
            && pet.level <= lvl1
            && (match(search, pet.name) || match(search, pet.off))
        )
    );

    timeEnd(req);
});

app.get('/searcher-api/magicItem', (req, res) => {
    time(req);

    let lvl0 = number(req.query.level__range_0, -1);
    let lvl1 = number(req.query.level__range_1, 200);
    let search = string(req.query.search);
    let itemtype = req.query.itemtype;

    res.send( 
        require('/tmp/db_magic.json').filter(i => 
            i.level >= lvl0
            && i.level <= lvl1
            && (!itemtype || i.itemtype === itemtype)
            && (!search || i.spells.includes(search) || match(search, i.name))
        )
    );

    timeEnd(req);
});

app.listen(8001, '127.0.0.1', () => {
    console.log('Searcher app listening on port 8001');
});


