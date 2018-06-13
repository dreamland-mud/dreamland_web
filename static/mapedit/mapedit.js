
$(document).ready(function() {
    var $target, range, $saveButton, source, lastLocation;

    function scrollToActive() {
	var $active = $('.room.active'),
	    $follow = $('#follow');

	if($active.length && $follow.length && $follow[0].checked) {
	    var off = $active.offset(),
		$vp = $('html, body');

	    $vp.scrollTop(off.top-$(window).height()/2);
	    $vp.scrollLeft(off.left-$(window).width()/2);
	}
    }

    function updateActive() {
        $('.room').removeClass('active');

	if(!lastLocation)
	    return;

        $('.room-' + lastLocation.vnum).addClass('active');
    }

    if('BroadcastChannel' in window) {
        var bc = new BroadcastChannel('location');
    
        bc.onmessage = function (ev) {
            if(ev.data.what !== 'location')
                return;
    
	    lastLocation = ev.data.location;

	    updateActive();

	    if(lastLocation) {
	        $('#currentLocationBlock')
	    	    .text('Положение персонажа: ' + lastLocation.area + ', ' + lastLocation.vnum)
		    .show();
            } else {
	        $('#currentLocationBlock').hide();
            }
        };
    
        bc.postMessage({ what: 'where am i' });
    }

    function setMap(html) {
        source = html;
        var themap = $('<html></html>').append(source).find('pre')[0].innerHTML;
        $('#map')
            .empty()
            .append($('<pre>').append(themap));
	
        updateActive();
    }

    $('#load-button').change(function(e) {
        $('#area-file').val('');

        var reader = new FileReader();
        reader.onload = function() {
            setMap(reader.result);
        };
        var file = $('#load-button')[0].files[0];
        reader.readAsText(file);
    });

    $saveButton = $('#save-button');

    $saveButton.click(function(e) {
        var mapfile, arefile = $('#area-file').val();

        if(arefile) {
            mapfile = arefile.replace(/\.are$/, '') + '.html';
	} else {
	    var files = $('#load-button')[0].files;

	    if(files) {
                mapfile = files[0].name;
            }
        }

        if(!mapfile) {
            e.preventDefault();
            return;
        }

        URL.revokeObjectURL($saveButton.attr('href'));

        var doc = new DOMParser().parseFromString(source, 'text/html');

        $(doc).find('pre')[0].innerHTML = $('#map pre')[0].innerHTML;

        var str = new XMLSerializer().serializeToString(doc);

        var blob = new Blob([str], {type : 'text/html; charset=UTF-8'});
        
        $saveButton
            .attr({
                href: URL.createObjectURL(blob),
                download: mapfile
            });

        // do not prevent default
    });

    $.ajax({
            url: '/maps/index.json',
            dataType: 'json'
        })
        .then(function(data) {
            var $select = $('#area-file').empty();

            $('<option>')
                .text('Выбери зону с сервера')
                .val('')
                .appendTo($select);

            $.each(data, function() {
                $('<option>')
                    .val(this.file)
                    .text(this.name + ' (' + this.file + ')')
                    .appendTo($select);
            });
        })
        .fail(function(xhr) {
            console.log('oops', arguments);
        });

    $('#area-file').change(function(e) {
        var arefile = $('#area-file').val();
        
        if(!arefile) {
            return;
        }

        $('#load-button').val('');

        var mapfile = arefile.replace(/\.are$/, '') + '.html';
        
        $('#map').empty();

        $('#area-file').prop('disabled', 'disabled');
        $.ajax({
                url: '/maps/' + mapfile,
                dataType: 'text'
            })
            .then(setMap)
            .fail(function(xhr) {
                console.log('oops', arguments);
            })
	    .always(function() {
                $('#area-file').prop('disabled', false);
	    });
    });

    $('#props-modal #vnum').on('keypress', function(e) {
        if (e.which == 13) {
           e.preventDefault();
           $('#props-modal .ok-button').trigger('click');
        }
    });

    $('#props-modal .ok-button').click(function(e) {
        var vnums = $('#vnum').val().match(/\d+/g);

        if(vnums) {
            var $span = $('<span>')
                .addClass('room ' + vnums.map(function(s) { return 'room-' + s; } ).join(' '));

            if($target) {
                $span.text($target.text());
                $target.replaceWith($span);
            } else {
                $span.text(range.toString());
                range.extractContents();
                range.insertNode($span[0]);
            }
        } else { // clear vnum info
            if($target) {
                $target.replaceWith($target.text()); 
            } else {
                var text = range.toString();
                range.extractContents();
                range.insertNode(document.createTextNode(text));
            }
        }

	updateActive();
    });

    $('#props-modal').on('shown.bs.modal', function () {
        $('#vnum').focus();
    });

    $('#map').keydown(function(e) {
        if(e.which == 13) {
            range = getSelection().getRangeAt(0).cloneRange();
            if(!range.collapsed) {
                e.preventDefault();
                $target = null;
                $('#text').val(range.toString());
		if(lastLocation) {
                    $('#vnum').val(lastLocation.vnum);
                } else {
                    $('#vnum').val('');
                }
                $('#props-modal').modal('show');
            }
        }
    });
    
    $('body').click(function(e) {
        if($(e.target).is('.room')) {
            e.preventDefault();
            $target = $(e.target);
            $('#text').val($target.text().toString());
            $('#vnum').val(
                $($target.attr('class').split(/\s+/))
                    .filter(function() { return this.startsWith('room-'); })
                    .map(function() { return this.substring(5); })
                    .get()
                    .join(' ')
                );

            $('#props-modal').modal('show');
        }
    });

    function changeFontSize(delta) {
	var terminal = $('#map pre');
        var style = terminal.css('font-size'); 
        var fontSize = parseFloat(style); 
        terminal.css('font-size', (fontSize + delta) + 'px');
    }

    $('#font-plus-button').click(function(e) {
        e.preventDefault();
        changeFontSize(2);
    });

    $('#font-minus-button').click(function(e) {
        e.preventDefault();
        changeFontSize(-2);
    });
});
