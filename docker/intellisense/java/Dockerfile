FROM alpine/java:22-jdk

ARG JDTLS_VERSION=1.57.0
ARG JDTLS_BUILD=202602261110
RUN apk add --no-cache curl tar \
    && mkdir -p /opt/jdtls \
    && curl --fail --location --retry 3 \
      "https://download.eclipse.org/jdtls/milestones/${JDTLS_VERSION}/jdt-language-server-${JDTLS_VERSION}-${JDTLS_BUILD}.tar.gz" \
      | tar -xz -C /opt/jdtls

COPY entrypoint.sh /usr/local/bin/codegate-jdtls
RUN chmod +x /usr/local/bin/codegate-jdtls

ENTRYPOINT ["codegate-jdtls"]
