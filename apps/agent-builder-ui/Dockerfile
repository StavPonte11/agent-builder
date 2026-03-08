# Use Node 20 as the base image
FROM node:20-slim AS development

# Install simple build tools for any node-gyp dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the entire monorepo initially (simpler for turborepo/npm workspaces)
COPY . .

# Install dependencies at the root
RUN npm install

# Expose Vite dev port
EXPOSE 5173

# Set working directory to the UI app
WORKDIR /app/apps/agent-builder-ui

# Run dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
