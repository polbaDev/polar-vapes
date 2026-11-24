# ---- Dependencias ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- Ejecución ----
FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/package.json /app/next.config.mjs ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/datos ./datos
USER node
EXPOSE 3000
# Aplica migraciones pendientes (si fallan, el contenedor se para con error), carga el catálogo
# inicial (solo si está vacío; si falla, la app arranca igual) y arranca la app con exec para que
# reciba las señales de parada
CMD ["sh", "-c", "node scripts/migrate.mjs || { echo 'Las migraciones han fallado: la app no arranca.' >&2; exit 1; }; node scripts/seed.mjs || echo 'No se pudo cargar el catálogo inicial; la app arranca igual.' >&2; exec node_modules/.bin/next start"]
