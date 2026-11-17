FROM php:8.3-cli-alpine

WORKDIR /var/www/html

# Cài đặt các gói phụ thuộc của hệ thống & PHP extensions
RUN apk add --no-cache \
    git \
    curl \
    libpng-dev \
    libxml2-dev \
    zip \
    unzip \
    oniguruma-dev \
    mariadb-connector-c-dev \
    && docker-php-ext-install pdo pdo_mysql bcmath mbstring opcache

# Cài đặt Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy mã nguồn dự án
COPY . .

# Cài đặt dependencies PHP
RUN composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev

# Phân quyền thư mục lưu trữ & cache
RUN chmod -R 777 storage bootstrap/cache

# Cấp quyền thực thi cho entrypoint
RUN chmod +x docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
