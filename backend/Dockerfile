FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Ensure the algorithm executable (Windows .exe) is present or user provides a compatible binary
RUN chmod +x PDPTW_HYBRID_ACO_GREEDY_V3.exe || true

ENV PORT=3001
EXPOSE 3001

# Use non-root user for safety
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

CMD ["node", "server.js"]
