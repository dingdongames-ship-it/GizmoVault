# Multi-stage Dockerfile for GizmoVault
# Stage 1: Build Client and Server
FROM node:22-alpine AS builder
WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build Vite client and TypeScript server
RUN npm run build:client
RUN npm run build:server

# Stage 2: Production Runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/server/dist /app/server/dist
COPY --from=builder /app/server/src/db/migrations /app/server/dist/db/migrations
COPY --from=builder /app/client /app/client

# Create directories for persistent SQLite DB and media uploads
RUN mkdir -p /var/data/uploads && chown -R node:node /var/data

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

CMD ["node", "server/dist/index.js"]
