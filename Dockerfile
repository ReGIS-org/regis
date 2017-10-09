FROM phusion/baseimage:latest
MAINTAINER Berend Weel <b.weel@esciencecenter.nl>

# Keep ssh running
RUN rm -f /etc/service/sshd/down
RUN /etc/my_init.d/00_regen_ssh_host_keys.sh

# Add yarn to package sources
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list

# Install dependencies
RUN apt-get update && apt-get install -y nodejs nodejs-legacy npm git libsass-dev yarn
RUN curl -sL https://deb.nodesource.com/setup_6.x | bash -
RUN apt-get install -y nodejs

RUN /usr/sbin/useradd -p $(openssl passwd regis) -d /home/regis -m --shell /bin/bash regis

USER regis

RUN mkdir /home/regis/npm && echo "prefix = /home/regis/npm" > /home/regis/.npmrc && echo "export PATH=/home/regis/npm/bin:$PATH" >> /home/regis/.profile && . /home/regis/.profile && echo "export PATH=/home/regis/npm/bin:$PATH" >> /home/regis/.bashrc
ENV PATH=/home/regis/npm/bin:$PATH

WORKDIR /home/regis
RUN a=3;
RUN git clone https://github.com/ReGIS-org/regis.git

WORKDIR /home/regis/

ENV N_PREFIX=/home/regis
RUN npm i -g npm
RUN npm i -g n
RUN n latest
RUN npm i -g typescript bower nodemon http-server gulp node-gyp js-beautify typings
RUN npm i -g randomatic arr-flatten throat readable-stream write-file-atomic

COPY build.sh /home/regis/
COPY start.sh /home/regis/

USER root
RUN chmod +x /home/regis/build.sh
RUN chmod +x /home/regis/start.sh

USER regis
RUN /home/regis/build.sh
USER root

COPY run /etc/service/regis/
COPY projects /home/regis/regis/public/data/projects

EXPOSE 3003

CMD ["/sbin/my_init"]
