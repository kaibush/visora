FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY front/package.json front/package.json
COPY server/package.json server/package.json
RUN pnpm install --frozen-lockfile
COPY front front
COPY server server
RUN pnpm build && pnpm --filter @visora/server --prod deploy --legacy /runtime

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 VISORA_DATABASE=/app/data/visora.sqlite
COPY --from=build /runtime ./server
COPY --from=build /app/front/dist ./front/dist
RUN mkdir /app/data && chown node:node /app/data
USER node
EXPOSE 3001
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/src/index.mjs"]
