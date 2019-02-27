#!/bin/bash

set -e

cd xslt
echo ">>> Translating with XSLT:"
for i in 'index' 'guide' 'links' 'maps' 'stories' 'searcher' 'dev' 'feniaapi';
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
