FROM node:22-alpine AS builder

RUN apk add --no-cache curl bash && \
    curl -fsSL https://nubjs.com/install.sh | bash

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

# Install kubectl at runtime (works for both amd64 and arm64)
RUN apk add --no-cache curl && \
    KUBECTL_VERSION=$(curl -L -s https://dl.k8s.io/release/stable.txt) && \
    ARCH=$(case $(uname -m) in x86_64) echo "amd64" ;; aarch64) echo "arm64" ;; esac) && \
    curl -fsSLO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${ARCH}/kubectl" && \
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && \
    rm kubectl

COPY --from=builder /app/.output .output
COPY --from=builder --chown=nuxt:nodejs /app/package.json .

USER nuxt

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", ".output/server/index.mjs"]
