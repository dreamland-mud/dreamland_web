/* Nirvana modular frame: give a .ds-frame its corner / side / keystone parts.
   Same markup as design/index.html injects. Static pages can keep writing the
   spans by hand; pages that render cards from data call DLFrame.dress(el).
   Runs once over the page at load, and skips a frame that already has parts. */
(function () {
    var PARTS = '<span class="ds-frame__c tl"></span><span class="ds-frame__c tr"></span>' +
        '<span class="ds-frame__c bl"></span><span class="ds-frame__c br"></span>' +
        '<span class="ds-frame__s top"></span><span class="ds-frame__s bottom"></span>' +
        '<span class="ds-frame__s left"></span><span class="ds-frame__s right"></span>' +
        '<span class="ds-frame__k"></span><span class="ds-frame__k bottom"></span>';

    function dress(el) {
        if (!el || el.querySelector(':scope > .ds-frame__c')) return el;
        el.insertAdjacentHTML('afterbegin', PARTS);
        return el;
    }

    window.DLFrame = { dress: dress };
    Array.prototype.forEach.call(document.querySelectorAll('.ds-frame'), dress);
})();
