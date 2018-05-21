(function($) {
	"use strict"
        

    $(document).ready(function() {
        $('#areatable').DataTable( { 
            "paging": false, 
            "searching": true, 
            "info": false,
            "responsive": true,
            "autoWidth": true,
            "language": {
               "search": "Искать:"
            }
        });
    });

})(jQuery);
