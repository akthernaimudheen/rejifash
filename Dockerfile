# No dependencies to install, so this stays a single tiny layer.
FROM node:22-alpine

WORKDIR /app
COPY . .

# Orders and uploaded photographs. Mount a volume here in production —
# without one, everything written is lost when the container restarts.
ENV DATA_DIR=/var/data
RUN mkdir -p /var/data
VOLUME ["/var/data"]

ENV NODE_ENV=production
ENV PORT=4173
EXPOSE 4173

# ADMIN_PASSWORD must be supplied at run time; the server refuses to start in
# production while the default is in place.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/config > /dev/null || exit 1

CMD ["node", "server/server.js"]
