FROM python:3.14-slim

WORKDIR /app

COPY parser/requirements.lock .
RUN pip install --no-cache-dir --require-hashes -r requirements.lock

RUN useradd --create-home --uid 10001 appuser
COPY --chown=appuser:appuser parser/ .

ENV PORT=8000
EXPOSE 8000

USER appuser

CMD ["python", "main.py"]
