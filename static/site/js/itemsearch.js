/* Item searcher over the game's dumps: one filter for every reader.
 *
 * The site searcher page (searcher.js) and the public MCP server (mcp-help/)
 * filter the same way and label fields with the same words, so a question
 * finds the same items wherever it is asked. The dumps are searcher.cpp's
 * db_{armor,weapon,magic,pets}.json, copied to static/data by drone.
 *
 * Plain ES5, no DOM: a <script> tag sets window.DLItemSearch, require() gets
 * module.exports. Labels are { en, uk, ru }: the site speaks en/uk, the MCP
 * server all three.
 */
(function (root, factory) {
    var api = factory();
    if (root) root.DLItemSearch = api;
    if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    // coerce a field that may be number, "-", "" -> number or null
    function num(v) {
        if (v === '-' || v === '' || v == null) return null;
        var n = parseInt(v, 10);
        return isNaN(n) ? null : n;
    }
    function nz(v) { var n = num(v); return n !== null && n !== 0 ? n : null; } // non-zero
    function sign(n) { return (n > 0 ? '+' : '') + n; }

    // stat fields for the bonus summary
    var STATS = [
        { k: 'hr',   en: 'hit', uk: 'точ', ru: 'точ' }, { k: 'dr', en: 'dam', uk: 'уро', ru: 'урон' },
        { k: 'hp',   en: 'hp',  uk: 'зд',  ru: 'зд'  }, { k: 'mana', en: 'mana', uk: 'мн', ru: 'мн' },
        { k: 'saves',en: 'save',uk: 'спас',ru: 'спас'}, { k: 'move', en: 'mv', uk: 'рух', ru: 'дв' },
        { k: 'stat_str', en: 'str', uk: 'сил', ru: 'сил' }, { k: 'stat_int', en: 'int', uk: 'ум', ru: 'ум' },
        { k: 'stat_wis', en: 'wis', uk: 'мдр', ru: 'мдр' }, { k: 'stat_dex', en: 'dex', uk: 'лвк', ru: 'лвк' },
        { k: 'stat_con', en: 'con', uk: 'слж', ru: 'слж' }, { k: 'stat_cha', en: 'cha', uk: 'оба', ru: 'оба' }
    ];
    var ALIGN = {
        G: { icon: 'al-sun',    en: 'good',    uk: 'добра',      ru: 'добрая' },
        N: { icon: 'al-scales', en: 'neutral', uk: 'нейтральна', ru: 'нейтральная' },
        E: { icon: 'al-skull',  en: 'evil',    uk: 'зла',        ru: 'злая' }
    };
    // wearloc + weapon-class + itemtype option lists (value -> label)
    var SLOTS = {
        light:{en:'light',uk:'світло',ru:'свет'}, finger:{en:'finger',uk:'палець',ru:'палец'},
        neck:{en:'neck',uk:'шия',ru:'шея'}, body:{en:'about body',uk:'навколо тіла',ru:'вокруг тела'},
        head:{en:'head',uk:'голова',ru:'голова'}, legs:{en:'legs',uk:'ноги',ru:'ноги'},
        feet:{en:'feet',uk:'стопи',ru:'ступни'}, hands:{en:'hands',uk:'кисті',ru:'кисти'},
        arms:{en:'arms',uk:'руки',ru:'руки'}, shield:{en:'shield',uk:'щит',ru:'щит'},
        torso:{en:'torso',uk:'тіло',ru:'тело'}, waist:{en:'waist',uk:'пояс',ru:'пояс'},
        wrist:{en:'wrist',uk:'запʼястя',ru:'запястье'}, hold:{en:'held',uk:'у руках',ru:'в руках'},
        float:{en:'floating',uk:'кружляє',ru:'кружится'}, face:{en:'face',uk:'обличчя',ru:'лицо'},
        ears:{en:'ears',uk:'вуха',ru:'уши'}, horse:{en:'horse body',uk:'кінське тіло',ru:'конское тело'},
        hooves:{en:'hooves',uk:'копита',ru:'копыта'}, tattoo:{en:'tattoo',uk:'татуювання',ru:'татуировка'}
    };
    var WCLASS = {
        exotic:{en:'exotic',uk:'екзотика',ru:'экзотика'}, sword:{en:'sword',uk:'меч',ru:'меч'},
        dagger:{en:'dagger',uk:'кинджал',ru:'кинжал'}, spear:{en:'spear/staff',uk:'спис/посох',ru:'копье/посох'},
        mace:{en:'mace',uk:'булава',ru:'булава'}, axe:{en:'axe',uk:'сокира',ru:'топор'},
        flail:{en:'flail',uk:'ціп',ru:'цеп'}, whip:{en:'whip',uk:'батіг',ru:'кнут'},
        polearm:{en:'polearm',uk:'алебарда',ru:'алебарда'}, bow:{en:'bow',uk:'лук',ru:'лук'},
        arrow:{en:'arrow',uk:'стріла',ru:'стрела'}, lance:{en:'lance',uk:'піка',ru:'пика'},
        stone:{en:'stone',uk:'камінь',ru:'камень'}
    };
    var ITYPE = {
        potion:{en:'potion',uk:'зілля',ru:'зелье'}, pill:{en:'pill',uk:'пігулка',ru:'пилюля'},
        scroll:{en:'scroll',uk:'сувій',ru:'свиток'}, wand:{en:'wand',uk:'жезл',ru:'жезл'},
        staff:{en:'staff',uk:'посох',ru:'посох'},
        warp_stone:{en:'warp stone',uk:'камінь спотворення',ru:'искажающий камень'},
        spellbook:{en:'spellbook',uk:'книга заклять',ru:'книга заклинаний'}
    };
    /* Game-data enumerations the dump writes in Russian, translated token by
       token; the Russian label is the key itself. */
    var KIND = {                                   // armor/gear itemtype
        'доспех':{en:'armor',uk:'обладунок'}, 'сокровище':{en:'treasure',uk:'скарб'},
        'драгоценность':{en:'jewellery',uk:'коштовність'}, 'источник света':{en:'light source',uk:'джерело світла'},
        'одежда':{en:'clothing',uk:'одяг'}, 'контейнер':{en:'container',uk:'контейнер'},
        'посох':{en:'staff',uk:'посох'}, 'драгоценный камень':{en:'gemstone',uk:'самоцвіт'},
        'безделушка':{en:'trinket',uk:'дрібничка'}, 'жезл':{en:'wand',uk:'жезл'},
        'свиток':{en:'scroll',uk:'сувій'}, 'искажающий камень':{en:'warp stone',uk:'камінь спотворення'},
        'пища':{en:'food',uk:'їжа'}, 'емкость для жидкости':{en:'drink container',uk:'посудина'},
        'ключ':{en:'key',uk:'ключ'}, 'портал':{en:'portal',uk:'портал'},
        'отмычка':{en:'lockpick',uk:'відмичка'}, 'мебель':{en:'furniture',uk:'меблі'},
        'пергамент':{en:'parchment',uk:'пергамент'}, 'зелье':{en:'potion',uk:'зілля'},
        'лодка':{en:'boat',uk:'човен'}, 'знак религии':{en:'holy symbol',uk:'знак релігії'}
    };
    var WSPECIAL = {                               // weapon flags
        'отточенное':{en:'sharp',uk:'відточена'}, 'двуручное':{en:'two-handed',uk:'дворучна'},
        'шокирующее':{en:'shocking',uk:'струмом'}, 'отравленное':{en:'poisoned',uk:'отруєна'},
        'обмораживающее':{en:'freezing',uk:'морозна'}, 'обжигающее':{en:'flaming',uk:'вогняна'},
        'вампирическое':{en:'vampiric',uk:'вампірична'}, 'священное':{en:'holy',uk:'священна'},
        'смертельное':{en:'deadly',uk:'смертельна'}, 'призрачное':{en:'ghostly',uk:'примарна'},
        'для татуировок':{en:'for tattoos',uk:'для татуювань'}
    };
    [KIND, WSPECIAL].forEach(function (m) { Object.keys(m).forEach(function (k) { m[k].ru = k; }); });
    var PETFLAG = {                                // pet affects / offence / act (EN in dump)
        flying:{en:'flying',uk:'літає',ru:'летает'}, haste:{en:'haste',uk:'пришвидшення',ru:'ускорение'},
        invisible:{en:'invisible',uk:'невидимий',ru:'невидимый'}, pass_door:{en:'pass door',uk:'крізь двері',ru:'сквозь двери'},
        protect_evil:{en:'protect evil',uk:'захист від зла',ru:'защита от зла'},
        protect_good:{en:'protect good',uk:'захист від добра',ru:'защита от добра'},
        regeneration:{en:'regeneration',uk:'регенерація',ru:'регенерация'}, sanctuary:{en:'sanctuary',uk:'святиня',ru:'святилище'},
        slow:{en:'slow',uk:'сповільнення',ru:'замедление'}, sneak:{en:'sneak',uk:'скрадається',ru:'крадется'},
        swim:{en:'swim',uk:'плаває',ru:'плавает'},
        area_attack:{en:'area attack',uk:'атака по площі',ru:'атака по площади'},
        backstab:{en:'backstab',uk:'удар у спину',ru:'удар в спину'},
        bash:{en:'bash',uk:'збиває з ніг',ru:'сбивает с ног'}, berserk:{en:'berserk',uk:'берсерк',ru:'берсерк'},
        crush:{en:'crush',uk:'трощить',ru:'крушит'}, disarm:{en:'disarm',uk:'обеззброює',ru:'обезоруживает'},
        dodge:{en:'dodge',uk:'ухиляється',ru:'уклоняется'}, fast:{en:'fast',uk:'швидкий',ru:'быстрый'},
        kick:{en:'kick',uk:'копає',ru:'пинает'}, kick_dirt:{en:'dirt kick',uk:'пісок в очі',ru:'песок в глаза'},
        parry:{en:'parry',uk:'парирує',ru:'парирует'}, rescue:{en:'rescue',uk:'рятує',ru:'спасает'},
        tail:{en:'tail',uk:'хвостом',ru:'хвостом'}, trip:{en:'trip',uk:'підніжка',ru:'подножка'},
        /* NPC class flags -- UA forms are the canonical ones from CLASSES.md */
        warrior:{en:'warrior',uk:'воїн',ru:'воин'}, mage:{en:'mage',uk:'чаклун',ru:'колдун'},
        cleric:{en:'cleric',uk:'клірик',ru:'клерик'}, thief:{en:'thief',uk:'крадій',ru:'вор'},
        necromancer:{en:'necromancer',uk:'некромант',ru:'некромант'}, rideable:{en:'rideable',uk:'їздовий',ru:'ездовой'}
    };

    /* Two shapes of bonus live in the dump: the six attributes are stored as
       stat_<k>, the combat/pool bonuses under their own bare key. */
    var STATFILT = [
        {k:'str',field:'stat_str',en:'Str',uk:'Сил'},  {k:'int',field:'stat_int',en:'Int',uk:'Ум'},
        {k:'wis',field:'stat_wis',en:'Wis',uk:'Мдр'},  {k:'dex',field:'stat_dex',en:'Dex',uk:'Лвк'},
        {k:'con',field:'stat_con',en:'Con',uk:'Слж'},  {k:'cha',field:'stat_cha',en:'Cha',uk:'Оба'},
        {k:'hr', field:'hr',      en:'Acc',  uk:'Точн'},
        {k:'dr', field:'dr',      en:'Dam',  uk:'Урон'},
        {k:'hp', field:'hp',      en:'HP',   uk:'Здор'},
        {k:'mana',field:'mana',   en:'Mana', uk:'Мана'},
        {k:'saves',field:'saves', en:'Saves',uk:'Спас'}
    ];
    var STATFIELD = {};
    STATFILT.forEach(function (s) { STATFIELD[s.k] = s.field; });
    // every listed stat must be a non-zero bonus on the item
    function hasStats(it, keys) {
        for (var i = 0; i < keys.length; i++)
            if (nz(it[STATFIELD[keys[i]] || ('stat_' + keys[i])]) === null) return false;
        return true;
    }

    // match against every name variant present, so a search works in any language
    function nameHit(item, needle) {
        var keys = ['name', 'nameEn', 'nameUa'];
        for (var i = 0; i < keys.length; i++) {
            var v = item[keys[i]];
            if (v && String(v).toLowerCase().indexOf(needle) >= 0) return true;
        }
        return false;
    }
    // limited = the world holds only N of them at once; the dump says -1 otherwise
    function isLimited(item) {
        var n = num(item.limit);
        return n !== null && n >= 0;
    }
    // a space-separated flag string -> its keys; 'для татуировок' is one flag
    function flagKeys(str) {
        if (!str || str === '-') return [];
        return String(str).replace('для татуировок', 'для_татуировок').split(/\s+/).filter(Boolean)
            .map(function (t) { return t.replace('для_татуировок', 'для татуировок'); });
    }
    // one label per flag in the given language; unknown flags pass through
    function flagLabels(str, map, lang) {
        return flagKeys(str).map(function (k) { return map[k] ? map[k][lang] : k.replace(/_/g, ' '); });
    }

    /* Per-dump predicates over a filter f = { lo, hi, name (lower case), itype,
       slots[], wclass[], stats[], align[], limited }. */
    var FILTERS = {
        armor: function (it, f) {
            if (it.level < f.lo || it.level > f.hi) return false;
            if (f.slots.length && f.slots.indexOf(it.wearloc) < 0) return false;
            if (!hasStats(it, f.stats)) return false;
            if (f.name && !nameHit(it, f.name)) return false;
            return true;
        },
        weapon: function (it, f) {
            if (it.level < f.lo || it.level > f.hi) return false;
            if (f.wclass.length && f.wclass.indexOf(it.wclass) < 0) return false;
            if (!hasStats(it, f.stats)) return false;
            if (f.name && !nameHit(it, f.name)) return false;
            return true;
        },
        magic: function (it, f) {
            if (it.level < f.lo || it.level > f.hi) return false;
            if (f.itype && it.itemtype !== f.itype) return false;
            if (f.name) {
                var s = f.name;
                var hit = (it.spells && it.spells.toLowerCase().indexOf(s) >= 0) ||
                          (it.ruspells && it.ruspells.toLowerCase().indexOf(s) >= 0) ||
                          nameHit(it, s);
                if (!hit) return false;
            }
            return true;
        },
        pet: function (it, f) {
            if (it.level < f.lo || it.level > f.hi) return false;
            if (f.name) {
                var s = f.name;
                if (!nameHit(it, s) &&
                    String(it.off || '').toLowerCase().indexOf(s) < 0) return false;
            }
            return true;
        }
    };

    /* Filters every dump shares, kept out of the per-dump predicates so a
       reader cannot quietly forget one. The dump only fills `align` when the
       item IS restricted, so an item with no letters is unrestricted and
       matches no alignment. */
    function passesCommon(it, f) {
        if (!f.limited && isLimited(it)) return false;
        if (f.align.length) {
            var a = String(it.align || '');
            var hit = false;
            for (var i = 0; i < f.align.length; i++)
                if (a.indexOf(f.align[i]) >= 0) { hit = true; break; }
            if (!hit) return false;
        }
        return true;
    }
    function matches(kind, it, f) { return passesCommon(it, f) && FILTERS[kind](it, f); }

    return {
        num: num, nz: nz, sign: sign, STATS: STATS, ALIGN: ALIGN, SLOTS: SLOTS, WCLASS: WCLASS,
        ITYPE: ITYPE, KIND: KIND, WSPECIAL: WSPECIAL, PETFLAG: PETFLAG, STATFILT: STATFILT,
        hasStats: hasStats, nameHit: nameHit, isLimited: isLimited, flagKeys: flagKeys,
        flagLabels: flagLabels, FILTERS: FILTERS, passesCommon: passesCommon, matches: matches,
    };
});
