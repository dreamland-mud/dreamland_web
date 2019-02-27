(function($) {
	"use strict"
    
        $(document).ready(function() {
            // Initialize all API tables with DataTable and default settings.
            // autoWidth=false ensures that th-status field is as narrow as specified in columnDefs.
            $('table.table-striped').DataTable( {
                    "autoWidth": false,
                    "columnDefs" : [ {"width":"5%", "targets":"th-status"}]
            });
        });


})(jQuery);

