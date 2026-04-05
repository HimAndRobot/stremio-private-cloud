FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++
COPY src/ ./src/
COPY certs/ ./certs/
COPY --from=frontend /app/frontend/dist ./frontend/dist
EXPOSE 11780
CMD ["node", "src/index.js"]
