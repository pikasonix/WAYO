FROM alpine:3.19 AS build

# Install build deps (g++, make) to compile C++ binary
RUN apk add --no-cache g++ make cmake pkgconf build-base

WORKDIR /src

# Copy only the C++ source to compile
COPY PDPTW_HYBRID_ACO_GREEDY_V3.cpp /src/

# Compile to a linux executable
RUN g++ PDPTW_HYBRID_ACO_GREEDY_V3.cpp -O2 -std=c++17 -o PDPTW_HYBRID_ACO_GREEDY_V3 || true


FROM node:18-alpine

WORKDIR /usr/src/app

# Install runtime deps
COPY package*.json ./
RUN npm ci --only=production

# Copy app code
COPY . .

# Copy compiled binary from build stage if present
COPY --from=build /src/PDPTW_HYBRID_ACO_GREEDY_V3 ./PDPTW_HYBRID_ACO_GREEDY_V3

# Make sure executable bits are set (if binary copied exists)
RUN if [ -f ./PDPTW_HYBRID_ACO_GREEDY_V3 ]; then chmod +x ./PDPTW_HYBRID_ACO_GREEDY_V3; fi || true

ENV PORT=3001
EXPOSE 3001

# Use non-root user for safety and grant ownership of the app directory
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /usr/src/app
USER appuser

CMD ["node", "server.js"]
