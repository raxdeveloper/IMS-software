# syntax=docker/dockerfile:1
FROM node:22-alpine AS build

RUN apk add --no-cache openssl

WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npx prisma generate
RUN npm run build

WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

COPY --from=build /app/server/package.json /app/server/package-lock.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/prisma ./prisma
RUN npx prisma generate

WORKDIR /app
COPY --from=build /app/client/dist ./client/dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/app/docker-entrypoint.sh"]
