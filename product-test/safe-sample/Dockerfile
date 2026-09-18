FROM alpine:3.20

RUN mkdir -p /opt/product \
    && printf '%s\n' 'hero-safe-sample-ready' > /opt/product/READY \
    && printf '%s\n' 'safe-sample-1.0.0-test.1' > /opt/product/VERSION \
    && printf '%s\n' '#!/bin/sh' 'set -eu' 'test "$(cat /opt/product/READY)" = "hero-safe-sample-ready"' 'test "$(cat /opt/product/VERSION)" = "safe-sample-1.0.0-test.1"' > /opt/product/test \
    && chmod 0444 /opt/product/READY /opt/product/VERSION \
    && chmod 0555 /opt/product/test \
    && addgroup -S -g 65532 product \
    && adduser -S -D -H -u 65532 -G product product

USER 65532:65532
WORKDIR /opt/product
CMD ["sleep", "3600"]
HEALTHCHECK --interval=1s --timeout=1s --retries=10 CMD ["/bin/sh", "-c", "test -r /opt/product/READY"]
