#!/bin/bash

set -e

cd maps

for i in sources/*.html
do
       cat map-header.html $i map-footer.html > `basename $i`
done    
