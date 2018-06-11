
$(document).ready(function() {
    var $target, range, $saveButton, source;

    function setMap(html) {
        source = html;
        var themap = $('<html></html>').append(source).find('pre')[0].innerHTML;
        $('#map')
            .empty()
            .append($('<pre>').append(themap));
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
        var arefile = $('#area-file').val();

        if(!arefile) {
            e.preventDefault();
            return;
        }

        var mapfile = arefile.replace(/\.are$/, '') + '.html';

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

        $.ajax({
                url: '/maps/' + mapfile,
                dataType: 'text'
            })
            .then(setMap)
            .fail(function(xhr) {
                console.log('oops', arguments);
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
    });

    $('#props-modal .clear-button').click(function(e) {
        if($target) {
            $target.replaceWith($target.text());
        }
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
                $('#vnum').val('');
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
});
