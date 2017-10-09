#!/bin/sh
cd /regis
yarn install
cd /regis/public
bower install
cd /regis/
typings install
gulp init
