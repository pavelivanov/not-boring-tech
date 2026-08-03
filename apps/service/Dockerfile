FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json turbo.json ./
COPY apps/service/package.json apps/service/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN npm ci --no-audit --no-fund \
    --fetch-retries=5 \
    --fetch-retry-mintimeout=20000 \
    --fetch-retry-maxtimeout=120000

COPY apps/service apps/service
COPY packages/db packages/db
COPY packages/typescript-config packages/typescript-config
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    npm run generate --workspace=@techdex/db
RUN npm run build --workspace=@techdex/db
RUN npm run build --workspace=@techdex/service
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --chown=node:node --from=build /app/package.json /app/package-lock.json ./
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/apps/service/package.json ./apps/service/package.json
COPY --chown=node:node --from=build /app/apps/service/dist ./apps/service/dist
COPY --chown=node:node --from=build /app/packages/db/package.json ./packages/db/package.json
COPY --chown=node:node --from=build /app/packages/db/dist ./packages/db/dist
COPY --chown=node:node --from=build /app/packages/db/prisma ./packages/db/prisma
COPY --chown=node:node --from=build /app/packages/db/prisma.config.ts ./packages/db/prisma.config.ts

USER node
EXPOSE 3001
CMD ["node", "apps/service/dist/server.js"]
