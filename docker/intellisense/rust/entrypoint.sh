#!/bin/sh
set -eu
mkdir -p /workspace/src
cat > /workspace/Cargo.toml <<'EOF'
[package]
name = "codegate_workspace"
version = "0.0.0"
edition = "2021"

[lib]
path = "src/lib.rs"
EOF
: > /workspace/src/lib.rs
exec rust-analyzer "$@"
