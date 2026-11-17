#!/bin/sh
set -e

# Đợi MySQL khởi động hoàn tất
echo "Waiting for database connection..."
until php -r "try { new PDO('mysql:host='.getenv('DB_HOST').';port='.getenv('DB_PORT').';dbname='.getenv('DB_DATABASE'), getenv('DB_USERNAME'), getenv('DB_PASSWORD')); exit(0); } catch (Exception \$e) { exit(1); }"; do
    sleep 2
done
echo "Database connected successfully!"

# Chạy migration database
php artisan migrate --force || true

# Khởi chạy máy chủ Laravel
echo "Starting Laravel Backend on 0.0.0.0:8000..."
exec php artisan serve --host=0.0.0.0 --port=8000
