#!/bin/bash

set -e

cd xslt
if [ -e /tmp/story2.xml ]; 
then
        (cat /tmp/story2.xml |
        sed -E  -e 's!<(text|subject)>!<\1><c t="x">!g' \
            -e 's!\{([xdrgybmcw])!</c><c t="fgd\1">!g' \
            -e 's!\{([DRGYBMCW])!</c><c t="fgb\1">!g' \
            -e 's!</(text|subject)>!</c></\1>!g' 
        ) > stories-dump.xml

        echo "Found stories-dump.xml"
fi

echo ">>> Translating with XSLT:"
for i in 'index' 'guide' 'links' 'maps' 'stories' 'legends' 'searcher' 'dev' 'feniaapi';
do
        echo -n "...$i "
        xsltproc main.xslt $i.xml > ../$i.html
        echo "done"
done        
cd ..

./make-news.sh

api_dir='/home/dreamland/runtime/var/misc/api'
for i in `ls $api_dir/*`; do
    echo "Replacing tag $i...";
    tag=`basename $i`
    replace "%$tag%" "`cat $i|iconv -c -f koi8-r -t utf-8`" -- feniaapi.html
done
