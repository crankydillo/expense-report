FROM ubuntu:16.04

RUN apt-get update && apt-get -y upgrade && apt-get install -y nodejs npm

ADD package.json package.json
ADD lib lib/
ADD public public/
ADD index.js index.js

RUN ln -s /usr/bin/nodejs /usr/bin/node
RUN npm install

# Running with the run options in order to pass parameters to
# node.  Need to find a better way for this.  For example:
# docker run --net=host -d --restart=unless-stopped -p 3000:3000 expense-report node . postgres_user postgres_password
#
# Note your user/password will be accessible to someone who has
# access to the computer running this docker container.

#CMD ["node", "index.js"]
