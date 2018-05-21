#!/bin/bash

DLHOME="/path/to/DL/runtime"

NEWSFILE=$DLHOME"/var/db/notes/news/all-web.xml"
cd xslt
echo "Converting $NEWSFILE:"
echo -n ">>> converting to utf-8..."
iconv -c -f koi8-r -t utf-8 $NEWSFILE > news-dump.xml
echo "done"
echo -n ">>> replacing encoding..."
sed -e 's/encoding="KOI8-R"/encoding="UTF8"/' -i news-dump.xml
echo "done"
echo -n ">>> translating with XSLT..."
xsltproc main.xslt news.xml > ../news.html
echo "done"
cd ..

# Colour escaping:
#sed -E  -e 's!<(text|subject)>!<\1><c t="x">!g' \
#        -e 's!\{([^{])!</c><c t="\1">!g' \
#        -e 's!</(text|subject)>!</c></\1>!g' 
