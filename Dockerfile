FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* .npmrc ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects anonymous telemetry data - disable it
ENV NEXT_TELEMETRY_DISABLED=1

# Variables publiques figées dans le code navigateur au moment du build.
# Railway ne les transmet à un build Dockerfile que si elles sont déclarées
# en ARG (https://docs.railway.com/builds/dockerfiles#using-variables-at-build-time).
# Non définies (déploiement Gabon actuel) : build identique à avant (pays GA).
ARG NEXT_PUBLIC_COUNTRY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_OMG_WHATSAPP_NUMBER

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# ffmpeg : compression des vidéos envoyées depuis l'admin (src/lib/video-compress.ts).
RUN apk add --no-cache ffmpeg

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
