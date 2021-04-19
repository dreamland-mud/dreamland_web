(function($) {
	"use strict"

        var appUrl = '/searcher-api';

        var areas = {};

        $(document).ready(function() {
          spinner();
          render();
          initAreas();
        });

        function initAreas() {
            $.get("/maps/index.json", function(data) { 
                console.log('Retrieved', data.length, 'areas.');
               
                $.each(data, function(index, value) {
                    areas[value.name] = value.map;
                });
            }, 'json').fail(function() {
                console.log('Cannot retrieve area info.');
            }); 
        }

        // Display "Loading..." progress status.
        function spinner() {
            var node = $('.loading').hide();

            $(document).ajaxStart(function() { node.show(); })
                       .ajaxStop(function() { node.hide(); });
        }

        // Initialize each section of the searcher page.
        function initTable(id, path, columns) {
            var tab = $('#' + id);
            var dataTarget = tab.find('.data-target');
            var table = tab.find('.table');
            var url = appUrl + path;
            var spinner = $('.loading');
            var error = tab.find('.myerror');
            var form = tab.find('form');

            // Initialize DataTable with provided column names.
            table.DataTable( { 
                    "paging": true, 
                    "pagingType": 'numbers',
                    "pageLenght": 50,
                    "lengthMenu": [50, 75, 100],
                    "searching": false, 
                    "info": false,
                    "responsive": false,
                    "autoWidth": false,
                    "columns": columns
            });

            // This event is called after user input is successfully processed
            // inside 'key-pressed' event handler.
            tab.bind('query-items', function(e, params) {
                error.hide();
                spinner.show();
                
                // Request data from back-end.
                $.get(url, params, function(items) {
                    console.log('success:', items.length, 'items');
                    spinner.hide();
                    
                    // Clean up old data.
                    dataTarget.empty();
                    table.DataTable().clear();
                    //Hide pagination if it not needed
                    if (items.length <= table.DataTable().page.info()["length"]) {
                        document.querySelector("div.dataTables_paginate").hidden = true;
                    } else {
                        document.querySelector("div.dataTables_paginate").hidden = false;
                    }
                    // Render received data.
                    for (var i = 0; i < items.length; i++) {
                        items[i]['name'] = items[i]['name'].replace(/</g, "&lt;").replace(/>/g, "&gt;");

                        if (items[i]['limit'] > 0) 
                            items[i]['name'] = "<i class='fas fa-gem fa-fw' aria-hidden='true' title='Лимит'></i><span class='sr-only'>Лимит&nbsp;</span>" + items[i]['name'] + "";

                        var map = areas[items[i]['area']];
                        if (map)
                            items[i]['area'] = "<a target='_blank' href='/maps/" + map + "'>" + items[i]['area'] + "</a>";

                        table.DataTable().row.add(items[i]);
                    }
                    table.DataTable().draw();

                }, 'json').fail(function(e, err, params) {
                    console.log('failure', e, err, params);
                    spinner.hide();
                    error.text('Что-то пошло не так, попробуйте позже.');
                    error.show();
                });
            });

            // Start the query when drop-down is changed. 
            form.find('select').on('change', function(e) {
                e.preventDefault();
                tab.trigger('key-pressed');
            });

            // Start the query when submit button is clicked
            form.find('#submit').on('click', function(e) {
                tab.trigger('key-pressed');
            });

            // Start the query when user presses 'enter' in an input field.
            form.find('input[type=text]').on('keypress', function(e) {
                if (e.which == 13) {
                    tab.trigger('key-pressed');
                }
            });
        }

        // Display item results area and bind triggers.
        function render() {
            // Deselect dropdown values on page reload.
            $('select').val('all').prop('selected', true);
            
            // Initialize armor table.
            initTable('armor', '/item', [ 
                        { "data": "name" }, 
                        { "data": "level" },
                        { "data": "itemtype" },
                        { "data": "hr" },
                        { "data": "dr" },
                        { "data": "hp" },
                        { "data": "mana" },
                        { "data": "saves" },
                        { "data": "stat_str" },
                        { "data": "stat_int" },
                        { "data": "stat_wis" },
                        { "data": "stat_dex" },
                        { "data": "stat_con" },
                        { "data": "stat_cha" },
                        { "data": "align" },
                        { "data": "area" },
                        { "data": "where" },
                    ]);

            // Initialize weapons table.
            initTable('weapon', '/weapon', [ 
                        { "data": "name" }, 
                        { "data": "level" },
                        { "data": "d1" },
                        { "data": "d2" },
                        { "data": "ave" },
                        { "data": "special" },
                        { "data": "hr" },
                        { "data": "dr" },
                        { "data": "hp" },
                        { "data": "mana" },
                        { "data": "saves" },
                        { "data": "stat_str" },
                        { "data": "stat_int" },
                        { "data": "stat_wis" },
                        { "data": "stat_dex" },
                        { "data": "stat_con" },
                        { "data": "align" },
                        { "data": "area" },
                        { "data": "where" },
                    ]);

            // Initialize magic items table.
            initTable('magicItem', '/magicItem', [
                        { "data": "name" }, 
                        { "data": "level" },
                        { "data": "itemtype" },
                        { "data": "spellLevel" },
                        { "data": "charges" },
                        { "data": "spells" },
                        { "data": "area" },
                        { "data": "where" },
                    ]);

            // Initialize pets table.
            initTable('pet', '/pet', [
                        { "data": "name" }, 
                        { "data": "level" },
                        { "data": "act" },
                        { "data": "aff" },
                        { "data": "off" },
                        { "data": "area" },
                    ]);

            // Custom key-pressed event handlers. Triggered by user input events.
            
            // Query all items with given level range, search string and wearloc.
            $('#armor').bind('key-pressed', function(e) {
                var tab=$(this), error = tab.find('.myerror');
                const wearloc = ['all']
                const wear = document.querySelector("#wearloc").querySelectorAll('input:checked');
                if (wear.length && (wear.length !== document.querySelector("#wearloc").querySelectorAll('input').length)) {
                    wearloc.splice(0, wearloc.length);
                    for (let i of wear) {
                        wearloc.push(i.getAttribute('value'))
                    } 
                }
                var search = tab.find('#name').val().toLowerCase(),
                    levelMin = tab.find('#levelMin').val(),
                    levelMax = tab.find('#levelMax').val(),
                    str = tab.find('#str:checked').val(),
                    int = tab.find('#int:checked').val(),
                    wis = tab.find('#wis:checked').val(),
                    dex = tab.find('#dex:checked').val(),
                    con = tab.find('#con:checked').val(),
                    cha = tab.find('#cha:checked').val(),
                    searchCheckbox = tab.find('.paramCheckbox input:checkbox').is(':checked'),
                    params = {
                      'wearloc': wearloc,                        
                      'level__range_0': levelMin,
                      'level__range_1': levelMax,
                      'search': search,
                      'str': str,
                      'int': int,
                      'wis': wis,
                      'dex': dex,
                      'con': con,
                      'cha': cha
                    };

                // Disallow requests for all items.
                if (wearloc.includes('all') && search === '' && !searchCheckbox) {
                    error.text('Выберите, куда надевается предмет, либо задайте критерии поиска.');
                    error.show();
                    return;
                }
                
                tab.trigger('query-items', params);
            });

            // Query all weapons with given level range, search string and weapon class.
            $('#weapon').bind('key-pressed', function(e) {
                var tab=$(this), error = tab.find('.myerror');
                const wclass = ['all']
                const weapon = document.querySelector("#wclass").querySelectorAll('input:checked');
                if (weapon.length && (weapon.length !== document.querySelector("#wclass").querySelectorAll('input').length)) {
                    wclass.splice(0, weapon.length);
                    for (let i of weapon) {
                        wclass.push(i.getAttribute('value'))
                    } 
                }
                var search = tab.find('#name').val().toLowerCase(),
                    levelMin = tab.find('#levelMin').val(),
                    levelMax = tab.find('#levelMax').val(),
                    str = tab.find('#weaponStr:checked').val(),
                    int = tab.find('#weaponInt:checked').val(),
                    wis = tab.find('#weaponWis:checked').val(),
                    dex = tab.find('#weaponDex:checked').val(),
                    con = tab.find('#weaponCon:checked').val(),       
                    searchCheckbox = tab.find('.weaponStatsCheckbox input:checkbox').is(':checked'),
                    params = {
                      'wclass': wclass,
                      'level__range_0': levelMin,
                      'level__range_1': levelMax,
                      'search': search,
                      'str': str,
                      'int': int,
                      'wis': wis,
                      'dex': dex,
                      'con': con
                    };

                // Disallow requests for all items.
                if (wclass.includes('all') && search === '' && !searchCheckbox) {
                    error.text('Выберите тип оружия или задайте строку поиска.');
                    error.show();
                    return;
                }

                tab.trigger('query-items', params);
            });

            // Query all magic items with given level range, spells and item type.
            $('#magicItem').bind('key-pressed', function(e) {
                var tab=$(this), error = tab.find('.myerror');
                var itemtype = tab.find('#itemtype').find('option:selected').val(),
                    search = tab.find('#spells').val().toLowerCase(),
                    levelMin = tab.find('#levelMin').val(),
                    levelMax = tab.find('#levelMax').val(),
                    params = {
                      'level__range_0': levelMin,
                      'level__range_1': levelMax,
                      'search': search
                    };
                
                if (itemtype !== 'all') {
                    params['itemtype'] = itemtype;
                } else if (search === '' && levelMin === '' && levelMax === '') {
                    params['itemtype'] = itemtype;
                }

                // Disallow requests for all items.
                if (itemtype === 'all' && search === '') {
                    error.text('Выберите тип предмета или укажите заклинание.');
                    error.show();
                    return;
                }

                tab.trigger('query-items', params);
            });

            // Query all pets given level range, names.
            $('#pet').bind('key-pressed', function(e) {
                var tab=$(this), error = tab.find('.myerror');
                var search = tab.find('#name').val().toLowerCase(),
                    levelMin = tab.find('#levelMin').val(),
                    levelMax = tab.find('#levelMax').val(),
                    params = {
                      'level__range_0': levelMin,
                      'level__range_1': levelMax,
                      'search': search
                    };
                

                tab.trigger('query-items', params);
            });
            // Populate pets table immediately.
            $('#pet').trigger('key-pressed');

        }
})(jQuery);


