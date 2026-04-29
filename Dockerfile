# Stage 1: Build React
FROM node:20-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-slim

WORKDIR /app

# Copy built frontend
COPY --from=build /app/dist ./dist

# Copy backend directly from context
COPY server.js ./
COPY package*.json ./

RUN npm install --production

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]