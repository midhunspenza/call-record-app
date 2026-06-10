# syntax=docker/dockerfile:1

# Custom-server Next.js app (server.ts runs via tsx). We can't use Next's
# standalone output here because the HTTP server is hand-rolled to share its
# socket with the WebSocket endpoints, so we keep a full node_modules and run
# `npm start` (= NODE_ENV=production tsx server.ts).

# ---- deps: install everything (build needs dev deps; runtime needs tsx) ----
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile the Next app ----
FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: production image ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
# Bring the installed deps (incl. tsx + next) and the built artifacts/source.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/src ./src
# Static assets served by Next at the site root (e.g. /pcm-player-worklet.js).
COPY --from=build /app/public ./public
EXPOSE 8080
CMD ["npm", "start"]
