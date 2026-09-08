# ─────────────────────────────────────────────────────────────
# Stage 1: Development
# Uses ts-node-dev for hot reload during development.
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS development

WORKDIR /app

# Install dependencies first (layer cache optimization)
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
