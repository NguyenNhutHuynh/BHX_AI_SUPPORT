# Stage 1: Build Web Expo
FROM node:20-alpine AS builder

WORKDIR /app

# Cài đặt dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy mã nguồn và xuất bản web tĩnh
COPY . .
RUN npx expo export --platform web

# Stage 2: Nginx Server siêu nhẹ
FROM nginx:alpine

# Copy file cấu hình Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy sản phẩm đã build từ stage 1 vào thư mục web
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
