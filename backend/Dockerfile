# Use the official Bun image
FROM oven/bun:1

# Install CA certificates for TLS/SSL connections (needed for Supabase)
USER root
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates && rm -rf /var/lib/apt/lists/*
USER bun

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Expose the port
EXPOSE 8000

# Start the server with hot reload
CMD ["bun", "run", "--watch", "src/index.ts"]
