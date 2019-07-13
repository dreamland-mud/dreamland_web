#!/bin/bash

function import_file {
    cmd=$1
    file=$2
    
    if [ -f $file ]
    then
        iconv -c -f koi8-r -t utf-8 < $file > $file.utf8
        ./manage.py $cmd $file.utf8 true 
    fi
}

import_file "loaditems" /tmp/db_armor.csv
import_file "loadweapons" /tmp/db_weapon.csv
import_file "loadmagic" /tmp/db_magic.csv
import_file "loadpets" /tmp/db_pets.csv
