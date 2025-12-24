FROM node:20-slim

# Install build deps
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy lockfiles
COPY package.json package-lock.json ./

# Install deps
RUN npm ci

# Copy source
COPY . .

# Build + remove dev deps
RUN npm run build && npm prune --omit=dev

# Non-root user
RUN useradd -m nodejs && chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://0.0.0.0:3000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "build/chat-server.js"]
