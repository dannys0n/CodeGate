#!/bin/sh
set -eu
printf 'module codegate.local/workspace\n\ngo 1.22\n' > /workspace/go.mod
exec gopls "$@"
