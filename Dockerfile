# === Stage 1: Build ===
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies for building
COPY package*.json ./
# Install ALL dependencies (including devDependencies for Nest CLI)
RUN npm ci

# Copy source code
COPY . .

# Build the application (generates dist/)
RUN npm run build

# === Stage 2: Production Run ===
FROM node:22-alpine AS runner

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Create necessary directories
RUN mkdir -p logs temp prompt && \
    chown -R node:node /app

USER node

# Start application
CMD ["node", "dist/src/main"]
