# syntax=docker/dockerfile:1
###############################################################################
# SpiderHome Fleet Monitor — API Laravel (PHP-FPM)
###############################################################################

FROM php:8.2-fpm-alpine AS base

# ── Dépendances système et extensions PHP ────────────────────────────────────
RUN apk add --no-cache \
        bash \
        icu-dev \
        libzip-dev \
        oniguruma-dev \
        mariadb-client \
        tzdata \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_mysql \
        bcmath \
        intl \
        zip \
        opcache \
    && apk del .build-deps

# ── Réglages PHP de production ───────────────────────────────────────────────
RUN { \
      echo 'opcache.enable=1'; \
      echo 'opcache.enable_cli=0'; \
      echo 'opcache.memory_consumption=128'; \
      echo 'opcache.max_accelerated_files=10000'; \
      echo 'opcache.validate_timestamps=0'; \
      echo 'expose_php=Off'; \
      echo 'memory_limit=256M'; \
      echo 'post_max_size=4M'; \
      echo 'upload_max_filesize=4M'; \
    } > /usr/local/etc/php/conf.d/zz-spiderhome.ini

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# ── Code applicatif ──────────────────────────────────────────────────────────
# Copié AVANT composer install (et non après) : la dépendance QR code
# ci-dessous est ajoutée par un `composer require` qui modifie composer.json
# et composer.lock DANS l'image. Copier le code après ce require écraserait
# ces deux fichiers avec les versions du dépôt (sans la dépendance) et
# désynchroniserait le lock d'une future réinstallation.
COPY . .

RUN composer install \
        --no-dev \
        --no-scripts \
        --no-autoloader \
        --prefer-dist \
        --no-interaction

# Génération de QR code (fiche module, cahier des charges §7/§8) — ajoutée
# après le premier verrouillage de composer.lock : `require` résout et
# verrouille ce seul paquet via le réseau du serveur de build, sans exiger
# que composer.lock soit déjà à jour pour lui.
RUN composer require chillerlan/php-qrcode:^5.0 \
        --no-dev \
        --no-scripts \
        --no-interaction

# bootstrap/cache doit exister AVANT dump-autoload : le hook post-autoload-dump
# de Laravel (package:discover) écrit dedans dès la fin de la commande.
RUN mkdir -p storage/framework/{cache/data,sessions,views} storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache \
    && composer dump-autoload --optimize --no-dev

RUN chmod +x docker/entrypoint.sh

EXPOSE 9000

ENTRYPOINT ["docker/entrypoint.sh"]
CMD ["php-fpm"]
