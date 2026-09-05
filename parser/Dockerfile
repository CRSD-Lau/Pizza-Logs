# Keep the supported Alpine branch and reviewed image digest explicit. Dependabot
# checks /parser weekly; a base refresh must pass the test target and image scan.
FROM python:3.14-alpine3.24@sha256:c6ead215bfd31f1e433d968853b7a769989117115b728874824e6c0a27cb96fc AS dependencies

LABEL org.opencontainers.image.authors="Neil Mitchell"

# Patch util-linux's UUID library while the reviewed Python base still ships r0.
# Both test and runtime targets must exercise the same vendor security fix.
RUN apk add --no-cache --upgrade libuuid=2.42.3-r1

WORKDIR /app

COPY parser/requirements.lock .
RUN pip install --no-cache-dir --require-hashes -r requirements.lock

RUN addgroup -g 10001 appuser && adduser -D -u 10001 -G appuser appuser
COPY --chown=appuser:appuser parser/ .

ENV PORT=8000
EXPOSE 8000

FROM dependencies AS test
# Exercise the same musl/native wheels as production without shipping test tools.
RUN pip install --no-cache-dir --require-hashes -r requirements-dev.lock
USER appuser
CMD ["python", "-m", "pytest", "tests/", "-q"]

FROM dependencies AS runtime
# Install tooling carries a separate vendored dependency tree and is not needed
# by the service. The default/final target contains runtime dependencies only.
RUN python -m pip uninstall -y pip setuptools wheel
USER appuser
CMD ["python", "main.py"]
