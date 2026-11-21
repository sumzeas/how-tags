# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:22-slim AS build
WORKDIR /app

# Install all deps (incl. dev deps like Tailwind/TypeScript needed for the build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the source and build the Next.js app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Drop dev dependencies so the runtime image is smaller
RUN npm prune --omit=dev

# ---------- Runtime stage ----------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# Run as the non-root "node" user that ships with the image
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
# Needed so `npm run make-admin -- <handle>` works inside the container
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/lib ./lib
COPY --from=build --chown=node:node /app/test/server-only-stub.ts ./test/server-only-stub.ts

# SQLite user/session DB lives here (mount a volume at /app/data to keep it)
RUN mkdir -p /app/data && chown node:node /app/data
USER node

EXPOSE 3000
# Railway (and most hosts) inject PORT; bind to all interfaces
CMD ["sh", "-c", "npx next start -H 0.0.0.0 -p ${PORT:-3000}"]
