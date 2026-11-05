FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 GLIDER_DB_PATH=/data/flights.sqlite
COPY index.html styles.css main.js glider-model.js server.js ./
COPY assets ./assets
RUN mkdir -p /data
EXPOSE 8080
CMD ["node", "server.js"]
