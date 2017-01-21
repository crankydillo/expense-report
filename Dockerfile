FROM ubuntu:16.04

RUN apt-get update && apt-get -y upgrade && apt-get install -y nodejs npm

ADD package.json package.json
ADD lib lib/
ADD public public/
ADD index.js index.js

RUN ln -s /usr/bin/nodejs /usr/bin/node
RUN npm install

#CMD ["node", "index.js"]
