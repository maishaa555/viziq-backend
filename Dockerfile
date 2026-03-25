# ViziQ Backend - Dockerfile
# Optimized for Railway / Render free tier

FROM node:20-slim

# Install ffmpeg and tesseract system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (layer caching)
COPY package.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source
COPY src/ ./src/
COPY .env.example ./.env.example

# Create runtime directories
RUN mkdir -p uploads frames

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["node", "src/index.js"]