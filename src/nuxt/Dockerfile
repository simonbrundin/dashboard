FROM node:20-alpine AS builder

RUN npm install -g nub

WORKDIR /app

COPY package*.json pnpm-lock.yaml ./
RUN nub install

COPY . .

RUN nub run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nuxt -u 1001

COPY --from=builder /app/.output .output
COPY --from=builder --chown=nuxt:nodejs /app/package.json .

USER nuxt

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", ".output/server/index.mjs"]
