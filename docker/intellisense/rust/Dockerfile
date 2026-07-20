FROM rust:1.78-slim

RUN rustup component add rust-analyzer rust-src

COPY entrypoint.sh /usr/local/bin/codegate-rust-analyzer
RUN chmod +x /usr/local/bin/codegate-rust-analyzer

ENTRYPOINT ["codegate-rust-analyzer"]
