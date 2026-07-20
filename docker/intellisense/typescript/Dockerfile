FROM node:22-alpine

RUN npm install --global typescript@5.9.2 typescript-language-server@4.3.4 \
    && npm cache clean --force

COPY entrypoint.sh /usr/local/bin/codegate-typescript-language-server
RUN chmod +x /usr/local/bin/codegate-typescript-language-server

ENTRYPOINT ["codegate-typescript-language-server"]
