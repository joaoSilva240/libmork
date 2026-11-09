# =============================================================================
# Libmork — Dockerfile (Next.js standalone, otimizado)
# =============================================================================
FROM node:22-alpine AS base

# --- Dependências (layer cacheável via --mount) ---
FROM base AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# --- Build (aproveita cache de deps) ---
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# --- Produção (minimal) ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache su-exec && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/uploads && \
    chown nextjs:nodejs /app/uploads

# O volume de uploads é montado como root; a posse é ajustada antes de baixar os privilégios.
RUN printf '%s\n' '#!/bin/sh' 'chown -R nextjs:nodejs /app/uploads || true' 'exec su-exec nextjs:nodejs "$@"' > /usr/local/bin/entrypoint.sh && \
    chmod +x /usr/local/bin/entrypoint.sh

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/server.js ./server.js

USER root
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
