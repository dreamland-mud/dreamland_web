const express = require('express')
const app = express();

const db_magic = require('/tmp/db_magic.json')
const db_pets = require('/tmp/db_pets.json')
const db_armor = require('/tmp/db_armor.json')
const db_weapon = require('/tmp/db_weapon.json')

const match = (s1, s2) => !s1 || s2.toLowerCase().includes(s1);
const number = (value, dflt) => value ? parseInt(value) : dflt;
const string = s => s ? s.toLowerCase() : s;

const timeLabel = req => req.route.path + ' ' + JSON.stringify(req.query);
const time = req => console.time(timeLabel(req));
const timeEnd = req => console.timeEnd(timeLabel(req));

app.get('/searcher-api/item', (req, res) => {
    time(req);

    let lvl0 = number(req.query.level__range_0, -1);
    let lvl1 = number(req.query.level__range_1, 200);
    let wearloc = req.query.wearloc;
    let search = string(req.query.search);

    res.send( 
        db_armor.filter(item => 
            item.level >= lvl0
            && item.level <= lvl1
            && (!wearloc || item.wearloc === wearloc)
            && match(search, item.name)
        )
    );

    timeEnd(req);
});

app.get('/searcher-api/weapon', (req, res) => {
    let lvl0 = number(req.query.level__range_0, -1);
    let lvl1 = number(req.query.level__range_1, 200);
    let wclass = req.query.wclass;
    let search = string(req.query.search);

    res.send( 
        db_weapon.filter(item => 
            item.level >= lvl0
            && item.level <= lvl1
            && (!wclass || item.wclass === wclass)
            && match(search, item.name)
        )
    );
});

app.get('/searcher-api/pet', (req, res) => {
    let lvl0 = number(req.query.level__range_0, -1);
    let lvl1 = number(req.query.level__range_1, 200);
    let search = string(req.query.search);

    res.send( 
        db_pets.filter(pet => 
            pet.level >= lvl0
            && pet.level <= lvl1
            && match(search, pet.name)
        )
    );
});

app.get('/searcher-api/magicItem', (req, res) => {
    let lvl0 = number(req.query.level__range_0, -1);
    let lvl1 = number(req.query.level__range_1, 200);
    let search = string(req.query.search);
    let type = req.query.itemtype;

    res.send( 
        db_magic.filter(i => 
            i.level >= lvl0
            && i.level <= lvl1
            && (!type || i.type === type)
            && (!search || i.spells.includes(search))
        )
    );
});

app.listen(8001, () => {
    console.log('Searcher app listening on port 8001');
});

