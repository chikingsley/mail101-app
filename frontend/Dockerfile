# Use the official Bun image
FROM oven/bun:1

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Expose the port
EXPOSE 3000

# Start the development server with hot reload
CMD ["bun", "run", "--hot", "src/index.ts"]
