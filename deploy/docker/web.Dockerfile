# syntax=docker/dockerfile:1
###############################################################################
# SpiderHome Fleet Monitor — Frontend Angular + Nginx (proxy vers PHP-FPM)
###############################################################################

# ── Étape 1 : build Angular ──────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

COPY front/package.json front/package-lock.json ./
RUN npm ci

COPY front/ ./
RUN npm run build

# ── Étape 2 : Nginx ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Build Angular
COPY --from=build /app/dist/spiderhome-dashboard/browser /usr/share/nginx/html

# Sources Laravel : Nginx a besoin des fichiers de public/ pour les servir
# et pour transmettre le bon SCRIPT_FILENAME à PHP-FPM.
COPY back/public /var/www/html/public

COPY deploy/docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
