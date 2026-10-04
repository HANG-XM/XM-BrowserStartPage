#!/bin/bash
set -e
cd "$(dirname "$0")/.."

grep -rhoE "from '[^']+'" src | sed -E "s/^from '([^']+)'$/\1/" > /tmp/imports.txt
grep -rhoE 'src="[^"]+\.(js|css)[^"]*"' index.html | sed -E 's/^src="([^"]+)"$/\1/' >> /tmp/imports.txt

RESULT=$(sort -u /tmp/imports.txt | awk -F'?' '{ if ($1 in m) { if (m[$1] != $0) print "MISMATCH: " $1 "  ->  [" m[$1] "]  vs  [" $0 "]" } else m[$1]=$0 }')
rm -f /tmp/imports.txt

if [ -z "$RESULT" ]; then
  echo "OK: all imports are consistent"
else
  echo "$RESULT"
  exit 1
fi
