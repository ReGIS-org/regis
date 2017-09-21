# ReGIS: Research Environment for GIS
This project is the front-end for ReGIS.
It is based on the [csWeb framework](https://github.com/TNOCS/csWeb) and adds
functionality to run GIS simulations and models on compute infrastructure
using GIS-Sim

# Getting started
The easiest way to use ReGIS is to install the stack by following the instructions
at [readthedocs](http://regis.readthedocs.io/)

## For developers
If you want to develop your own implementation based on ReGIS the installation
instructions are below.

### Tools
We depend on node and bower and use typescript to develop. You can install all necessary tools by invoking:
```shell
npm i -g typescript bower nodemon http-server
```
### Dependencies
 We depend on [csWeb](https://github.com/TNOCS/csWeb) created by [TNO](https://www.tno.nl/en/).

### Getting and compiling csWeb.
Clone the csWeb project into a directory and build it:
```shell
git clone https://github.com/TNOCS/csWeb

cd csWeb
npm install
gulp init
```

Now we need to make sure csWeb is available for npm and bower to use in the sim-city-cs project. To do this we link the project in the following way:

```shell
bower link

cd out/csServerComp
npm link
```

### Compiling and Running sim-city-cs
1. Install the yarn and bower dependencies:
```shell
yarn install
cd public && bower install && cd ..
```

2. Link the csWeb npm and bower components:
```shell
npm link csweb
cd public && bower link csweb && cd ..
```

3. Build the project using gulp and start the server
``` shell
gulp
gulp serve
```

# Credit
Icons used in projects:
 - Flame by Nadav Barkan from the Noun Project
