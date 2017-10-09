#!/bin/sh
cd /home/regis/regis
yarn install
cd /home/regis/regis/public
bower install
cd /home/regis/regis/
typings install
gulp init
