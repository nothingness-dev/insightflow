FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE_URL=/api
ARG VITE_PUBLIC_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_PUBLIC_BASE_URL=$VITE_PUBLIC_BASE_URL

COPY package.json package-lock.json ./
RUN npm ci --include=dev --foreground-scripts

COPY . .
RUN ./node_modules/.bin/vite build

FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Bind explicitly to 0.0.0.0 so nginx can reach the container via its IPv4
# Docker network address. Without this, `serve` defaults to ::1 (IPv6 loopback)
# which is unreachable from other containers on the Docker bridge network.
CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:3000"]
