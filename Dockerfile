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

WORKDIR /root
RUN echo '{ "allow_root": true }' > /root/.bowerrc
RUN mkdir /root/npm && echo "prefix = /root/npm" > /root/.npmrc && \
    echo "export PATH=/root/npm/bin:$PATH" >> /root/.profile && \
    . /root/.profile && echo "export PATH=/root/npm/bin:$PATH" >> /root/.bashrc
ENV PATH=/root/npm/bin:$PATH

ENV N_PREFIX=/root
RUN npm i -g npm
RUN npm i -g n
RUN n latest
RUN npm i -g typescript bower nodemon http-server gulp node-gyp js-beautify typings
RUN npm i -g randomatic arr-flatten throat readable-stream write-file-atomic

ADD . /regis
RUN chmod +x /regis/build.sh
RUN chmod +x /regis/start.sh

RUN /regis/build.sh

COPY run /etc/service/regis/
EXPOSE 3003

CMD ["/sbin/my_init"]
