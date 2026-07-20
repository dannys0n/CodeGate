FROM golang:1.22-alpine

RUN go install golang.org/x/tools/gopls@v0.16.2

COPY entrypoint.sh /usr/local/bin/codegate-gopls
RUN chmod +x /usr/local/bin/codegate-gopls

ENTRYPOINT ["codegate-gopls"]
