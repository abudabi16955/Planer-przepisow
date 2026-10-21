FROM node:24-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 --create-home app \
    && mkdir /data && chown 10001:10001 /data
WORKDIR /app
COPY backend/ ./backend/
RUN python -m venv backend/.venv && backend/.venv/bin/pip install --no-cache-dir ./backend
COPY --from=frontend /build/frontend/dist ./frontend/dist
ENV DATA_DIR=/data PORT=8000 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
USER 10001:10001
VOLUME /data
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD ["backend/.venv/bin/python", "-c", "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('PORT', '8000') + '/api/health', timeout=4)"]
CMD ["sh", "-c", "exec backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port \"$PORT\" --log-level \"${LOG_LEVEL:-info}\""]
