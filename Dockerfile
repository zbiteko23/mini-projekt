# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY server.js      ./
COPY index.html     ./
COPY styles.css     ./
COPY script.js      ./
COPY package.json   ./

# Render.com sets PORT automatically (default 10000)
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
