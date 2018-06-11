
if('BroadcastChannel' in window) {
    var bc = new BroadcastChannel('location');

    bc.onmessage = function (ev) {
        if(ev.data.what !== 'location')
            return;

        $('.room').removeClass('active');
        $('.room-' + ev.data.location.vnum).addClass('active');
    };

    $(document).ready(function() {
        bc.postMessage({ what: 'where am i' });
    });
}
