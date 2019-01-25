#!/bin/bash

DLHOME="/home/dreamland/runtime"
NEWSFILE=$DLHOME"/var/db/notes/news/all-web.xml"
cd xslt
cp $NEWSFILE news-dump.xml
echo -n ">>> translating with XSLT..."
xsltproc main.xslt news.xml > ../news.html
echo "done"
cd ..

# Colour escaping:
#sed -E  -e 's!<(text|subject)>!<\1><c t="x">!g' \
#        -e 's!\{([^{])!</c><c t="\1">!g' \
#        -e 's!</(text|subject)>!</c></\1>!g' 
