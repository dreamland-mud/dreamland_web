#!/bin/bash

set -e

cd xslt
echo ">>> Translating with XSLT:"
for i in 'index' 'guide' 'links' 'maps' 'stories' 'searcher' 'dev';
do
        echo -n "...$i "
        xsltproc main.xslt $i.xml > ../$i.html
        echo "done"
done        
cd ..

./make-news.sh
