FROM node:22.13.1-alpine AS verify
WORKDIR /opt/hero
ENV HERO_SOURCE_SNAPSHOT=1
COPY . .
RUN npm install --global pnpm@11.19.0 --ignore-scripts \
    && pnpm install --frozen-lockfile --ignore-scripts \
    && node tools/doctor.mjs && node tools/build.mjs && node --test \
    && rm -rf .github

FROM node:22.13.1-alpine AS runtime
WORKDIR /opt/hero
ENV NODE_ENV=production \
    HERO_HTTP_HOST=0.0.0.0 \
    HERO_HTTP_PORT=3100 \
    HERO_DATA_DIR=/var/lib/hero
COPY --from=verify /opt/hero /opt/hero
RUN addgroup -S hero && adduser -S -G hero hero \
    && mkdir -p /var/lib/hero \
    && chown -R hero:hero /opt/hero /var/lib/hero
USER hero
EXPOSE 3100
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3100/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/control-plane/src/server.mjs"]
