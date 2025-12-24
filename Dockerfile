# ----------------------------
# APM Terminal MCP Server
# ----------------------------
FROM node:20-slim

# Install build tools for native deps
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency manifests first (Docker cache optimization)
COPY package.json package-lock.json ./

# npm configuration for CI stability
RUN npm config set fund false \
 && npm config set audit false \
 && npm config set legacy-peer-deps true

# Install dependencies (verbose for debuggability)
RUN npm ci --verbose

# Copy application source
COPY . .

# Build TypeScript and remove dev dependencies
RUN npm run build \
 && npm prune --omit=dev

# Create non-root user (security best practice)
RUN useradd -m nodejs \
 && chown -R nodejs:nodejs /app

USER nodejs

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://0.0.0.0:3000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start MCP server
CMD ["node", "build/chat-server.js"]
