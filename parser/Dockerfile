FROM python:3.14-slim

WORKDIR /app

COPY parser/requirements.lock .
RUN pip install --no-cache-dir --require-hashes -r requirements.lock
# Install tooling is not needed by the parser and carries a separate vendored
# dependency tree. Runtime dependencies above remain installed and hash-locked.
RUN python -m pip uninstall -y pip setuptools wheel

RUN useradd --create-home --uid 10001 appuser
COPY --chown=appuser:appuser parser/ .

ENV PORT=8000
EXPOSE 8000

USER appuser

CMD ["python", "main.py"]
