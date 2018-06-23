#!/bin/bash

set -e

cd maps/sources

for i in [a-z0-9]*.html
do
       cat map-header.html $i map-footer.html > ../$i
done    
