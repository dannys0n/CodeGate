#!/bin/sh
set -eu
cat > /workspace/tsconfig.json <<'EOF'
{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":false,"noEmit":true}}
EOF
exec typescript-language-server "$@"
