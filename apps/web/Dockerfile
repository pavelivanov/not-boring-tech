FROM node:22-bookworm-slim AS build
WORKDIR /app

# Railway injects service variables into the build; they must be declared in
# the stage that consumes them. Vite inlines these at build time.
ARG VITE_API_BASE_URL
ARG VITE_PUBLIC_SITE_ORIGIN

COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN npm ci --no-audit --no-fund \
    --fetch-retries=5 \
    --fetch-retry-mintimeout=20000 \
    --fetch-retry-maxtimeout=120000

COPY apps/web apps/web
COPY packages/contracts packages/contracts
COPY packages/typescript-config packages/typescript-config
RUN npm run build --workspace=@findthatproject/web

FROM caddy:2.10-alpine AS runtime
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/build/client /srv
EXPOSE 8080
