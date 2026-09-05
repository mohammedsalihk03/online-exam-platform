FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv libgomp1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHON_COMMAND=/opt/venv/bin/python \
    PYTHONIOENCODING=utf-8 \
    XDG_DATA_HOME=/opt/translation-data \
    XDG_CACHE_HOME=/opt/translation-cache \
    ARGOS_DEVICE_TYPE=cpu
RUN python3 -m venv /opt/venv
COPY server/translation/requirements.txt /tmp/translation-requirements.txt
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r /tmp/translation-requirements.txt
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server
COPY server/ ./server/
RUN python server/translation/install_models.py && npm run build --prefix server \
    && npm prune --omit=dev --prefix server
ENV NODE_ENV=production
EXPOSE 10000
CMD ["npm", "run", "start", "--prefix", "server"]
