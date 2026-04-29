# Build frontend
FROM node:24-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Build backend runtime
FROM node:24-alpine AS runtime
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ ./
COPY --from=client-builder /app/client/dist /app/client/dist

ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "src/server.js"]
