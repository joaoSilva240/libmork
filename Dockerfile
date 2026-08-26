# =============================================================================
# Libmork — Dockerfile (Next.js standalone)
# =============================================================================
FROM node:22-alpine AS base

# --- Dependências ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# --- Produção ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# The custom server imports Socket.IO directly; standalone tracing only
# includes packages imported by the Next application graph.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Diretório de uploads (D-33)
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# The standalone output contains Next's generated server.js. Replace it with
# the custom server that owns the Socket.IO HTTP/WebSocket upgrade listener.
COPY --from=builder --chown=nextjs:nodejs /app/server.js ./server.js

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
