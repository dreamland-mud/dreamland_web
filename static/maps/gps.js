
if('BroadcastChannel' in window) {
	var sessionId = getParameterByName('sessionId');
    var bc = new BroadcastChannel('location');
    var prevArea;

    bc.onmessage = function (ev) {
        if(ev.data.what !== 'location' || ev.data.sessionId !== sessionId)
            return;

        var currentArea = ev.data.location.area;

        if (typeof prevArea === 'undefined') {
            prevArea = currentArea;
        }

        if (currentArea != prevArea) {
            window.location.href = '/maps/' + currentArea.replace(/\.are$/, '') + '.html?sessionId=' + sessionId;
        }

        $('.room').removeClass('active');
        $('.room-' + ev.data.location.vnum).addClass('active');

        var $active = $('.room.active'),
            $follow = $('#follow');

        if($active.length && $follow.length && $follow[0].checked) {
            var off = $active.offset(),
            $vp = $('html, body');

            $vp.scrollTop(off.top-$(window).height()/2);
            $vp.scrollLeft(off.left-$(window).width()/2);
        }
    };

    $(document).ready(function() {
        var $follow = $('#follow');

        if ($follow.length) {	    
	    $follow[0].checked = localStorage.getItem('follow') === 'true' ? true : false;
    	    $follow.change(function() {
	        console.log('Save new autofollow choice', $follow.is(":checked"));
	        localStorage.setItem('follow', $follow.is(":checked"));
	    });
        }		

        bc.postMessage({ what: 'where am i' });
    });
}

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
