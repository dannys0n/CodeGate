#!/bin/sh
set -eu
launcher="$(find /opt/jdtls/plugins -name 'org.eclipse.equinox.launcher_*.jar' | head -n 1)"
cp -R /opt/jdtls/config_linux /tmp/jdtls-config
exec /opt/java/openjdk/bin/java \
  -Declipse.application=org.eclipse.jdt.ls.core.id1 \
  -Dosgi.bundles.defaultStartLevel=4 \
  -Declipse.product=org.eclipse.jdt.ls.core.product \
  -Dlog.level=ERROR \
  -Xmx768m \
  --add-modules=ALL-SYSTEM \
  --add-opens java.base/java.util=ALL-UNNAMED \
  --add-opens java.base/java.lang=ALL-UNNAMED \
  -jar "$launcher" \
  -configuration /tmp/jdtls-config \
  -data /tmp/jdt-workspace \
  "$@"
