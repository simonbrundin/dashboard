FROM node:22-alpine AS builder

RUN apk add --no-cache curl bash && \
    curl -fsSL https://nubjs.com/install.sh | bash

# Install kubectl for querying Kubernetes API
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/

ENV PATH="/root/.nub/bin:${PATH}"

WORKDIR /app

COPY package*.json ./
RUN nub install

COPY . .

RUN nub run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nuxt -u 1001

# Copy kubectl from builder (needed for Flux status API)
COPY --from=builder /usr/local/bin/kubectl /usr/local/bin/kubectl

COPY --from=builder /app/.output .output
COPY --from=builder --chown=nuxt:nodejs /app/package.json .

USER nuxt

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", ".output/server/index.mjs"]
