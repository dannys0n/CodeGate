#!/bin/sh
set -eu
cat > /workspace/CodeGate.csproj <<'EOF'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>disable</Nullable>
  </PropertyGroup>
</Project>
EOF
exec /root/.dotnet/tools/csharp-ls "$@"
