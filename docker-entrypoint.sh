#!/bin/sh
set -e
mkdir -p /data /app/uploads
cd /app/server
export DATABASE_URL="${DATABASE_URL:-file:/data/dev.db}"
npx prisma db push
cd /app
exec node server/dist/index.js
