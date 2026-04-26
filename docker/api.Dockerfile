FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat python3 make g++ \
    && npm install -g pnpm@9 tsup typescript
WORKDIR /app

FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/ephemeris/package.json ./packages/ephemeris/
COPY packages/neo4j/package.json ./packages/neo4j/
RUN pnpm install --no-frozen-lockfile --shamefully-hoist
COPY . .
RUN pnpm install --no-frozen-lockfile --shamefully-hoist
RUN cd apps/api && tsup --config tsup.config.ts

FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init python3 make g++
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 fastify

COPY --from=builder --chown=fastify:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=fastify:nodejs /app/node_modules ./node_modules

# Installer swisseph natif en production
RUN cd /app && npm install swisseph --save-optional 2>/dev/null || echo "swisseph optionnel non disponible"

USER fastify
EXPOSE 4000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.cjs"]
