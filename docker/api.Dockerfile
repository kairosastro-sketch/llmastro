FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat python3 py3-setuptools make g++ \
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

# ARCHIVE-EPHEMERIDES-SWISSEPH-BUILDER-FIX-V1
# Forcer install + compilation swisseph dans le builder.
# pnpm install peut skip silencieusement les optionalDependencies si la
# compilation node-gyp échoue. On force ici via npm direct (qui plante
# explicitement en cas d'erreur) et on vérifie la présence du binaire .node.
# ARCHIVE-EPHEMERIDES-SWISSEPH-PNPM-FIX-V1 : utiliser pnpm (npm ne gère pas workspace:)
# ARCHIVE-EPHEMERIDES-SWISSEPH-REBUILD-FIX-V1 :
# pnpm peut considérer swisseph comme déjà installé même si la
# compilation node-gyp a échoué silencieusement à l'étape précédente.
# On force une recompilation explicite via `pnpm rebuild` puis on
# vérifie avec un find -L (qui suit les symlinks pnpm).
RUN cd /app && pnpm add swisseph@latest -w 2>&1 | tail -30 \
    && echo "--- pnpm rebuild swisseph ---" \
    && pnpm rebuild swisseph 2>&1 | tail -30 \
    && { find -L node_modules -name "swisseph.node" 2>/dev/null | grep -q "swisseph.node" \
         || find node_modules/.pnpm -name "swisseph.node" 2>/dev/null | grep -q "swisseph.node"; } \
    || (echo "❌ swisseph install/compile failed in builder" \
        && echo "--- DEBUG : node_modules/swisseph/ ---" \
        && ls -la node_modules/swisseph/ 2>/dev/null || true \
        && echo "--- DEBUG : .pnpm/swisseph* ---" \
        && find node_modules/.pnpm -maxdepth 1 -name "swisseph*" 2>/dev/null || true \
        && echo "--- DEBUG : tous les .node trouvés ---" \
        && find -L node_modules -name "*.node" 2>/dev/null | head -10 || true \
        && exit 1)

RUN cd apps/api && tsup --config tsup.config.ts

FROM node:20-alpine AS production
# ARCHIVE-EPHEMERIDES-SWISSEPH-BUILDER-FIX-V1
# python3/make/g++ ne sont plus nécessaires en production : swisseph est
# déjà compilé dans le node_modules copié depuis le builder.
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 fastify

COPY --from=builder --chown=fastify:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=fastify:nodejs /app/node_modules ./node_modules

# ARCHIVE-EPHEMERIDES-SWISSEPH-BUILDER-FIX-V1 :
# l'install runtime de swisseph a été retirée — il est désormais compilé
# dans le builder stage et présent dans le node_modules copié ci-dessus.

USER fastify
EXPOSE 4000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.cjs"]

# ARCHIVE-EPHEMERIDES-SWISSEPH-V1 applied
# ARCHIVE-EPHEMERIDES-SWISSEPH-NPM-FIX-V1 applied
# ARCHIVE-EPHEMERIDES-SWISSEPH-BUILDER-FIX-V1 applied

# ARCHIVE-EPHEMERIDES-SWISSEPH-PNPM-FIX-V1 applied

# ARCHIVE-EPHEMERIDES-SWISSEPH-VERSION-FIX-V1 applied

# ARCHIVE-EPHEMERIDES-SWISSEPH-REBUILD-FIX-V1 applied

# ARCHIVE-EPHEMERIDES-SWISSEPH-DISTUTILS-FIX-V1 applied
