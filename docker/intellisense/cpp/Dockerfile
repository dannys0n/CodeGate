FROM gcc:13

RUN apt-get update \
    && apt-get install --yes --no-install-recommends clangd \
    && rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["clangd"]
