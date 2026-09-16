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

# ── Dépendances PHP (couche mise en cache) ───────────────────────────────────
COPY composer.json composer.lock ./
RUN composer install \
        --no-dev \
        --no-scripts \
        --no-autoloader \
        --prefer-dist \
        --no-interaction

# ── Code applicatif ──────────────────────────────────────────────────────────
COPY . .

# bootstrap/cache doit exister AVANT dump-autoload : le hook post-autoload-dump
# de Laravel (package:discover) écrit dedans dès la fin de la commande.
RUN mkdir -p storage/framework/{cache/data,sessions,views} storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache \
    && composer dump-autoload --optimize --no-dev

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 9000

ENTRYPOINT ["entrypoint.sh"]
CMD ["php-fpm"]
