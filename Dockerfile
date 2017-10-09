FROM node:6

# Fix bug https://github.com/npm/npm/issues/9863
RUN cd $(npm root -g)/npm \
  && npm install fs-extra \
  && sed -i -e s/graceful-fs/fs-extra/ -e s/fs\.rename/fs.move/ ./lib/utils/rename.js

RUN useradd -ms /bin/bash node
RUN chown -R node:node /home/node

RUN npm install -g typescript bower gulp node-gyp
RUN apt-get update && apt-get install -y libkrb5-dev

USER node
ENV HOME /home/node
RUN mkdir /home/node/npm && echo "prefix = /home/node/npm" > /home/node/.npmrc && echo "export PATH=/home/node/npm/bin:$PATH" >> /home/node/.profile && . /home/node/.profile

ADD . /home/node/app

USER root
WORKDIR /home/node/app
RUN chown -R node .

USER node
RUN npm install
WORKDIR /home/node/app/public
RUN bower install
WORKDIR /home/node/app
RUN gulp

EXPOSE 3003
VOLUME ["/home/node/app"]
CMD node server.js
