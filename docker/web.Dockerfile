FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat \
    && npm install -g pnpm@9
WORKDIR /app

FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
RUN pnpm install --no-frozen-lockfile --shamefully-hoist
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=https://llmastro.com/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN cd apps/web && pnpm run build

FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/web/server.js"]
# PATCH-MENAGE-V1 applied

# DSCLEANUP-DOCKERFILE-HOTFIX-V1 applied
