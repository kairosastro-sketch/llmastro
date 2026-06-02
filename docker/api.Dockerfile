# syntax=docker/dockerfile:1.5
# BUILD-SPEEDUP-V1 : directive `# syntax=...` requise pour activer les
# `RUN --mount=type=cache` ci-dessous. Pré-requis côté builder : BuildKit
# (par défaut avec docker compose v2 ; sinon exporter DOCKER_BUILDKIT=1).
FROM node:26-alpine AS base
RUN apk add --no-cache libc6-compat python3 py3-setuptools make g++ \
    && npm install -g pnpm@9 tsup typescript
WORKDIR /app

FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/ephemeris/package.json ./packages/ephemeris/
# BUILD-SPEEDUP-V1 :
#   - cache mount sur le pnpm store global → fetch local sur les rebuilds
#   - --frozen-lockfile : plus rapide ET garantit la version lockée
#     (vs --no-frozen-lockfile qui autorise pnpm à modifier le lockfile)
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --shamefully-hoist
COPY . .
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --shamefully-hoist

# ARCHIVE-EPHEMERIDES-SWISSEPH-REBUILD-FIX-V1 + BUILD-SPEEDUP-V1
# pnpm install (frozen-lockfile + shamefully-hoist) télécharge swisseph
# à la version du lockfile (0.5.17). Mais pnpm peut considérer le package
# "installé" sans avoir réussi node-gyp compile silencieusement à l'étape
# précédente — d'où le `pnpm rebuild swisseph` explicite qui force la
# compilation native.
#
# BUILD-SPEEDUP-V1 : on a retiré `pnpm add swisseph@latest -w` (le @latest
# n'est jamais cacheable, re-download + re-compile à chaque build).
# Le rebuild seul suffit, le download initial vient déjà du lockfile.
#
# Le find vérifie la présence du binaire `.node` (suit les symlinks pnpm).
# Échec = exit 1 explicite + dump de debug pour faciliter le diag.
RUN pnpm rebuild swisseph 2>&1 | tail -30 \
    && { find -L node_modules -name "swisseph.node" 2>/dev/null | grep -q "swisseph.node" \
         || find node_modules/.pnpm -name "swisseph.node" 2>/dev/null | grep -q "swisseph.node"; } \
    || (echo "❌ swisseph compile failed in builder" \
        && echo "--- DEBUG : node_modules/swisseph/ ---" \
        && ls -la node_modules/swisseph/ 2>/dev/null || true \
        && echo "--- DEBUG : .pnpm/swisseph* ---" \
        && find node_modules/.pnpm -maxdepth 1 -name "swisseph*" 2>/dev/null || true \
        && echo "--- DEBUG : tous les .node trouvés ---" \
        && find -L node_modules -name "*.node" 2>/dev/null | head -10 || true \
        && exit 1)

RUN cd apps/api && tsup --config tsup.config.ts

FROM node:26-alpine AS production
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

# BUILD-SPEEDUP-V1 applied (BuildKit cache mounts + frozen-lockfile + retrait swisseph@latest)
