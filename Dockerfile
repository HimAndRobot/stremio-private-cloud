FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
COPY certs/ ./certs/
COPY --from=frontend /app/frontend/dist ./frontend/dist
EXPOSE 11780
CMD ["node", "src/index.js"]
