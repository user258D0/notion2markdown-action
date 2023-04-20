#!/bin/bash

rm dist -r
npm run build
latest_tag=$(git tag | sort | tail -n 1)
echo Latest tag is $latest_tag
