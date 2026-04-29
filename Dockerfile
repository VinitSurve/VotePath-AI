# Stage 1: Build the React frontend
FROM node:20-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production server
FROM node:20-slim

WORKDIR /app

# Only copy production-relevant files
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./
COPY --from=build /app/package*.json ./

# Install only production dependencies
RUN npm install --production

# Expose the port Cloud Run uses
ENV PORT=8080
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
