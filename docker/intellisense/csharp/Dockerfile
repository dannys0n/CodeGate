FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine

RUN dotnet tool install --global csharp-ls --version 0.26.0

COPY entrypoint.sh /usr/local/bin/codegate-csharp-language-server
RUN chmod +x /usr/local/bin/codegate-csharp-language-server

ENTRYPOINT ["codegate-csharp-language-server"]
